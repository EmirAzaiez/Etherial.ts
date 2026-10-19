var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import etherial from 'etherial';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { AssistantConversation } from './models/AssistantConversation.js';
import { AssistantRequest } from './models/AssistantRequest.js';
import { state } from './services/state.js';
import { REQUESTS_COLLECTION, aiAllowed, apiKeyOf, historyOn, modelsOf, proposalsOn } from './services/options.js';
export * from './services/options.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
    constructor(config = {}) {
        this.etherial_module_name = 'eth_assistant_leaf';
        this.routes = [];
        this.config = config;
        state.config = config;
        this.routes.push({ route: path.join(__dirname, 'routes/admin'), methods: ['ask'] });
        if (historyOn(config)) {
            this.routes.push({ route: path.join(__dirname, 'routes/conversations'), methods: ['list', 'show', 'rename', 'remove', 'decide'] });
        }
    }
    /** Lifecycle: beforeRun — hand the tables to the database before it syncs: the log, and the conversations if kept. */
    beforeRun({ database }) {
        database === null || database === void 0 ? void 0 : database.addModels([AssistantRequest, ...(historyOn(this.config) ? [AssistantConversation] : [])]);
    }
    /** Lifecycle: run — the route. */
    run({ http }) {
        var _a;
        (_a = http === null || http === void 0 ? void 0 : http.routes_leafs) === null || _a === void 0 ? void 0 : _a.push(...this.routes);
    }
    /** Lifecycle: afterRun — every collection exists: list the log, tell the back-office. */
    afterRun() {
        var _a, _b, _c, _d;
        const models = modelsOf(this.config);
        const enabled = !!apiKeyOf(this.config) && aiAllowed();
        console.log(enabled
            ? `[ETHAssistantLeaf] On: ${models.smart} for questions, ${models.fast} for summaries and replies`
            : `[ETHAssistantLeaf] Off: ${aiAllowed() ? 'set ANTHROPIC_API_KEY' : "turn on the admin leaf's features.ai"} to turn it on`);
        const adminLeaf = etherial.eth_admin_leaf;
        if (!(adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.registerCollection))
            return;
        const usersCollection = (_a = this.config.usersCollection) !== null && _a !== void 0 ? _a : 'users';
        const hasUsers = !!((_b = adminLeaf.getCollection) === null || _b === void 0 ? void 0 : _b.call(adminLeaf, usersCollection));
        if (!adminLeaf.getCollection(REQUESTS_COLLECTION))
            adminLeaf.registerCollection(requestsCollection(usersCollection, hasUsers));
        (_c = adminLeaf.setFeature) === null || _c === void 0 ? void 0 : _c.call(adminLeaf, 'assistant', {
            enabled,
            collection: REQUESTS_COLLECTION,
            dailyLimit: (_d = this.config.dailyLimit) !== null && _d !== void 0 ? _d : 200,
            proposals: enabled && proposalsOn(this.config),
            history: enabled && historyOn(this.config),
        });
    }
    commands() {
        return [
            {
                command: 'purge',
                description: 'Delete the log of questions asked to the assistant, and the kept conversations (asks nothing: for test databases)',
                action: () => __awaiter(this, void 0, void 0, function* () {
                    const count = yield AssistantRequest.destroy({ where: {}, truncate: true });
                    if (!historyOn(this.config))
                        return { success: true, message: `Purged the assistant log (${count !== null && count !== void 0 ? count : 0} rows)` };
                    const conversations = yield AssistantConversation.destroy({ where: {}, truncate: true });
                    return { success: true, message: `Purged the assistant log (${count !== null && count !== void 0 ? count : 0} rows) and the conversations (${conversations !== null && conversations !== void 0 ? conversations : 0})` };
                }),
            },
        ];
    }
}
const TASK_OPTIONS = [
    { value: 'ask', label: 'Question', color: 'blue' },
    { value: 'summarize', label: 'Summary', color: 'gray' },
    { value: 'draft', label: 'Drafted reply', color: 'gray' },
];
const STATUS_OPTIONS = [
    { value: 'ok', label: 'Answered', color: 'green' },
    { value: 'failed', label: 'Failed', color: 'red' },
];
function requestsCollection(usersCollection, hasUsers) {
    return {
        name: REQUESTS_COLLECTION,
        model: AssistantRequest,
        crud: ['list', 'show'],
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
            { name: 'id', type: 'integer', readonly: true, sortable: true },
            { name: 'created_at', type: 'datetime', label: 'Asked', sortable: true, filterable: true },
            hasUsers
                ? { name: 'user_id', type: 'relation', label: 'By', filterable: true, relation: { collection: usersCollection, displayField: 'email' } }
                : { name: 'user_id', type: 'integer', label: 'By', filterable: true },
            { name: 'task', type: 'select', label: 'Kind', filterable: true, options: TASK_OPTIONS },
            { name: 'question', type: 'text', label: 'Question', searchable: true },
            { name: 'collection', type: 'string', label: 'Asked from' },
            { name: 'record_id', type: 'string', label: 'Record' },
            { name: 'collections_read', type: 'string', label: 'Read' },
            { name: 'steps', type: 'integer', label: 'Look-ups', sortable: true },
            { name: 'status', type: 'select', label: 'Status', filterable: true, options: STATUS_OPTIONS },
            { name: 'error', type: 'string', label: 'Error' },
            { name: 'model', type: 'string', label: 'Model' },
            { name: 'input_tokens', type: 'integer', label: 'Tokens in', sortable: true },
            { name: 'cached_tokens', type: 'integer', label: 'Of which cached' },
            { name: 'output_tokens', type: 'integer', label: 'Tokens out', sortable: true },
            { name: 'duration_ms', type: 'integer', label: 'Time (ms)', sortable: true },
        ],
        views: {
            list: {
                fields: ['created_at', 'user_id', 'task', 'question', 'collections_read', 'status', 'duration_ms'],
                sort: { field: 'created_at', direction: 'desc' },
                search: ['question'],
                filters: ['task', 'status', 'user_id', 'created_at'],
            },
            show: {
                layout: 'sections',
                sections: [
                    { title: 'Question', fields: ['created_at', 'user_id', 'task', 'question', 'collection', 'record_id'] },
                    { title: 'Answer', fields: ['status', 'error', 'collections_read', 'steps', 'duration_ms'] },
                    { title: 'Cost', fields: ['model', 'input_tokens', 'cached_tokens', 'output_tokens'] },
                ],
            },
        },
    };
}
