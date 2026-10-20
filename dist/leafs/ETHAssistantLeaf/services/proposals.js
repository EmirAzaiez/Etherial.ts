// ──────────────────────────────────────────────────────────────────────────
// Changes the assistant may prepare: edit a record, create one, run an
// action, edit several records at once. None of them writes. Each checks
// what the staff member could do themselves — the collection, their rights,
// the fields their form lets them set, the records — works out what would
// change, and hands it to the back-office as a proposal, a card with Confirm
// and Cancel. Confirming calls the back-office's own endpoints, so the hooks,
// the validation, the permissions and the audit apply as for a change made
// by hand. The assistant only hears that the card is waiting.
//
// Only with the leaf's `proposals` on.
// ──────────────────────────────────────────────────────────────────────────
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
import { randomBytes } from 'crypto';
import { Op } from 'sequelize';
import { MAX_ITEMS } from './catalog.js';
import { maxRecordsOf, timezoneOf } from './options.js';
import { state } from './state.js';
import { ToolError, clockOf, formatDate, linkedIds, relationLabels, subListRows, whereOf } from './tools.js';
import { FLOW_TOOL, proposeFlow } from './flows.js';
const adminLeaf = () => etherial.eth_admin_leaf;
/** What a sentence can set, besides sub-lists. Files and JSON stay in the form. */
const SETTABLE_TYPES = new Set([
    'string',
    'text',
    'richtext',
    'number',
    'integer',
    'boolean',
    'date',
    'datetime',
    'time',
    'email',
    'url',
    'phone',
    'select',
    'multiselect',
    'relation',
    'translations',
]);
/** Set as a whole list: several choices, or the records a many-to-many links to. */
const LIST_TYPES = new Set(['multiselect', 'belongsToMany']);
/** Stamped by the database, never set. */
const STAMPS = new Set(['id', 'created_at', 'updated_at', 'deleted_at', 'createdAt', 'updatedAt', 'deletedAt']);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^(\d{1,2})[:h](\d{2})(?::\d{2})?$/;
const WALL_CLOCK = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Cards one answer may hold: past it, the person should decide on those first. */
const MAX_PROPOSALS = 5;
const MAX_SUMMARY = 240;
const SHOWN_TEXT = 300;
/** Lines one sub-list adds to a card: past it, one line says how many more. */
const MAX_ITEM_LINES = 12;
// ── Definitions ─────────────────────────────────────────────────────────────
const VALUES_DESCRIPTION = [
    'Field name → new value. A choice takes its value or its label; a multiple choice, a list of them. null empties a field.',
    "A date is YYYY-MM-DD, a date and time YYYY-MM-DD HH:mm in the project's time zone, a time of day HH:mm. A rich text is HTML.",
    'A text in several languages (languages in describe_collection) takes an object, language → text: on an edit, a language left out keeps its text; on a new record, give every language.',
    'A link takes the id of the record it points to; a list of links (lists_of_links) takes the ids of every record it should point to, and replaces the whole list. Find ids with query_records first.',
    "A sub-list (sub_lists) takes its items as they should be, in order: an item already there is named by its id, as get_record gives it, with only the fields that change ({ id } alone keeps it as it is); an item without an id is added; an item left out is removed. Read the record's items with get_record first.",
].join(' ');
const SUMMARY_SCHEMA = {
    type: 'string',
    description: "One short sentence, in the staff member's language, saying what this does and why: shown on the card.",
};
export const PROPOSAL_TOOLS = [
    {
        name: 'propose_update',
        description: 'Prepare a change to one record, for the staff member to review and confirm. Changes nothing by itself: the staff member sees the fields before and after, and decides. Only the fields they can edit in its form can be set.',
        input_schema: {
            type: 'object',
            properties: {
                collection: { type: 'string' },
                id: { description: 'The id of the record to change.' },
                changes: { type: 'object', description: VALUES_DESCRIPTION },
                summary: SUMMARY_SCHEMA,
            },
            required: ['collection', 'id', 'changes'],
        },
    },
    {
        name: 'propose_create',
        description: 'Prepare a new record, for the staff member to review and confirm. Creates nothing by itself.',
        input_schema: {
            type: 'object',
            properties: {
                collection: { type: 'string' },
                values: { type: 'object', description: VALUES_DESCRIPTION },
                summary: SUMMARY_SCHEMA,
            },
            required: ['collection', 'values'],
        },
    },
    {
        name: 'propose_action',
        description: "Prepare one of a collection's actions (describe_collection lists them) on one or several records, with what its form asks for, for the staff member to confirm. Runs nothing by itself.",
        input_schema: {
            type: 'object',
            properties: {
                collection: { type: 'string' },
                action: { type: 'string', description: 'Its key, from describe_collection.' },
                ids: { type: 'array', items: {}, description: 'The records to run it on.' },
                data: { type: 'object', description: "The action's form: field name → value." },
                summary: SUMMARY_SCHEMA,
            },
            required: ['collection', 'action', 'ids'],
        },
    },
    {
        name: 'propose_bulk_update',
        description: 'Prepare the same change to several records, chosen by id or by filters (as in query_records), for the staff member to confirm. Changes nothing by itself.',
        input_schema: {
            type: 'object',
            properties: {
                collection: { type: 'string' },
                ids: { type: 'array', items: {}, description: 'The records to change. Or give filters instead.' },
                filters: { type: 'array', items: { type: 'object' }, description: 'As in query_records: every record that matches is changed.' },
                search: { type: 'string' },
                changes: { type: 'object', description: VALUES_DESCRIPTION },
                summary: SUMMARY_SCHEMA,
            },
            required: ['collection', 'changes'],
        },
    },
];
export const isProposalTool = (name) => name === FLOW_TOOL.name || PROPOSAL_TOOLS.some((t) => t.name === name);
/** The tools this person may prepare changes with. */
export const proposalToolsFor = (context) => (context.flows ? [...PROPOSAL_TOOLS, FLOW_TOOL] : PROPOSAL_TOOLS);
/** What describe_collection adds when proposals are on: what this person may prepare there. */
export function writableSide(collection, context) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const leaf = adminLeaf();
        const config = leaf === null || leaf === void 0 ? void 0 : leaf.getCollection(collection.name);
        if (!config)
            return {};
        const crud = (_a = config.crud) !== null && _a !== void 0 ? _a : [];
        const [canUpdate, canCreate] = yield Promise.all([
            crud.includes('update') && leaf.checkAccess(context.user, config.name, 'update'),
            crud.includes('create') && leaf.checkAccess(context.user, config.name, 'create'),
        ]);
        const settable = canUpdate || canCreate ? yield settableFields(collection, config, context.user) : new Map();
        const fields = [...settable.values()].filter((f) => f.type !== 'hasMany').map((f) => f.name);
        // Not among the fields read: describe_collection would not tell them otherwise.
        const links = [...settable.values()]
            .filter((f) => f.type === 'belongsToMany')
            .map((f) => ({ name: f.name, label: f.label, links_to: f.relation.collection, takes: 'a list of ids' }));
        const subLists = [...settable.values()]
            .filter((f) => f.type === 'hasMany')
            .map((f) => (Object.assign({ name: f.name, label: f.label, item_fields: [...f.itemFields.keys()] }, (requiredOf(f).length ? { required_on_new_items: requiredOf(f).map((d) => d.name) } : {}))));
        const actions = [];
        for (const name of (_b = config.actions) !== null && _b !== void 0 ? _b : []) {
            const serialized = (_d = (_c = leaf.actions) === null || _c === void 0 ? void 0 : _c.serialize) === null || _d === void 0 ? void 0 : _d.call(_c, name);
            if (!serialized || ((_e = serialized.meta) === null || _e === void 0 ? void 0 : _e.category) === 'security')
                continue;
            if (!(yield leaf.checkAccess(context.user, config.name, name)))
                continue;
            actions.push(Object.assign({ key: name, label: (_g = (_f = serialized.meta) === null || _f === void 0 ? void 0 : _f.label) !== null && _g !== void 0 ? _g : name }, (((_h = serialized.form) === null || _h === void 0 ? void 0 : _h.length) ? { form: serialized.form.map((f) => { var _a; return (((_a = f.options) === null || _a === void 0 ? void 0 : _a.length) ? `${f.name} (${f.options.map((o) => o.value).join(' | ')})` : f.name); }) } : {})));
        }
        return {
            can_prepare: Object.assign(Object.assign(Object.assign(Object.assign({ edit: !!canUpdate, create: !!canCreate }, (fields.length ? { settable_fields: fields } : {})), (links.length ? { lists_of_links: links } : {})), (subLists.length ? { sub_lists: subLists } : {})), (actions.length ? { actions } : {})),
        };
    });
}
// ── Running a proposal ──────────────────────────────────────────────────────
export function runProposal(name, input, context) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        const proposals = context.proposals;
        if (!proposals)
            throw new ToolError('Preparing changes is turned off: say where in the back office it is done.');
        if (proposals.length >= MAX_PROPOSALS)
            throw new ToolError(`${MAX_PROPOSALS} changes are already waiting: let the staff member decide on those first.`);
        if (name === FLOW_TOOL.name) {
            if (!context.flows)
                throw new ToolError('This staff member cannot build automations: tell them so.');
            const { proposal, step } = yield proposeFlow(input, context);
            proposals.push(proposal);
            return {
                result: Object.assign(Object.assign({ proposal: proposal.id, status: 'waiting for the staff member', steps: (_a = proposal.diff) === null || _a === void 0 ? void 0 : _a.map((c) => `${c.label}: ${c.after}`) }, (((_b = proposal.notes) === null || _b === void 0 ? void 0 : _b.length) ? { to_check: proposal.notes } : {})), { note: 'Nothing is saved. The staff member now sees a card that puts this automation in the builder; they check it there, then save it and turn it on. Say in one or two sentences what it does and what they should check (to_check), and never say it is done or running.' }),
                step,
            };
        }
        const collection = context.collections.get(input === null || input === void 0 ? void 0 : input.collection);
        if (!collection)
            throw new ToolError(`No readable collection "${String(input === null || input === void 0 ? void 0 : input.collection)}". Use a key from the list of collections.`);
        const config = (_c = adminLeaf()) === null || _c === void 0 ? void 0 : _c.getCollection(collection.name);
        if (!config)
            throw new ToolError(`${collection.labelPlural} cannot be changed from the back office`);
        context.read.add(collection.name);
        let proposal;
        switch (name) {
            case 'propose_update':
                proposal = yield proposeUpdate(collection, config, input, context);
                break;
            case 'propose_create':
                proposal = yield proposeCreate(collection, config, input, context);
                break;
            case 'propose_action':
                proposal = yield proposeAction(collection, config, input, context);
                break;
            case 'propose_bulk_update':
                proposal = yield proposeBulkUpdate(collection, config, input, context);
                break;
            default:
                throw new ToolError(`Unknown tool ${name}`);
        }
        proposals.push(proposal);
        const count = (_d = proposal.recordIds) === null || _d === void 0 ? void 0 : _d.length;
        return {
            result: Object.assign(Object.assign(Object.assign({ proposal: proposal.id, status: 'waiting for the staff member' }, (((_e = proposal.diff) === null || _e === void 0 ? void 0 : _e.length) ? { changes: proposal.diff.map((c) => { var _a, _b; return `${c.label}: ${(_a = c.before) !== null && _a !== void 0 ? _a : 'empty'} → ${(_b = c.after) !== null && _b !== void 0 ? _b : 'empty'}`; }) } : {})), (count ? { records: count } : {})), { note: 'Nothing has changed yet. The staff member now sees this as a card with Confirm and Cancel. Say in one sentence what you prepared and ask them to check it and confirm. Never say it is done.' }),
            step: Object.assign({ tool: name, label: proposal.title, collection: collection.name }, (proposal.link ? { link: proposal.link } : {})),
        };
    });
}
function proposeUpdate(collection, config, input, context) {
    return __awaiter(this, void 0, void 0, function* () {
        yield allowed(config, context.user, 'update', `edit ${collection.labelPlural.toLowerCase()}`);
        const record = yield recordOf(collection, config, input === null || input === void 0 ? void 0 : input.id);
        const settable = yield settableFields(collection, config, context.user);
        const asked = (input === null || input === void 0 ? void 0 : input.changes) && typeof input.changes === 'object' ? Object.keys(input.changes) : [];
        const before = Object.assign(Object.assign(Object.assign({}, plain(record)), (yield linksOf(record, settable, asked))), (yield itemsNow(record, collection, settable, asked)));
        // A text in several languages is merged into what the form shows, unsaved edits included.
        const form = context.form && context.form.collection === collection.name && context.form.id === String(input.id) ? context.form.values : undefined;
        const data = yield valuesOf(collection, settable, input === null || input === void 0 ? void 0 : input.changes, 'changes', before, form);
        const changed = Object.keys(data).filter((name) => !same(settable.get(name), before[name], data[name]));
        if (!changed.length)
            throw new ToolError(`Nothing would change: ${collection.label} #${input.id} already has these values.`);
        const kept = Object.fromEntries(changed.map((name) => [name, data[name]]));
        const id = before[pkOf(collection)];
        const title = `Edit ${collection.label} ${nameOf(collection, before)}`;
        return Object.assign({ id: proposalId(), kind: 'update', collection: collection.name, collectionLabel: collection.label, recordId: id, data: kept, diff: yield diffOf(settable, changed, [before], kept), summary: summaryOf(input === null || input === void 0 ? void 0 : input.summary, title), title, link: `/${collection.name}/${encodeURIComponent(String(id))}` }, versionsOf(collection, [before]));
    });
}
function proposeCreate(collection, config, input, context) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        yield allowed(config, context.user, 'create', `create ${collection.labelPlural.toLowerCase()}`);
        const settable = yield settableFields(collection, config, context.user);
        const data = yield valuesOf(collection, settable, input === null || input === void 0 ? void 0 : input.values, 'values');
        // What the form would refuse to save, said now rather than on Confirm.
        const shown = formFields(config, 'create');
        const missing = ((_a = config.fields) !== null && _a !== void 0 ? _a : []).filter((f) => (f === null || f === void 0 ? void 0 : f.required) && !f.readonly && f.defaultValue === undefined && (!shown || shown.has(f.name)) && isEmpty(data[f.name]));
        const unsettable = missing.filter((f) => !settable.has(f.name));
        if (unsettable.length) {
            throw new ToolError(`A new ${collection.label.toLowerCase()} needs ${unsettable.map((f) => f.label || f.name).join(', ')}, which only its form can fill in: send the staff member to /${collection.name}/create`);
        }
        if (missing.length)
            throw new ToolError(`Required: ${missing.map((f) => f.name).join(', ')}`);
        const names = Object.keys(data).filter((name) => !isEmpty(data[name]));
        if (!names.length)
            throw new ToolError('Give the values of the new record');
        const title = `New ${collection.label.toLowerCase()}`;
        return {
            id: proposalId(),
            kind: 'create',
            collection: collection.name,
            collectionLabel: collection.label,
            data,
            diff: (yield diffOf(settable, names, [], data)).map((c) => (Object.assign(Object.assign({}, c), { before: null }))),
            summary: summaryOf(input === null || input === void 0 ? void 0 : input.summary, title),
            title,
        };
    });
}
function proposeAction(collection, config, input, context) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        const leaf = adminLeaf();
        const name = String((_a = input === null || input === void 0 ? void 0 : input.action) !== null && _a !== void 0 ? _a : '');
        const action = ((_b = config.actions) !== null && _b !== void 0 ? _b : []).includes(name) ? (_d = (_c = leaf.actions) === null || _c === void 0 ? void 0 : _c.get) === null || _d === void 0 ? void 0 : _d.call(_c, name) : undefined;
        if (!action)
            throw new ToolError(`${collection.labelPlural} have no action "${name}". describe_collection lists them.`);
        const serialized = leaf.actions.serialize(name);
        const label = (_f = (_e = serialized === null || serialized === void 0 ? void 0 : serialized.meta) === null || _e === void 0 ? void 0 : _e.label) !== null && _f !== void 0 ? _f : name;
        // A generated password or key is shown once, to whoever runs it, on the record's page.
        if (((_g = serialized === null || serialized === void 0 ? void 0 : serialized.meta) === null || _g === void 0 ? void 0 : _g.category) === 'security')
            throw new ToolError(`"${label}" is run from the record's page, by hand.`);
        yield allowed(config, context.user, name, `run "${label}"`);
        const ids = idsOf(input === null || input === void 0 ? void 0 : input.ids);
        const danger = ((_h = serialized === null || serialized === void 0 ? void 0 : serialized.meta) === null || _h === void 0 ? void 0 : _h.color) === 'danger';
        // As the list does with a selection: a dangerous action goes one record at a time.
        if (danger && ids.length > 1)
            throw new ToolError(`"${label}" is run on one record at a time.`);
        const rows = yield recordsOf(collection, config, ids);
        const form = (_j = serialized === null || serialized === void 0 ? void 0 : serialized.form) !== null && _j !== void 0 ? _j : [];
        const data = {};
        const given = (input === null || input === void 0 ? void 0 : input.data) && typeof input.data === 'object' && !Array.isArray(input.data) ? input.data : {};
        for (const [key, value] of Object.entries(given)) {
            const field = form.find((f) => f.name === key);
            if (!field)
                throw new ToolError(`"${label}" has no field "${key}"${form.length ? `: its form takes ${form.map((f) => f.name).join(', ')}` : ''}`);
            data[key] = optionValue(field, value);
        }
        if (action.form) {
            try {
                yield action.form.validate(data, { abortEarly: false });
            }
            catch (err) {
                throw new ToolError(`"${label}" would refuse this: ${((_k = err === null || err === void 0 ? void 0 : err.errors) !== null && _k !== void 0 ? _k : [err === null || err === void 0 ? void 0 : err.message]).join('; ')}`);
            }
        }
        const records = rows.map((row) => ({ id: row[pkOf(collection)], label: nameOf(collection, row) }));
        const one = records.length === 1;
        const title = one ? `${label}: ${collection.label} ${records[0].label}` : `${label}: ${records.length} ${collection.labelPlural.toLowerCase()}`;
        return Object.assign(Object.assign(Object.assign({ id: proposalId(), kind: 'action', collection: collection.name, collectionLabel: collection.label, action: name, actionLabel: label }, (one ? { recordId: records[0].id } : {})), { recordIds: records.map((r) => r.id), data, diff: Object.entries(data).map(([key, value]) => {
                var _a, _b, _c;
                const field = form.find((f) => f.name === key);
                const option = (_a = field === null || field === void 0 ? void 0 : field.options) === null || _a === void 0 ? void 0 : _a.find((o) => String(o.value) === String(value));
                return { field: key, label: (_b = field === null || field === void 0 ? void 0 : field.label) !== null && _b !== void 0 ? _b : key, before: null, after: value === null || value === undefined || value === '' ? null : String((_c = option === null || option === void 0 ? void 0 : option.label) !== null && _c !== void 0 ? _c : value) };
            }), summary: summaryOf(input === null || input === void 0 ? void 0 : input.summary, ((_l = serialized === null || serialized === void 0 ? void 0 : serialized.meta) === null || _l === void 0 ? void 0 : _l.description) || title), title, tone: danger ? 'danger' : 'default', records }), (one ? { link: `/${collection.name}/${encodeURIComponent(String(records[0].id))}` } : {}));
    });
}
function proposeBulkUpdate(collection, config, input, context) {
    return __awaiter(this, void 0, void 0, function* () {
        yield allowed(config, context.user, 'update', `edit ${collection.labelPlural.toLowerCase()}`);
        const settable = yield settableFields(collection, config, context.user);
        const data = yield valuesOf(collection, settable, input === null || input === void 0 ? void 0 : input.changes, 'changes', {}, undefined, true);
        const lists = Object.keys(data).filter((name) => ['belongsToMany', 'hasMany', 'translations'].includes(settable.get(name).type));
        if (lists.length)
            throw new ToolError(`${lists.map((name) => settable.get(name).label).join(', ')} is changed one record at a time, with propose_update`);
        const max = maxRecordsOf(state.config);
        let rows;
        if (Array.isArray(input === null || input === void 0 ? void 0 : input.ids) && input.ids.length) {
            rows = yield recordsOf(collection, config, idsOf(input.ids));
        }
        else if ((Array.isArray(input === null || input === void 0 ? void 0 : input.filters) && input.filters.length) || (input === null || input === void 0 ? void 0 : input.search)) {
            const where = { [Op.and]: [whereOf(collection, input.filters, input.search), notDeleted(config)] };
            const total = yield collection.model.count({ where });
            if (!total)
                throw new ToolError(`No ${collection.labelPlural.toLowerCase()} match these filters`);
            if (total > max)
                throw new ToolError(`${total} ${collection.labelPlural.toLowerCase()} match: at most ${max} can be changed at once. Narrow the filters.`);
            const found = yield collection.model.findAll({ where, order: [[pkOf(collection), 'ASC']], limit: max });
            rows = found.map(plain);
        }
        else {
            throw new ToolError('Say which records: ids, or filters');
        }
        // Records that already hold the new values are left out: confirming them would change nothing.
        const names = Object.keys(data);
        const touched = rows.filter((row) => names.some((name) => !same(settable.get(name), row[name], data[name])));
        if (!touched.length)
            throw new ToolError(`Nothing would change: these ${collection.labelPlural.toLowerCase()} already have these values.`);
        const changed = names.filter((name) => touched.some((row) => !same(settable.get(name), row[name], data[name])));
        const kept = Object.fromEntries(changed.map((name) => [name, data[name]]));
        const records = touched.map((row) => ({ id: row[pkOf(collection)], label: nameOf(collection, row) }));
        const left = rows.length - touched.length;
        const title = `Edit ${records.length} ${(records.length === 1 ? collection.label : collection.labelPlural).toLowerCase()}`;
        return Object.assign({ id: proposalId(), kind: 'bulk_update', collection: collection.name, collectionLabel: collection.label, recordIds: records.map((r) => r.id), data: kept, diff: yield diffOf(settable, changed, touched, kept), summary: summaryOf(input === null || input === void 0 ? void 0 : input.summary, left ? `${title} (${left} already had these values)` : title), title,
            records }, versionsOf(collection, touched));
    });
}
// ── What this person may set ────────────────────────────────────────────────
/** Throws unless the collection and the role allow it, as the endpoint itself would. */
function allowed(config, user, method, what) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const crudMethod = method === 'update' || method === 'create';
        if (crudMethod && !((_a = config.crud) !== null && _a !== void 0 ? _a : []).includes(method))
            throw new ToolError(`${(_c = (_b = config.meta) === null || _b === void 0 ? void 0 : _b.labelPlural) !== null && _c !== void 0 ? _c : config.name} cannot be ${method === 'update' ? 'edited' : 'created'} from the back office`);
        if (!(yield adminLeaf().checkAccess(user, config.name, method)))
            throw new ToolError(`This staff member may not ${what}: tell them so.`);
    });
}
let warnedFallback = false;
/** The fields a form view shows, when it names them; null when it shows every editable field. */
function formFields(config, view) {
    var _a, _b, _c;
    const form = (_a = config.views) === null || _a === void 0 ? void 0 : _a[view];
    if ((_b = form === null || form === void 0 ? void 0 : form.sections) === null || _b === void 0 ? void 0 : _b.length)
        return new Set(form.sections.flatMap((s) => { var _a; return (_a = s.fields) !== null && _a !== void 0 ? _a : []; }));
    if ((_c = form === null || form === void 0 ? void 0 : form.fields) === null || _c === void 0 ? void 0 : _c.length)
        return new Set(form.fields);
    return null;
}
/** A sub-list's item fields that a new item cannot go without. */
const requiredOf = (field) => field.list.definitions.filter((d) => { var _a; return (d.required || ((_a = d.validation) === null || _a === void 0 ? void 0 : _a.required)) && !d.readonly; });
/**
 * The fields a proposal may set: those the person's own form may write — the
 * admin leaf's `writableFields`, which knows roles and protected columns —
 * that the assistant can also read, and that a sentence can say.
 */
function settableFields(collection, config, user) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        const leaf = adminLeaf();
        let writable;
        if (typeof (leaf === null || leaf === void 0 ? void 0 : leaf.writableFields) === 'function') {
            writable = yield leaf.writableFields(config, user);
        }
        else {
            // An admin leaf older than its writableFields: what the form shows as editable.
            if (!warnedFallback) {
                warnedFallback = true;
                console.warn('[ETHAssistantLeaf] The admin leaf has no writableFields(): proposals fall back to the declared, non-readonly fields');
            }
            writable = new Set(((_a = config.fields) !== null && _a !== void 0 ? _a : []).filter((f) => (f === null || f === void 0 ? void 0 : f.name) && !f.readonly && !f.hidden && !f.secure).map((f) => f.name));
        }
        const pk = pkOf(collection);
        const out = new Map();
        for (const field of collection.fields) {
            if (field.name === pk || STAMPS.has(field.name) || !SETTABLE_TYPES.has(field.type) || !writable.has(field.name))
                continue;
            out.set(field.name, field);
        }
        // A many-to-many (a segment's projects) is no column the assistant reads,
        // but a list of ids the form sets: it may set it too. Not with data on the
        // link itself (pivot fields), which only the form shows.
        const excluded = new Set((_c = (_b = state.config.excludeFields) === null || _b === void 0 ? void 0 : _b[config.name]) !== null && _c !== void 0 ? _c : []);
        for (const field of (_d = config.fields) !== null && _d !== void 0 ? _d : []) {
            const link = (field === null || field === void 0 ? void 0 : field.type) === 'belongsToMany' ? field.belongsToMany : undefined;
            if (!(link === null || link === void 0 ? void 0 : link.collection) || ((_e = link.pivotFields) === null || _e === void 0 ? void 0 : _e.length) || field.secure || excluded.has(field.name) || !writable.has(field.name))
                continue;
            out.set(field.name, {
                name: field.name,
                label: field.label || field.name,
                type: 'belongsToMany',
                relation: { collection: link.collection, displayField: link.displayField || 'id' },
                listFilter: false,
            });
        }
        // A sub-list, item by item: what its rows hold, but for what only the form can fill in (files).
        for (const list of collection.subLists) {
            if (!writable.has(list.name))
                continue;
            const itemFields = new Map();
            for (const field of list.fields) {
                const definition = list.definitions.find((d) => d.name === field.name);
                if ((definition === null || definition === void 0 ? void 0 : definition.readonly) || STAMPS.has(field.name))
                    continue;
                if (field.type === 'belongsToMany' || SETTABLE_TYPES.has(field.type))
                    itemFields.set(field.name, field);
            }
            if (itemFields.size)
                out.set(list.name, { name: list.name, label: list.label, type: 'hasMany', listFilter: false, list, itemFields });
        }
        return out;
    });
}
/**
 * The values asked for, as the endpoint takes them; throws on the first that
 * cannot be. `before` holds the record's values, its sub-lists' items among
 * them; `form`, what its open form shows.
 */
function valuesOf(collection_1, settable_1, raw_1, key_1) {
    return __awaiter(this, arguments, void 0, function* (collection, settable, raw, key, before = {}, form, bulk = false) {
        var _a;
        if (!raw || typeof raw !== 'object' || Array.isArray(raw))
            throw new ToolError(`${key} is an object: field name → value`);
        const entries = Object.entries(raw);
        if (!entries.length)
            throw new ToolError(`${key} is empty`);
        const out = {};
        for (const [name, value] of entries) {
            const field = settable.get(name);
            if (!field) {
                const known = collection.fields.some((f) => f.name === name) || collection.subLists.some((l) => l.name === name);
                throw new ToolError(known
                    ? `${name} cannot be set here: ${settable.size ? `settable fields are ${[...settable.keys()].join(', ')}` : 'nothing in this collection can be'}. Say it is done in the form.`
                    : `${collection.name} has no field "${name}". Call describe_collection.`);
            }
            if (bulk && field.type === 'hasMany')
                continue;
            out[name] =
                field.type === 'hasMany'
                    ? yield itemsOfList(field, value, (_a = before[name]) !== null && _a !== void 0 ? _a : [])
                    : field.type === 'translations'
                        ? textsOf(field, value, isTexts(form === null || form === void 0 ? void 0 : form[name]) ? form[name] : before[name], !bulk && before[pkOf(collection)] !== undefined)
                        : yield valueOf(field, value);
        }
        return out;
    });
}
const isTexts = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
/**
 * A text in several languages, as one object with every language: the model
 * may replace them all at once. On an edit, a language not given keeps the
 * text it has now; on a new record, it stays out.
 */
function textsOf(field, value, current, merge) {
    var _a;
    const locales = (_a = field.locales) !== null && _a !== void 0 ? _a : [];
    let given = value;
    if (typeof value === 'string' && value.trim().startsWith('{')) {
        try {
            given = JSON.parse(value);
        }
        catch (_b) {
            // Plain text: refused below.
        }
    }
    const shape = `{ ${locales.map((l) => `"${l}": "…"`).join(', ')} }`;
    if (given === null)
        return Object.fromEntries(locales.map((l) => [l, '']));
    if (!isTexts(given))
        throw new ToolError(`${field.name} takes a text per language: ${shape}`);
    const unknown = Object.keys(given).filter((l) => !locales.includes(l));
    if (unknown.length)
        throw new ToolError(`${field.name} has no language ${unknown.join(', ')}: it takes ${shape}`);
    const out = {};
    for (const locale of locales) {
        if (locale in given) {
            const text = given[locale];
            out[locale] = text === null || text === undefined ? '' : String(text);
        }
        else if (merge) {
            const text = isTexts(current) ? current[locale] : undefined;
            out[locale] = text === null || text === undefined ? '' : String(text);
        }
    }
    return out;
}
/** A sub-list's items now, for the sub-lists among `names`: what an edit starts from. */
function itemsNow(record, collection, settable, names) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const out = {};
        for (const name of names) {
            const list = (_a = settable.get(name)) === null || _a === void 0 ? void 0 : _a.list;
            if (!list)
                continue;
            const { rows, total } = yield subListRows(list, record.get(pkOf(collection)), MAX_ITEMS + 1);
            if (total > MAX_ITEMS)
                throw new ToolError(`${list.label} holds ${total} items: too many to edit from here. Say it is done in the record's form.`);
            out[name] = rows;
        }
        return out;
    });
}
/**
 * A sub-list as the endpoint takes it: the items kept, changed or added, in
 * their new order, then the ones removed, flagged `_deleted` — an item left
 * out of the payload would be kept as it is.
 */
function itemsOfList(field, value, rows) {
    return __awaiter(this, void 0, void 0, function* () {
        const list = field.list;
        const itemFields = field.itemFields;
        const pk = list.model.primaryKeyAttribute || 'id';
        const byId = new Map(rows.map((row) => [String(row[pk]), row]));
        const given = itemsOf(value);
        const out = [];
        const kept = new Set();
        for (const [index, raw] of given.entries()) {
            const where = `${list.label}, item ${index + 1}`;
            if (!isTexts(raw))
                throw new ToolError(`${where}: an item is an object, item field → value, with the id of one already there`);
            const id = raw.id === undefined || raw.id === null || raw.id === '' ? undefined : String(raw.id);
            const existing = id === undefined ? undefined : byId.get(id);
            if (id !== undefined && !existing)
                throw new ToolError(`${where}: this record has no item #${id} in ${list.label}. get_record lists them; an item without an id is a new one.`);
            if (id !== undefined && kept.has(id))
                throw new ToolError(`${where}: item #${id} is listed twice`);
            if (id !== undefined)
                kept.add(id);
            const item = existing ? { id: existing[pk] } : {};
            for (const [key, v] of Object.entries(raw)) {
                if (key === 'id' || key === pk)
                    continue;
                const itemField = itemFields.get(key);
                if (!itemField)
                    throw new ToolError(`${where}: no settable field "${key}". Its items take ${[...itemFields.keys()].join(', ')}.`);
                let next;
                try {
                    next = itemField.type === 'translations' ? textsOf(itemField, v, existing === null || existing === void 0 ? void 0 : existing[key], !!existing) : yield valueOf(itemField, v);
                }
                catch (err) {
                    if (err instanceof ToolError)
                        throw new ToolError(`${where}: ${err.message}`);
                    throw err;
                }
                // On an item already there, only what changes.
                if (!existing || !same(itemField, existing[key], next))
                    item[key] = next;
            }
            if (!existing) {
                // A new item starts from the defaults, as one added in the form.
                for (const definition of list.definitions) {
                    if (definition.defaultValue !== undefined && item[definition.name] === undefined && itemFields.has(definition.name))
                        item[definition.name] = definition.defaultValue;
                }
            }
            for (const definition of requiredOf(field)) {
                const missing = existing ? definition.name in item && blank(item[definition.name]) : blank(item[definition.name]) && definition.defaultValue === undefined;
                if (!missing)
                    continue;
                throw new ToolError(itemFields.has(definition.name)
                    ? `${where}: ${definition.label || definition.name} is required`
                    : `${where}: a new item needs ${definition.label || definition.name}, which only the form can fill in. Say it is added in the record's form.`);
            }
            out.push(item);
        }
        if (list.max !== undefined && out.length > list.max)
            throw new ToolError(`${list.label} holds at most ${list.max} items, not ${out.length}`);
        if (list.min !== undefined && out.length < list.min)
            throw new ToolError(`${list.label} needs at least ${list.min} items, not ${out.length}`);
        const removed = rows.filter((row) => !kept.has(String(row[pk]))).map((row) => ({ id: row[pk], _deleted: true }));
        return [...out, ...removed];
    });
}
function valueOf(field, value) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (LIST_TYPES.has(field.type))
            return listValueOf(field, value);
        if (value === null || value === undefined || (value === '' && !['string', 'text', 'richtext'].includes(field.type)))
            return null;
        switch (field.type) {
            case 'time': {
                const match = CLOCK.exec(String(value).trim());
                if (!match || Number(match[1]) > 23 || Number(match[2]) > 59)
                    throw new ToolError(`${field.name} is a time of day, HH:mm, not "${String(value)}"`);
                return `${match[1].padStart(2, '0')}:${match[2]}`;
            }
            case 'integer':
            case 'number': {
                const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
                if (!Number.isFinite(n) || (field.type === 'integer' && !Number.isInteger(n)))
                    throw new ToolError(`${field.name} is ${field.type === 'integer' ? 'a whole number' : 'a number'}, not "${String(value)}"`);
                return n;
            }
            case 'boolean':
                if (value === true || value === 'true' || value === 1 || value === '1')
                    return true;
                if (value === false || value === 'false' || value === 0 || value === '0')
                    return false;
                throw new ToolError(`${field.name} is true or false`);
            case 'date': {
                const s = String(value).trim();
                if (DAY.test(s))
                    return s;
                const parsed = Date.parse(s);
                if (Number.isNaN(parsed))
                    throw new ToolError(`${field.name} takes a date (YYYY-MM-DD), not "${s}"`);
                return formatDate(new Date(parsed), false);
            }
            case 'datetime':
                return instantOf(field, String(value).trim()).toISOString();
            case 'select': {
                const options = (_a = field.options) !== null && _a !== void 0 ? _a : [];
                const match = (_b = options.find((o) => String(o.value) === String(value))) !== null && _b !== void 0 ? _b : options.find((o) => o.label.toLowerCase() === String(value).toLowerCase());
                if (!match && options.length)
                    throw new ToolError(`${field.name} is one of: ${options.map((o) => `${o.value} (${o.label})`).join(', ')}`);
                return match ? match.value : value;
            }
            case 'relation': {
                const id = String(value).trim();
                const target = (_d = (_c = adminLeaf()) === null || _c === void 0 ? void 0 : _c.getCollection(field.relation.collection)) === null || _d === void 0 ? void 0 : _d.model;
                if (target) {
                    const pkType = String((_h = (_g = (_f = (_e = target.rawAttributes) === null || _e === void 0 ? void 0 : _e[target.primaryKeyAttribute || 'id']) === null || _f === void 0 ? void 0 : _f.type) === null || _g === void 0 ? void 0 : _g.key) !== null && _h !== void 0 ? _h : '');
                    if (/INT/.test(pkType) && !/^\d+$/.test(id))
                        throw new ToolError(`${field.name} takes the id of a ${field.relation.collection} record (a whole number), not "${id}": find it with query_records`);
                    if (!(yield target.findByPk(id, { attributes: [target.primaryKeyAttribute || 'id'] })))
                        throw new ToolError(`No ${field.relation.collection} #${id}`);
                }
                return /^\d+$/.test(id) ? Number(id) : id;
            }
            case 'email': {
                const s = String(value).trim();
                if (!EMAIL.test(s))
                    throw new ToolError(`${field.name} is an email address, not "${s}"`);
                return s;
            }
            default:
                return String(value);
        }
    });
}
/** A whole list, as the form sends it: null or nothing empties it. */
function listValueOf(field, value) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const given = itemsOf(value);
        if (field.type === 'multiselect') {
            const options = (_a = field.options) !== null && _a !== void 0 ? _a : [];
            const values = given.map((v) => {
                var _a;
                const match = (_a = options.find((o) => String(o.value) === String(v))) !== null && _a !== void 0 ? _a : options.find((o) => o.label.toLowerCase() === String(v).toLowerCase());
                if (!match && options.length)
                    throw new ToolError(`${field.name} takes values among: ${options.map((o) => (String(o.value) === o.label ? o.value : `${o.value} (${o.label})`)).join(', ')}`);
                return match ? match.value : String(v);
            });
            return [...new Set(values)];
        }
        const collection = field.relation.collection;
        const ids = [...new Set(given.map((v) => String(v).trim()))];
        if (ids.some((id) => !/^\d+$/.test(id)))
            throw new ToolError(`${field.name} takes the ids of ${collection} records (whole numbers): find them with query_records`);
        const target = (_c = (_b = adminLeaf()) === null || _b === void 0 ? void 0 : _b.getCollection(collection)) === null || _c === void 0 ? void 0 : _c.model;
        if (target && ids.length) {
            const pk = target.primaryKeyAttribute || 'id';
            const found = yield target.findAll({ where: { [pk]: { [Op.in]: ids } }, attributes: [pk], raw: true });
            const missing = ids.filter((id) => !found.some((row) => String(row[pk]) === id));
            if (missing.length)
                throw new ToolError(`No ${collection} ${missing.map((id) => `#${id}`).join(', ')}`);
        }
        return ids.map(Number);
    });
}
/** The items of a list value: an array, JSON text holding one, or a single value. */
function itemsOf(value) {
    if (value === null || value === undefined || value === '')
        return [];
    if (typeof value === 'string' && value.startsWith('[')) {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed))
                return parsed;
        }
        catch (_a) {
            // Plain text that happens to start with a bracket.
        }
    }
    return (Array.isArray(value) ? value : [value]).filter((v) => v !== null && v !== undefined && v !== '');
}
const isEmpty = (value) => value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
/** Empty, or a text in several languages with none written. */
const blank = (value) => isEmpty(value) || (isTexts(value) && Object.values(value).every(isEmpty));
/** What a record's many-to-many fields among `names` hold now, read through their association. */
function linksOf(record, settable, names) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const out = {};
        for (const name of names) {
            if (((_a = settable.get(name)) === null || _a === void 0 ? void 0 : _a.type) !== 'belongsToMany')
                continue;
            // The admin leaf names the association after the field: it saves through the same setter.
            const get = record[`get${name.charAt(0).toUpperCase()}${name.slice(1)}`];
            if (typeof get !== 'function')
                throw new ToolError(`${settable.get(name).label} is changed in the record's form`);
            const linked = yield get.call(record, { joinTableAttributes: [] });
            out[name] = linked.map((row) => { var _a, _b, _c; return (_c = (_a = row.get) === null || _a === void 0 ? void 0 : _a.call(row, ((_b = row.constructor) === null || _b === void 0 ? void 0 : _b.primaryKeyAttribute) || 'id')) !== null && _c !== void 0 ? _c : row.id; });
        }
        return out;
    });
}
/** "2026-10-20 10:00" is read in the project's zone; a time with its own offset as it says. */
function instantOf(field, s) {
    var _a;
    const wall = WALL_CLOCK.exec(s);
    if (wall)
        return zoned(wall[1], Number(wall[2]), Number(wall[3]), Number((_a = wall[4]) !== null && _a !== void 0 ? _a : 0));
    if (DAY.test(s))
        return zoned(s, 0, 0, 0);
    const parsed = Date.parse(s);
    if (Number.isNaN(parsed))
        throw new ToolError(`${field.name} takes a date and time (YYYY-MM-DD HH:mm), not "${s}"`);
    return new Date(parsed);
}
function zoned(day, hour, minute, second) {
    const [y, m, d] = day.split('-').map(Number);
    const wall = Date.UTC(y, m - 1, d, hour, minute, second);
    // The zone's offset at that moment, checked once more across a clock change.
    let instant = wall - offsetAt(wall);
    const again = offsetAt(instant);
    if (wall - again !== instant)
        instant = wall - again;
    return new Date(instant);
}
function offsetAt(ms) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezoneOf(state.config),
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).formatToParts(new Date(ms));
    const get = (type) => { var _a; return Number((_a = parts.find((p) => p.type === type)) === null || _a === void 0 ? void 0 : _a.value); };
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - Math.floor(ms / 1000) * 1000;
}
/** An action form's choice may be named by its label too. */
function optionValue(field, value) {
    var _a, _b;
    if (!((_a = field === null || field === void 0 ? void 0 : field.options) === null || _a === void 0 ? void 0 : _a.length) || value === null || value === undefined)
        return value;
    const match = (_b = field.options.find((o) => String(o.value) === String(value))) !== null && _b !== void 0 ? _b : field.options.find((o) => String(o.label).toLowerCase() === String(value).toLowerCase());
    if (!match)
        throw new ToolError(`${field.name} is one of: ${field.options.map((o) => o.value).join(', ')}`);
    return match.value;
}
// ── The records ─────────────────────────────────────────────────────────────
const pkOf = (collection) => collection.model.primaryKeyAttribute || 'id';
const plain = (record) => ((record === null || record === void 0 ? void 0 : record.get) ? record.get({ plain: true }) : record);
/** `{ versions }` from the column the model stamps on each write; nothing for a model without one. */
function versionsOf(collection, rows) {
    var _a;
    const column = (_a = collection.model._timestampAttributes) === null || _a === void 0 ? void 0 : _a.updatedAt;
    if (!column)
        return {};
    const versions = {};
    for (const row of rows) {
        const value = row[column];
        const date = value instanceof Date ? value : value ? new Date(value) : null;
        if (date && !Number.isNaN(date.getTime()))
            versions[String(row[pkOf(collection)])] = date.toISOString();
    }
    return Object.keys(versions).length ? { versions } : {};
}
/** Soft-deleted rows are not edited: the list shows them only on request. */
function notDeleted(config) {
    var _a;
    if (!((_a = config.softDelete) === null || _a === void 0 ? void 0 : _a.enabled))
        return {};
    return { [config.softDelete.deletedAtField || 'deleted_at']: { [Op.is]: null } };
}
function idOf(raw) {
    const id = String(raw !== null && raw !== void 0 ? raw : '').trim();
    // The back-office's record routes take numeric ids only.
    if (!/^\d+$/.test(id))
        throw new ToolError(`An id is a whole number, not "${id}"`);
    return id;
}
function idsOf(raw) {
    if (!Array.isArray(raw) || !raw.length)
        throw new ToolError('ids is a list of record ids');
    const ids = [...new Set(raw.map(idOf))];
    const max = maxRecordsOf(state.config);
    if (ids.length > max)
        throw new ToolError(`At most ${max} records at once, not ${ids.length}`);
    return ids;
}
function recordOf(collection, config, raw) {
    return __awaiter(this, void 0, void 0, function* () {
        const id = idOf(raw);
        const record = yield collection.model.findOne({ where: { [Op.and]: [{ [pkOf(collection)]: id }, notDeleted(config)] } });
        if (!record)
            throw new ToolError(`No ${collection.label.toLowerCase()} #${id}`);
        return record;
    });
}
function recordsOf(collection, config, ids) {
    return __awaiter(this, void 0, void 0, function* () {
        const pk = pkOf(collection);
        const found = yield collection.model.findAll({ where: { [Op.and]: [{ [pk]: { [Op.in]: ids } }, notDeleted(config)] }, order: [[pk, 'ASC']] });
        const rows = found.map(plain);
        const missing = ids.filter((id) => !rows.some((row) => String(row[pk]) === id));
        if (missing.length)
            throw new ToolError(`No ${collection.label.toLowerCase()} ${missing.map((id) => `#${id}`).join(', ')}`);
        return rows;
    });
}
const NAME_FIELDS = ['name', 'title', 'label', 'full_name', 'fullname', 'subject', 'reference', 'code', 'email'];
/** "#12 (Sara Ali)": its id, and a readable name when it has one. */
function nameOf(collection, row) {
    const id = row[pkOf(collection)];
    const readableNames = new Set(collection.fields.map((f) => f.name));
    const pick = (name) => (readableNames.has(name) && row[name] !== null && row[name] !== undefined && String(row[name]).trim() ? String(row[name]).trim() : '');
    const person = [pick('firstname') || pick('first_name'), pick('lastname') || pick('last_name')].filter(Boolean).join(' ');
    const name = NAME_FIELDS.map(pick).find(Boolean) || person;
    return name ? `#${id} (${name.length > 60 ? `${name.slice(0, 60)}…` : name})` : `#${id}`;
}
// ── Before and after ────────────────────────────────────────────────────────
function same(field, before, after) {
    var _a;
    if (field.type === 'hasMany') {
        // Nothing changed, removed, added or moved.
        const rows = Array.isArray(before) ? before : [];
        const items = Array.isArray(after) ? after : [];
        const pk = field.list.model.primaryKeyAttribute || 'id';
        return items.length === rows.length && items.every((item, i) => { var _a; return !item._deleted && Object.keys(item).length === 1 && String(item.id) === String((_a = rows[i]) === null || _a === void 0 ? void 0 : _a[pk]); });
    }
    if (field.type === 'translations') {
        const a = isTexts(before) ? before : {};
        const b = isTexts(after) ? after : {};
        return ((_a = field.locales) !== null && _a !== void 0 ? _a : []).every((l) => { var _a, _b; return !(l in b) || String((_a = a[l]) !== null && _a !== void 0 ? _a : '') === String((_b = b[l]) !== null && _b !== void 0 ? _b : ''); });
    }
    if (LIST_TYPES.has(field.type)) {
        const a = itemsOf(before).map(String).sort();
        const b = itemsOf(after).map(String).sort();
        return a.length === b.length && a.every((v, i) => v === b[i]);
    }
    const empty = (v) => v === null || v === undefined || v === '';
    if (empty(before) || empty(after))
        return empty(before) && empty(after);
    switch (field.type) {
        case 'datetime':
            return new Date(String(before instanceof Date ? before.toISOString() : before)).getTime() === new Date(String(after)).getTime();
        case 'date':
            return formatDate(before, false) === after;
        case 'boolean':
            return Boolean(before === 'false' ? false : before) === after;
        case 'integer':
        case 'number':
            return Number(before) === Number(after);
        case 'time':
            return clockOf(before) === clockOf(after);
        default:
            return String(before) === String(after);
    }
}
/** A value as the back-office shows it. */
function shown(field, value, names) {
    var _a, _b, _c, _d, _e;
    if (value === null || value === undefined || value === '')
        return null;
    switch (field.type) {
        case 'boolean':
            return value === true || value === 1 || value === '1' || value === 'true' ? 'Yes' : 'No';
        case 'select':
            return (_c = (_b = (_a = field.options) === null || _a === void 0 ? void 0 : _a.find((o) => String(o.value) === String(value))) === null || _b === void 0 ? void 0 : _b.label) !== null && _c !== void 0 ? _c : String(value);
        case 'relation':
            return (_d = names.get(String(value))) !== null && _d !== void 0 ? _d : `#${value}`;
        case 'multiselect':
        case 'belongsToMany': {
            const items = itemsOf(value).map((v) => { var _a, _b, _c, _d; return field.type === 'multiselect' ? (_c = (_b = (_a = field.options) === null || _a === void 0 ? void 0 : _a.find((o) => String(o.value) === String(v))) === null || _b === void 0 ? void 0 : _b.label) !== null && _c !== void 0 ? _c : String(v) : (_d = names.get(String(v))) !== null && _d !== void 0 ? _d : `#${v}`; });
            const s = items.join(', ');
            return !s ? null : s.length > SHOWN_TEXT ? `${s.slice(0, SHOWN_TEXT)}…` : s;
        }
        case 'date':
            return formatDate(value, false);
        case 'datetime':
            return formatDate(value, true);
        case 'time':
            return clockOf(value);
        case 'translations': {
            if (!isTexts(value))
                return null;
            const s = ((_e = field.locales) !== null && _e !== void 0 ? _e : Object.keys(value))
                .filter((l) => !isEmpty(value[l]))
                .map((l) => `${l.toUpperCase()}: ${String(value[l])}`)
                .join(' · ');
            return !s ? null : s.length > SHOWN_TEXT ? `${s.slice(0, SHOWN_TEXT)}…` : s;
        }
        case 'richtext': {
            const s = String(value)
                .replace(/<[^>]+>/g, ' ')
                .replace(/&nbsp;/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            return !s ? null : s.length > SHOWN_TEXT ? `${s.slice(0, SHOWN_TEXT)}…` : s;
        }
        default: {
            const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
            return s.length > SHOWN_TEXT ? `${s.slice(0, SHOWN_TEXT)}…` : s;
        }
    }
}
/**
 * One line per field: what it holds now and what it would hold. Across
 * several records, "before" counts the values they hold: "Pending ×3, Open ×2".
 */
function diffOf(settable, names, rows, data) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const out = [];
        for (const name of names) {
            const field = settable.get(name);
            if (field.type === 'hasMany') {
                out.push(...(yield itemsDiff(field, rows.length === 1 ? (_a = rows[0][name]) !== null && _a !== void 0 ? _a : [] : [], data[name])));
                continue;
            }
            const labels = field.type === 'relation' || field.type === 'belongsToMany'
                ? yield relationLabels(field, [data[name], ...rows.map((r) => r[name])].flatMap(itemsOf))
                : new Map();
            let before = null;
            if (rows.length === 1) {
                before = shown(field, rows[0][name], labels);
            }
            else if (rows.length > 1) {
                const counts = new Map();
                for (const row of rows) {
                    const value = (_b = shown(field, row[name], labels)) !== null && _b !== void 0 ? _b : 'empty';
                    counts.set(value, ((_c = counts.get(value)) !== null && _c !== void 0 ? _c : 0) + 1);
                }
                const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
                before = sorted
                    .slice(0, 4)
                    .map(([value, n]) => `${value} ×${n}`)
                    .join(', ');
                if (sorted.length > 4)
                    before += ', …';
            }
            out.push({ field: name, label: field.label, before, after: shown(field, data[name], labels) });
        }
        return out;
    });
}
/**
 * A sub-list's lines: an item added (its values), changed (the fields that
 * change), removed (what it held); one line when only the order changes.
 */
function itemsDiff(field, rows, items) {
    return __awaiter(this, void 0, void 0, function* () {
        const list = field.list;
        const itemFields = [...field.itemFields.values()];
        const pk = list.model.primaryKeyAttribute || 'id';
        const byId = new Map(rows.map((row) => [String(row[pk]), row]));
        const labels = new Map();
        for (const f of itemFields) {
            if (f.type !== 'relation' && f.type !== 'belongsToMany')
                continue;
            labels.set(f.name, yield relationLabels(f, [...rows, ...items].flatMap((item) => (f.type === 'relation' ? [item[f.name]] : linkedIds(item[f.name])))));
        }
        const text = (item, only) => {
            const s = itemFields
                .filter((f) => !only || only.includes(f.name))
                .map((f) => {
                var _a;
                const value = shown(f, f.type === 'belongsToMany' ? linkedIds(item[f.name]) : item[f.name], (_a = labels.get(f.name)) !== null && _a !== void 0 ? _a : new Map());
                return value === null ? (only ? `${f.label}: empty` : '') : `${f.label}: ${value}`;
            })
                .filter(Boolean)
                .join(' · ');
            return !s ? null : s.length > SHOWN_TEXT ? `${s.slice(0, SHOWN_TEXT)}…` : s;
        };
        const lines = [];
        const kept = items.filter((item) => !item._deleted);
        kept.forEach((item, i) => {
            const label = `${list.label} ${i + 1}`;
            const existing = item.id === undefined ? undefined : byId.get(String(item.id));
            if (!existing) {
                lines.push({ field: field.name, label: `${label} (new)`, before: null, after: text(item) });
                return;
            }
            const changed = Object.keys(item).filter((key) => key !== 'id');
            if (changed.length)
                lines.push({ field: field.name, label, before: text(existing, changed), after: text(item, changed) });
        });
        for (const item of items.filter((item) => item._deleted)) {
            const existing = byId.get(String(item.id));
            if (existing)
                lines.push({ field: field.name, label: `${list.label} (removed)`, before: text(existing), after: null });
        }
        if (!lines.length) {
            // Only the order changes.
            lines.push({ field: field.name, label: list.label, before: 'Current order', after: 'New order' });
        }
        if (lines.length > MAX_ITEM_LINES) {
            const more = lines.length - (MAX_ITEM_LINES - 1);
            lines.splice(MAX_ITEM_LINES - 1, lines.length, { field: field.name, label: list.label, before: null, after: `${more} more changes` });
        }
        return lines;
    });
}
function summaryOf(given, fallback) {
    const text = typeof given === 'string' ? given.trim().replace(/\s+/g, ' ') : '';
    if (!text)
        return fallback;
    return text.length > MAX_SUMMARY ? `${text.slice(0, MAX_SUMMARY)}…` : text;
}
const proposalId = () => `p_${randomBytes(6).toString('hex')}`;
