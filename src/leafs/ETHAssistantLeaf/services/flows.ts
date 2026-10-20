// ──────────────────────────────────────────────────────────────────────────
// Automations the assistant may prepare, with the flow leaf installed: it
// says what the automation does, the flow leaf's own generator draws the
// graph, and the staff member gets a card that puts it in the builder. Never
// saved from here: they check it on the canvas, save it and turn it on.
// ──────────────────────────────────────────────────────────────────────────

import etherial from 'etherial'
import { randomBytes } from 'crypto'

import type { FlowGraph } from '../../ETHFlowLeaf/types.js'
import { ToolDefinition, createMessage, textOf } from './anthropic.js'
import { apiKeyOf, modelsOf } from './options.js'
import type { Proposal } from './proposals.js'
import { state } from './state.js'
import { Step, ToolContext, ToolError } from './tools.js'

/** The builder's page, as the admin leaf registers it. */
const PAGE = 'flows'
/** Lines a card lists, the trigger first. */
const MAX_LINES = 12
/** A graph generated in one go is long: one call, its own budget. */
const MAX_TOKENS = 4000
const TIMEOUT_MS = 90 * 1000

export const FLOW_TOOL: ToolDefinition = {
    name: 'propose_flow',
    description:
        'Prepare an automation (a flow: what starts it, then its steps) for the automation builder, from a description. Saves nothing: the staff member gets it in the builder, checks it, then saves and turns it on there. With the builder open, it changes what is on the canvas.',
    input_schema: {
        type: 'object',
        properties: {
            request: {
                type: 'string',
                description:
                    'The automation, completely, in plain words: what starts it, what it checks, what it does and to whom, with the collections and fields it uses. The builder only reads this.',
            },
            flow_id: { description: 'A saved automation to change, when it is not the one open in the builder.' },
            new_flow: { type: 'boolean', description: 'true to start a new automation from nothing, even with the builder open on another.' },
            summary: { type: 'string', description: "One short sentence, in the staff member's language, saying what it does: shown on the card." },
        },
        required: ['request'],
    },
}

/** Whether this person may build automations: the flow leaf is there, and they can open its page. */
export async function flowsFor(user: any): Promise<boolean> {
    const adminLeaf = (etherial as any).eth_admin_leaf
    if (!(etherial as any).eth_flow_leaf || !adminLeaf) return false
    if (typeof adminLeaf.canAccessPageFor === 'function') return !!(await adminLeaf.canAccessPageFor(user, PAGE))
    return !!(await adminLeaf.canAccessAdmin?.(user))
}

export async function proposeFlow(input: any, context: ToolContext): Promise<{ proposal: Proposal; step: Step }> {
    const request = typeof input?.request === 'string' ? input.request.trim() : ''
    if (!request) throw new ToolError('Say what the automation does, in request')
    const open = context.flow
    // Loaded here: without the flow leaf, the assistant never loads it.
    const [{ generateFlow }, { Flow }, { registry }] = await Promise.all([
        import('../../ETHFlowLeaf/ai/generator.js'),
        import('../../ETHFlowLeaf/models/Flow.js'),
        import('../../ETHFlowLeaf/registry/Registry.js'),
    ])

    // What it starts from: a saved automation named, the canvas, or nothing.
    let flowId: number | undefined
    let existing: FlowGraph | undefined
    let name: string | undefined
    if (input?.flow_id !== undefined && input.flow_id !== null && input.flow_id !== '' && String(input.flow_id) !== open?.id) {
        if (!/^\d+$/.test(String(input.flow_id))) throw new ToolError(`An automation's id is a whole number, not "${String(input.flow_id)}"`)
        const flow: any = await Flow.findByPk(Number(input.flow_id))
        if (!flow) throw new ToolError(`No automation #${input.flow_id}`)
        flowId = flow.id
        existing = flow.graph ?? undefined
        name = flow.name
    } else if (open && !input?.new_flow) {
        flowId = open.id ? Number(open.id) : undefined
        existing = open.graph
        name = open.name
    }

    const apiKey = apiKeyOf(state.config)!
    const model = modelsOf(state.config).smart
    let draft
    try {
        draft = await generateFlow(request, existing, async (args) => {
            const response = await createMessage({
                apiKey,
                baseUrl: state.config.baseUrl,
                model,
                system: [args.system ?? ''],
                messages: [{ role: 'user', content: args.prompt }],
                maxTokens: args.maxTokens ?? MAX_TOKENS,
                timeoutMs: TIMEOUT_MS,
            })
            if (context.usage) {
                context.usage.input_tokens += response.usage.input_tokens
                context.usage.output_tokens += response.usage.output_tokens
                context.usage.cached_tokens += response.usage.cached_tokens
            }
            return textOf(response.content)
        })
    } catch (err: any) {
        throw new ToolError(`The automation could not be drawn: ${err?.message || 'try describing it another way'}`)
    }

    const title = flowId !== undefined ? `Edit automation ${name || `#${flowId}`}` : `New automation: ${draft.name}`
    const notes = [
        draft.notes,
        ...draft.warnings,
        ...draft.issues.filter((issue) => issue.level === 'error').map((issue) => issue.message),
    ].filter((note): note is string => !!note)
    const proposal: Proposal = {
        id: `p_${randomBytes(6).toString('hex')}`,
        kind: 'flow',
        collection: PAGE,
        collectionLabel: 'Automation',
        ...(flowId !== undefined ? { recordId: flowId } : {}),
        data: { name: draft.name, description: draft.description, trigger_id: draft.trigger_id, trigger_config: draft.trigger_config, graph: draft.graph },
        diff: linesOf(draft.graph, (node) => (node.kind === 'trigger' ? registry.getTrigger(node.type) : registry.getNode(node.type))?.label),
        summary: summaryOf(input?.summary, draft.description || title),
        title,
        ...(notes.length ? { notes } : {}),
        link: `/pages/${PAGE}?flow=${flowId ?? 'new'}`,
    }
    return { proposal, step: { tool: FLOW_TOOL.name, label: title, link: proposal.link } }
}

/** The card's lines: what starts it, then each step. */
function linesOf(graph: FlowGraph, labelOf: (node: FlowGraph['nodes'][number]) => string | undefined) {
    const lines = graph.nodes.map((node, i) => {
        const label = node.label || labelOf(node) || node.type
        return { field: node.id, label: node.kind === 'trigger' ? 'When' : `Step ${i}`, before: null, after: label }
    })
    if (lines.length <= MAX_LINES) return lines
    return [...lines.slice(0, MAX_LINES - 1), { field: 'more', label: 'And', before: null, after: `${lines.length - MAX_LINES + 1} more steps` }]
}

function summaryOf(given: unknown, fallback: string): string {
    const text = typeof given === 'string' ? given.trim().replace(/\s+/g, ' ') : ''
    const summary = text || fallback
    return summary.length > 240 ? `${summary.slice(0, 240)}…` : summary
}
