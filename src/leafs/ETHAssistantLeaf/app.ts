import etherial, { Etherial } from 'etherial'
import * as path from 'path'
import { fileURLToPath } from 'url'

import { AssistantConversation } from './models/AssistantConversation.js'
import { AssistantRequest } from './models/AssistantRequest.js'
import { state } from './services/state.js'
import { ETHAssistantLeafConfig, REQUESTS_COLLECTION, aiAllowed, apiKeyOf, historyOn, modelsOf, proposalsOn } from './services/options.js'

export * from './services/options.js'
export type { Proposal, ProposalChange, ProposalKind } from './services/proposals.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * ETHAssistantLeaf — Claude in the back-office.
 *
 * Staff ask about their data in plain words ("how many padel bookings this
 * month?") and Claude answers by reading it: it counts, lists and opens
 * records through the back-office's own collections, with the staff member's
 * own rights, and links each figure to the list that shows it. On a record,
 * it also summarizes and drafts a reply in English or Arabic.
 *
 * It never writes. With `proposals` on, it prepares the changes asked for —
 * a record edited or created, an action run — and the person confirms them
 * in the panel, through the back-office's own endpoints. With `history` on,
 * each person's conversations are kept, to reopen and carry on.
 *
 * Off until `ANTHROPIC_API_KEY` is set and the admin leaf's `features.ai` is
 * on: what it reads is sent to Anthropic to be answered.
 */
export default class ETHAssistantLeaf {
    readonly etherial_module_name = 'eth_assistant_leaf'

    public config: ETHAssistantLeafConfig
    private routes: { route: string; methods: string[] }[] = []

    constructor(config: ETHAssistantLeafConfig = {}) {
        this.config = config
        state.config = config
        this.routes.push({ route: path.join(__dirname, 'routes/admin'), methods: ['ask'] })
        if (historyOn(config)) {
            this.routes.push({ route: path.join(__dirname, 'routes/conversations'), methods: ['list', 'show', 'rename', 'remove', 'decide'] })
        }
    }

    /** Lifecycle: beforeRun — hand the tables to the database before it syncs: the log, and the conversations if kept. */
    beforeRun({ database }: Etherial) {
        database?.addModels([AssistantRequest, ...(historyOn(this.config) ? [AssistantConversation] : [])] as any)
    }

    /** Lifecycle: run — the route. */
    run({ http }: Etherial) {
        http?.routes_leafs?.push(...this.routes)
    }

    /** Lifecycle: afterRun — every collection exists: list the log, tell the back-office. */
    afterRun() {
        const models = modelsOf(this.config)
        const enabled = !!apiKeyOf(this.config) && aiAllowed()
        console.log(
            enabled
                ? `[ETHAssistantLeaf] On: ${models.smart} for questions, ${models.fast} for summaries and replies`
                : `[ETHAssistantLeaf] Off: ${aiAllowed() ? 'set ANTHROPIC_API_KEY' : "turn on the admin leaf's features.ai"} to turn it on`
        )

        const adminLeaf = (etherial as any).eth_admin_leaf
        if (!adminLeaf?.registerCollection) return
        const usersCollection = this.config.usersCollection ?? 'users'
        const hasUsers = !!adminLeaf.getCollection?.(usersCollection)
        if (!adminLeaf.getCollection(REQUESTS_COLLECTION)) adminLeaf.registerCollection(requestsCollection(usersCollection, hasUsers))

        adminLeaf.setFeature?.('assistant', {
            enabled,
            collection: REQUESTS_COLLECTION,
            dailyLimit: this.config.dailyLimit ?? 200,
            proposals: enabled && proposalsOn(this.config),
            history: enabled && historyOn(this.config),
        })
    }

    commands() {
        return [
            {
                command: 'purge',
                description: 'Delete the log of questions asked to the assistant, and the kept conversations (asks nothing: for test databases)',
                action: async () => {
                    const count = await AssistantRequest.destroy({ where: {}, truncate: true } as any)
                    if (!historyOn(this.config)) return { success: true, message: `Purged the assistant log (${count ?? 0} rows)` }
                    const conversations = await AssistantConversation.destroy({ where: {}, truncate: true } as any)
                    return { success: true, message: `Purged the assistant log (${count ?? 0} rows) and the conversations (${conversations ?? 0})` }
                },
            },
        ]
    }
}

const TASK_OPTIONS = [
    { value: 'ask', label: 'Question', color: 'blue' },
    { value: 'summarize', label: 'Summary', color: 'gray' },
    { value: 'draft', label: 'Drafted reply', color: 'gray' },
]

const STATUS_OPTIONS = [
    { value: 'ok', label: 'Answered', color: 'green' },
    { value: 'failed', label: 'Failed', color: 'red' },
]

function requestsCollection(usersCollection: string, hasUsers: boolean) {
    return {
        name: REQUESTS_COLLECTION,
        model: AssistantRequest,
        crud: ['list', 'show'] as ('list' | 'show')[],
        exportable: true,
        meta: {
            label: 'Assistant question',
            labelPlural: 'Assistant questions',
            icon: 'Sparkles',
            description: 'Every question asked to the assistant: who asked, what it read, what it cost',
            group: 'System',
            order: 97,
            // Out of the menu; listed for the role permissions, and reached from the assistant.
            hidden: true,
        },
        fields: [
            { name: 'id', type: 'integer' as const, readonly: true, sortable: true },
            { name: 'created_at', type: 'datetime' as const, label: 'Asked', sortable: true, filterable: true },
            hasUsers
                ? { name: 'user_id', type: 'relation' as const, label: 'By', filterable: true, relation: { collection: usersCollection, displayField: 'email' } }
                : { name: 'user_id', type: 'integer' as const, label: 'By', filterable: true },
            { name: 'task', type: 'select' as const, label: 'Kind', filterable: true, options: TASK_OPTIONS },
            { name: 'question', type: 'text' as const, label: 'Question', searchable: true },
            { name: 'collection', type: 'string' as const, label: 'Asked from' },
            { name: 'record_id', type: 'string' as const, label: 'Record' },
            { name: 'collections_read', type: 'string' as const, label: 'Read' },
            { name: 'steps', type: 'integer' as const, label: 'Look-ups', sortable: true },
            { name: 'status', type: 'select' as const, label: 'Status', filterable: true, options: STATUS_OPTIONS },
            { name: 'error', type: 'string' as const, label: 'Error' },
            { name: 'model', type: 'string' as const, label: 'Model' },
            { name: 'input_tokens', type: 'integer' as const, label: 'Tokens in', sortable: true },
            { name: 'cached_tokens', type: 'integer' as const, label: 'Of which cached' },
            { name: 'output_tokens', type: 'integer' as const, label: 'Tokens out', sortable: true },
            { name: 'duration_ms', type: 'integer' as const, label: 'Time (ms)', sortable: true },
        ],
        views: {
            list: {
                fields: ['created_at', 'user_id', 'task', 'question', 'collections_read', 'status', 'duration_ms'],
                sort: { field: 'created_at', direction: 'desc' as const },
                search: ['question'],
                filters: ['task', 'status', 'user_id', 'created_at'],
            },
            show: {
                layout: 'sections' as const,
                sections: [
                    { title: 'Question', fields: ['created_at', 'user_id', 'task', 'question', 'collection', 'record_id'] },
                    { title: 'Answer', fields: ['status', 'error', 'collections_read', 'steps', 'duration_ms'] },
                    { title: 'Cost', fields: ['model', 'input_tokens', 'cached_tokens', 'output_tokens'] },
                ],
            },
        },
    }
}
