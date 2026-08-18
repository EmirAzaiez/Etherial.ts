// ──────────────────────────────────────────────────────────────────────────
// ETHFlowLeaf — automations the customer builds.
//
// The premise of this leaf is that a project has already described its domain
// to ETHAdminLeaf: which models exist, what their fields are called, what points
// at what, which actions can be run on them. That description is enough to
// automate against, so registering a collection in the back-office is all it
// takes for its records to become triggerable, readable in templates and
// writable from a step — no flow-specific code per model.
//
// What the project still adds by hand is what only it knows: its own domain
// events (`app.ticket.answered`), steps that talk to systems this leaf has
// never heard of, and an AI provider.
// ──────────────────────────────────────────────────────────────────────────

import etherial, { Etherial } from 'etherial'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

import { Flow } from './models/Flow.js'
import { FlowRun } from './models/FlowRun.js'
import { FlowRunKey } from './models/FlowRunKey.js'
import { registry } from './registry/Registry.js'
import { registerBuiltinTriggers, installModelHooks } from './triggers/index.js'
import { registerBuiltinNodes } from './nodes/index.js'
import { startTicker, stopTicker, tick } from './scheduler/ticker.js'
import { fire, fireAndForget, runFlow } from './engine/fire.js'
import { invalidateListeners } from './engine/listeners.js'
import { setAIProvider } from './ai/provider.js'
import { setLeafConfig, leafConfig, ETHFlowLeafConfig } from './config.js'
import type { FireInput, NodeDefinition, TriggerDefinition } from './types.js'
import type { FlowAIProvider } from './ai/provider.js'

export type { ETHFlowLeafConfig }

export default class ETHFlowLeaf {
    readonly etherial_module_name = 'eth_flow_leaf'

    public config: ETHFlowLeafConfig
    private routes: { route: string; methods: string[] }[] = []
    private started = false
    private builtinsRegistered = false

    constructor(config: ETHFlowLeafConfig = {}) {
        this.config = config
        setLeafConfig(config)

        this.routes.push({
            route: path.join(__dirname, 'routes/flows'),
            methods: [
                'getSchema',
                'resolveSchema',
                'list',
                'show',
                'create',
                'update',
                'remove',
                'run',
                'runs',
                'showRun',
                'rotateToken',
                'generate',
            ],
        })

        this.routes.push({
            route: path.join(__dirname, 'routes/webhook'),
            methods: ['receive', 'verify'],
        })
    }

    /**
     * The leaf owns its three tables and hands them to the database before it
     * syncs, so a project adds the leaf and gets the schema — no migration to
     * copy, nothing to remember on the next deployment.
     */
    async beforeRun({ database }: Etherial): Promise<void> {
        database?.addModels([Flow, FlowRun, FlowRunKey] as any)
    }

    /**
     * The built-in palette, registered at most once.
     *
     * `run()` is the normal caller, but the CLI is not run(): `yarn cmd` boots
     * the modules and stops there, so a command that prints the palette would
     * otherwise print an empty one.
     */
    private registerBuiltins(): void {
        if (this.builtinsRegistered) return
        this.builtinsRegistered = true
        registerBuiltinTriggers()
        registerBuiltinNodes()
    }

    run({ http }: Etherial): void {
        this.registerBuiltins()

        http?.routes_leafs?.push(...this.routes)

        // The admin leaf's run() may not have happened yet — the phase runs every
        // module in parallel — but registerPage only writes to a map, and the
        // schema is serialized later, on request.
        const adminLeaf = (etherial as any).eth_admin_leaf
        adminLeaf?.registerPage?.({
            name: 'flows',
            title: 'Automations',
            icon: 'Workflow',
            group: 'System',
            order: 90,
            component: 'Flows',
            showInMenu: true,
        })

        console.log(
            `[ETHFlowLeaf] Ready — ${registry.listTriggers().length} triggers, ${registry.listNodes().length} steps`
        )
    }

    /**
     * Hooks and the ticker start last, once every module has registered what it
     * wanted to: a model hook installed before the models exist watches nothing,
     * and a tick fired before the tables are synced fails on its first query.
     */
    async afterRun(): Promise<void> {
        const hooked = installModelHooks()
        if (hooked > 0) console.log(`[ETHFlowLeaf] Watching ${hooked} models`)

        startTicker()
        this.started = true

        const timezone = leafConfig().timezone
        console.log(
            `[ETHFlowLeaf] Ticking every ${leafConfig().tickIntervalMinutes} min${timezone ? ` (${timezone})` : ''}`
        )
    }

    // ─── What a project adds ──────────────────────────────────────────────

    /**
     * A domain event of your own — `app.ticket.answered`, `app.deal.won`.
     *
     * Worth registering rather than leaning on `model.tickets.updated`: the
     * customer building the automation reads the palette, and "a ticket was
     * answered" is a thing they recognise, where "a ticket row changed, where
     * the changed fields include answered_at" is a thing they have to decode.
     */
    registerTrigger(definition: TriggerDefinition): void {
        registry.registerTrigger(definition)
    }

    /** A step of your own — anything this leaf cannot reach on its own. */
    registerNode(definition: NodeDefinition): void {
        registry.registerNode(definition)
    }

    /** Turns on the AI steps and the "describe your automation" box. */
    setAIProvider(provider: FlowAIProvider | null): void {
        setAIProvider(provider)
    }

    /** Raise an event. Waits for every matching flow. */
    async fire(input: FireInput) {
        return fire(input)
    }

    /**
     * Raise an event without waiting or caring.
     *
     * This is what request handlers should call: answering the customer must
     * not get slower, and must not fail, because an automation attached to the
     * event does.
     */
    emit(input: FireInput): void {
        fireAndForget(input)
    }

    /** Runs one flow now, outside any trigger. For commands and tests. */
    async runFlow(flowId: number, input?: Partial<FireInput>) {
        const flow = await Flow.findByPk(flowId)
        if (!flow) throw new Error(`Flow #${flowId} not found`)

        return runFlow(flow, {
            triggerId: flow.trigger_id,
            actor: { type: 'system' },
            ...input,
        } as FireInput)
    }

    get registry() {
        return registry
    }

    /** Call after creating or enabling flows outside the routes. */
    invalidate(): void {
        invalidateListeners()
    }

    stop(): void {
        stopTicker()
        this.started = false
    }

    commands() {
        return [
            {
                command: 'tick',
                description: 'Run one scheduler tick now (scheduled flows + due resumes)',
                action: async () => {
                    await tick()
                    return { success: true, message: 'Tick done.' }
                },
            },
            {
                command: 'list',
                description: 'List the automations and their state',
                action: async () => {
                    const flows = await Flow.findAll({
                        where: { deleted_at: null as any },
                        order: [['id', 'ASC']],
                    })

                    const lines = flows.map(
                        (flow) =>
                            `#${flow.id} ${flow.enabled ? '●' : '○'} ${flow.name} — ${flow.trigger_id} ` +
                            `(${flow.run_count ?? 0} runs, ${flow.error_count ?? 0} errors)`
                    )

                    return {
                        success: true,
                        message: lines.length > 0 ? lines.join('\n') : 'No automations yet.',
                    }
                },
            },
            {
                command: 'palette',
                description: 'Print every trigger and step available in this project',
                action: async () => {
                    this.registerBuiltins()
                    const { triggers, nodes } = registry.serialize()
                    const lines = [
                        'Triggers:',
                        ...triggers.map((t) => `  ${t.id} — ${t.label}`),
                        '',
                        'Steps:',
                        ...nodes.map((n) => `  ${n.id} — ${n.label}`),
                    ]
                    return { success: true, message: lines.join('\n') }
                },
            },
        ]
    }
}
