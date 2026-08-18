// ──────────────────────────────────────────────────────────────────────────
// "Every morning at 8, remind tomorrow's appointments" → a graph on the canvas.
//
// This does not run anything. It produces a draft the user then sees, edits and
// enables, which is what makes an unreliable generator acceptable: the worst
// case is a canvas that needs rearranging, not a notification nobody asked for.
//
// The catalogue handed to the model is the real registry, so a step it invents
// is caught here and dropped rather than saved as a flow that fails at 8am.
// ──────────────────────────────────────────────────────────────────────────

import { registry } from '../registry/Registry.js'
import { validateFlow } from '../engine/validate.js'
import { listCollections, collectionLabel } from '../registry/admin.js'
import { complete, parseJSON } from './provider.js'
import type { FieldDefinition, FlowGraph, GraphEdge, GraphNode } from '../types.js'

/** One field, in as few characters as still describe it. */
function describeField(field: FieldDefinition): string {
    const bits: string[] = [`${field.name}: ${field.type}`]
    if (field.required) bits.push('required')
    if (field.options?.length) {
        const values = field.options.slice(0, 12).map((o) => o.value).join('|')
        bits.push(`one of ${values}${field.options.length > 12 ? '|…' : ''}`)
    }
    if (field.relation?.collection) bits.push(`→ ${field.relation.collection}`)
    return bits.join(', ')
}

/**
 * The palette, as text.
 *
 * Trimmed hard on purpose: a project with forty collections has a schema far
 * larger than the instruction, and a model given ten thousand lines of field
 * definitions writes worse graphs than one given the shape of the problem.
 */
function catalogue(): string {
    const lines: string[] = []

    lines.push('## Triggers')
    for (const trigger of registry.listTriggers()) {
        const config = registry.serializeTrigger(trigger).config ?? []
        const configText = config.length ? ` — config: ${config.map(describeField).join('; ')}` : ''
        lines.push(`- ${trigger.id}: ${trigger.label}${configText}`)
    }

    lines.push('')
    lines.push('## Steps')
    for (const node of registry.listNodes()) {
        const serialized = registry.serializeNode(node)
        const configText = serialized.config.length
            ? ` — config: ${serialized.config.map(describeField).join('; ')}`
            : ''
        const branches = serialized.branches?.length
            ? ` — branches: ${serialized.branches.map((b) => b.id).join(', ')}`
            : serialized.branchesFromConfig
              ? ` — branches: one per row of "${serialized.branchesFromConfig}", named case_0, case_1, …, plus "default"`
              : ''
        lines.push(`- ${node.id}: ${node.label}${branches}${configText}`)
    }

    const collections = listCollections()
    if (collections.length > 0) {
        lines.push('')
        lines.push('## Collections')
        for (const collection of collections) {
            const fields = (collection.fields ?? [])
                .slice(0, 25)
                .map((f) => f.name)
                .join(', ')
            lines.push(`- ${collection.name} (${collectionLabel(collection)}): ${fields}`)
        }
    }

    return lines.join('\n')
}

const SYSTEM = `You design automations for a back-office. You answer with JSON and nothing else.

Answer shape:
{
  "name": "short name",
  "description": "one sentence",
  "trigger_id": "<an id from ## Triggers>",
  "trigger_config": { ... },
  "nodes": [ { "id": "n1", "type": "<an id from ## Steps>", "config": { ... } } ],
  "edges": [ { "source": "trigger", "target": "n1" },
             { "source": "n1", "target": "n2", "branch": "true" } ],
  "notes": "anything the user still has to fill in"
}

Rules:
- The entry node is always called "trigger". Every other node needs its own id.
- Use only trigger ids and step ids that appear in the catalogue. Never invent one.
- An edge leaving a branching step must name the branch it leaves from.
- Values may contain {{record.field}}, {{steps.<node id>.<key>}}, {{now.date}},
  {{item.field}} inside a loop. Dates read better through a filter:
  {{record.starts_at | date:"DD/MM HH:mm"}}.
- A repeating trigger that acts on the same record over and over must set
  dedup_mode, or it will act every tick. once_per_record for a reminder that
  goes out once; once_per_day for a daily digest.
- Leave a config value out rather than guessing an id, an email address or a
  collection that is not in the catalogue. Say so in "notes" instead.
- Prefer few steps. A condition the trigger can already express is a step the
  user has to understand for nothing.`

export interface FlowDraft {
    name: string
    description: string
    trigger_id: string
    trigger_config: Record<string, any>
    graph: FlowGraph
    notes?: string
    /** What the generator got wrong and this dropped, in plain words. */
    warnings: string[]
    issues: ReturnType<typeof validateFlow>
}

/**
 * Positions the graph.
 *
 * Depth-first from the trigger, one column per branch: the point is a canvas a
 * human can read on arrival, not an optimal layout. Anything the walk never
 * reaches is parked below, where it is visible rather than stacked at the
 * origin under another node.
 */
function layout(nodes: GraphNode[], edges: GraphEdge[]): void {
    const byId = new Map(nodes.map((node) => [node.id, node]))
    const placed = new Set<string>()
    let nextColumn = 0

    const walk = (id: string, depth: number, column: number): void => {
        const node = byId.get(id)
        if (!node || placed.has(id)) return
        placed.add(id)
        node.position = { x: column * 340, y: depth * 170 }

        const children = edges.filter((edge) => edge.source === id)
        children.forEach((edge, index) => {
            // The first child stays in the column; each extra branch opens a new
            // one to the right, so a two-way condition reads as two columns.
            const childColumn = index === 0 ? column : ++nextColumn
            walk(edge.target, depth + 1, childColumn)
        })
    }

    walk('trigger', 0, 0)

    let orphanRow = 0
    for (const node of nodes) {
        if (placed.has(node.id)) continue
        node.position = { x: -360, y: orphanRow++ * 170 }
    }
}

export async function generateFlow(prompt: string, existing?: FlowGraph): Promise<FlowDraft> {
    const context = existing?.nodes?.length
        ? `\n\nThe user is editing this automation. Return the whole thing, changed:\n${JSON.stringify(existing)}`
        : ''

    const answer = await complete({
        system: SYSTEM,
        prompt: `${catalogue()}\n\n## Request\n${prompt}${context}`,
        json: true,
        maxTokens: 4000,
        temperature: 0.2,
    })

    const parsed = parseJSON<any>(answer)
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('The generator did not return a usable automation. Try rephrasing the request.')
    }

    const warnings: string[] = []

    const triggerId = String(parsed.trigger_id ?? '')
    const trigger = registry.getTrigger(triggerId)
    if (!trigger) {
        throw new Error(`The generator picked a trigger that does not exist ("${triggerId || 'none'}").`)
    }

    const nodes: GraphNode[] = [
        {
            id: 'trigger',
            kind: 'trigger',
            type: triggerId,
            config: typeof parsed.trigger_config === 'object' && parsed.trigger_config ? parsed.trigger_config : {},
            position: { x: 0, y: 0 },
        },
    ]

    const kept = new Set<string>(['trigger'])

    for (const raw of Array.isArray(parsed.nodes) ? parsed.nodes : []) {
        const id = String(raw?.id ?? '').trim()
        const type = String(raw?.type ?? '').trim()
        if (!id || id === 'trigger' || kept.has(id)) continue

        if (!registry.getNode(type)) {
            warnings.push(`Dropped step "${id}": there is no "${type}" step.`)
            continue
        }

        nodes.push({
            id,
            kind: 'node',
            type,
            config: typeof raw.config === 'object' && raw.config ? raw.config : {},
            position: { x: 0, y: 0 },
            label: raw.label ? String(raw.label) : undefined,
        })
        kept.add(id)
    }

    const edges: GraphEdge[] = []
    const seen = new Set<string>()

    for (const raw of Array.isArray(parsed.edges) ? parsed.edges : []) {
        const source = String(raw?.source ?? '')
        const target = String(raw?.target ?? '')
        if (!kept.has(source) || !kept.has(target) || source === target) continue

        const branch = raw?.branch ? String(raw.branch) : undefined
        const signature = `${source}:${branch ?? ''}→${target}`
        if (seen.has(signature)) continue
        seen.add(signature)

        edges.push({ id: `e_${edges.length + 1}`, source, target, branch })
    }

    layout(nodes, edges)

    const graph: FlowGraph = { nodes, edges }

    return {
        name: String(parsed.name ?? 'Untitled automation').slice(0, 120),
        description: String(parsed.description ?? ''),
        trigger_id: triggerId,
        trigger_config: nodes[0].config,
        graph,
        notes: parsed.notes ? String(parsed.notes) : undefined,
        warnings,
        issues: validateFlow(triggerId, graph),
    }
}
