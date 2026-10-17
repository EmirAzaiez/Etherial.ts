// ──────────────────────────────────────────────────────────────────────────
// What the assistant may read: the back-office collections the staff member
// can open, and in each, the plain fields the schema declares. Never a secure
// field, a password, a token, a JSON blob or a file — and never anything the
// schema does not name.
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
import { state } from './state.js';
import { REQUESTS_COLLECTION } from './options.js';
const adminLeaf = () => etherial.eth_admin_leaf;
/** Types read as they are: text, numbers, dates, choices, links to another record. */
const READABLE_TYPES = new Set(['string', 'text', 'number', 'integer', 'boolean', 'date', 'datetime', 'email', 'url', 'phone', 'select', 'multiselect', 'relation']);
/** Name parts that give a secret away, whatever the schema says of the field. */
const SENSITIVE_PARTS = new Set(['password', 'passwd', 'pwd', 'secret', 'token', 'otp', 'hash', 'salt', 'cvv', 'pin']);
function isSensitive(name) {
    const lower = name.toLowerCase();
    if (lower.includes('password') || lower.includes('api_key') || lower.includes('apikey'))
        return true;
    return lower.split(/[^a-z0-9]+/).some((part) => SENSITIVE_PARTS.has(part));
}
function allowedByProject(name) {
    if (name === REQUESTS_COLLECTION)
        return false;
    const allow = state.config.collections;
    if (!allow)
        return true;
    return typeof allow === 'function' ? !!allow(name) : allow.includes(name);
}
const humanize = (name) => name.replace(/_id$/, '').replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
/** A collection's readable side, whoever asks; null when nothing in it may be read. */
export function readable(config) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
    const model = config === null || config === void 0 ? void 0 : config.model;
    const attributes = model === null || model === void 0 ? void 0 : model.rawAttributes;
    if (!attributes || !allowedByProject(config.name))
        return null;
    const excluded = new Set((_b = (_a = state.config.excludeFields) === null || _a === void 0 ? void 0 : _a[config.name]) !== null && _b !== void 0 ? _b : []);
    const listFilters = new Set((_e = (_d = (_c = config.views) === null || _c === void 0 ? void 0 : _c.list) === null || _d === void 0 ? void 0 : _d.filters) !== null && _e !== void 0 ? _e : []);
    const fields = [];
    const seen = new Set();
    for (const field of (_f = config.fields) !== null && _f !== void 0 ? _f : []) {
        if (!(field === null || field === void 0 ? void 0 : field.name) || seen.has(field.name) || !attributes[field.name])
            continue;
        if (field.secure || excluded.has(field.name) || isSensitive(field.name) || !READABLE_TYPES.has(field.type))
            continue;
        if (field.type === 'relation' && !((_g = field.relation) === null || _g === void 0 ? void 0 : _g.collection))
            continue;
        seen.add(field.name);
        fields.push(Object.assign(Object.assign(Object.assign({ name: field.name, label: field.label || humanize(field.name), type: field.type }, (((_h = field.options) === null || _h === void 0 ? void 0 : _h.length) ? { options: field.options.map((o) => { var _a; return ({ value: o.value, label: String((_a = o.label) !== null && _a !== void 0 ? _a : o.value) }); }) } : {})), (field.type === 'relation' ? { relation: { collection: field.relation.collection, displayField: field.relation.displayField || 'id' } } : {})), { listFilter: listFilters.has(field.name) }));
    }
    // The id and the dates rows are stamped with: asked about all the time,
    // rarely declared.
    const stamps = [
        ['id', 'ID', 'integer'],
        ['created_at', 'Created', 'datetime'],
        ['updated_at', 'Updated', 'datetime'],
    ];
    for (const [name, label, type] of stamps) {
        if (attributes[name] && !seen.has(name) && !excluded.has(name))
            fields.push({ name, label, type, listFilter: listFilters.has(name) });
    }
    if (!fields.some((f) => f.name !== 'id'))
        return null;
    const names = new Set(fields.map((f) => f.name));
    const listFields = ((_l = (_k = (_j = config.views) === null || _j === void 0 ? void 0 : _j.list) === null || _k === void 0 ? void 0 : _k.fields) !== null && _l !== void 0 ? _l : []).filter((n) => names.has(n));
    return {
        name: config.name,
        label: ((_m = config.meta) === null || _m === void 0 ? void 0 : _m.label) || humanize(config.name),
        labelPlural: ((_o = config.meta) === null || _o === void 0 ? void 0 : _o.labelPlural) || ((_p = config.meta) === null || _p === void 0 ? void 0 : _p.label) || humanize(config.name),
        description: (_q = config.meta) === null || _q === void 0 ? void 0 : _q.description,
        model,
        fields,
        search: ((_t = (_s = (_r = config.views) === null || _r === void 0 ? void 0 : _r.list) === null || _s === void 0 ? void 0 : _s.search) !== null && _t !== void 0 ? _t : []).filter((n) => names.has(n)),
        listFields: listFields.length ? listFields : fields.slice(0, 6).map((f) => f.name),
    };
}
/**
 * The collections this staff member may read through the assistant: listed
 * in the back-office, and open to their role the way a record page is.
 * Collections a role only looks up in pickers are left out.
 */
export function collectionsFor(user) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const leaf = adminLeaf();
        const out = new Map();
        for (const config of (_a = leaf === null || leaf === void 0 ? void 0 : leaf.collections) !== null && _a !== void 0 ? _a : []) {
            if (config.crud && !config.crud.includes('list'))
                continue;
            const collection = readable(config);
            if (!collection)
                continue;
            if (!(yield leaf.checkAccess(user, config.name, 'show')))
                continue;
            out.set(config.name, collection);
        }
        return out;
    });
}
/** One line per collection, for the assistant to know where to look. */
export function catalogText(collections) {
    return [...collections.values()]
        .map((c) => `- ${c.name}: ${c.labelPlural}${c.description ? ` — ${c.description}` : ''}`)
        .join('\n');
}
/** What describe_collection answers: enough to filter and group without guessing. */
export function describe(collection, collections) {
    return Object.assign(Object.assign({ collection: collection.name, label: collection.labelPlural }, (collection.description ? { description: collection.description } : {})), { searchable_text: collection.search.length ? collection.search : undefined, fields: collection.fields.map((f) => (Object.assign(Object.assign({ name: f.name, label: f.label, type: f.type }, (f.options ? { values: f.options.map((o) => (String(o.value) === o.label ? o.value : `${o.value} (${o.label})`)) } : {})), (f.relation
            ? Object.assign({ links_to: f.relation.collection }, (collections.has(f.relation.collection) ? {} : { note: 'shown by name; that collection itself cannot be read' })) : {})))) });
}
