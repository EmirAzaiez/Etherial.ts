// ──────────────────────────────────────────────────────────────────────────
// The bridge to ETHAdminLeaf.
//
// Every project that runs the admin panel has already described its domain
// once: which models are exposed, what their fields are called, which of them
// point at another collection. That description is exactly what an automation
// builder needs, so this leaf reads it rather than asking for it again.
//
// The practical consequence: register a collection in the back-office and it
// becomes automatable — triggers, record fields, relation walking and all —
// without a line of flow-specific code.
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
/** The admin leaf, or null when the project runs without one. */
export function adminLeaf() {
    var _a;
    return (_a = etherial.eth_admin_leaf) !== null && _a !== void 0 ? _a : null;
}
export function listCollections() {
    var _a;
    const leaf = adminLeaf();
    if (!leaf)
        return [];
    return (_a = leaf.collections) !== null && _a !== void 0 ? _a : [];
}
export function getCollection(name) {
    var _a, _b;
    const leaf = adminLeaf();
    if (!leaf)
        return null;
    return (_b = (_a = leaf.getCollection) === null || _a === void 0 ? void 0 : _a.call(leaf, name)) !== null && _b !== void 0 ? _b : null;
}
/** The Sequelize model behind a collection. */
export function getModel(name) {
    var _a;
    const collection = getCollection(name);
    return (_a = collection === null || collection === void 0 ? void 0 : collection.model) !== null && _a !== void 0 ? _a : null;
}
export function collectionLabel(collection) {
    var _a;
    return ((_a = collection.meta) === null || _a === void 0 ? void 0 : _a.label) || humanize(collection.name);
}
export function collectionLabelPlural(collection) {
    var _a;
    return ((_a = collection.meta) === null || _a === void 0 ? void 0 : _a.labelPlural) || collectionLabel(collection);
}
export function humanize(value) {
    return value
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, (c) => c.toUpperCase())
        .trim();
}
// ─── Field mapping ────────────────────────────────────────────────────────
const TYPE_MAP = {
    string: 'string',
    text: 'string',
    email: 'string',
    url: 'string',
    phone: 'string',
    select: 'string',
    number: 'number',
    integer: 'number',
    boolean: 'boolean',
    date: 'date',
    datetime: 'date',
    json: 'object',
    media: 'object',
    image: 'object',
    file: 'object',
    array: 'array',
    multiselect: 'array',
};
function outputType(field) {
    var _a;
    if (field.type === 'relation')
        return 'number';
    return (_a = TYPE_MAP[field.type]) !== null && _a !== void 0 ? _a : 'string';
}
/**
 * Fields a collection's records expose to templates.
 *
 * Relations are walked one level: `{{record.customer.email}}` is the single
 * most useful thing an automation ever asks for — you notify the person
 * attached to the thing that happened, not the thing itself — and stopping at
 * one level keeps the picker finite on a schema where everything eventually
 * points at everything.
 *
 * `hasMany` and `belongsToMany` are left out: they are not on the instance, and
 * a step that needs the children has `data.find` for it.
 */
export function collectionOutputFields(name, depth = 1) {
    var _a, _b;
    const collection = getCollection(name);
    if (!collection)
        return [];
    const fields = [{ key: 'id', label: 'ID', type: 'number' }];
    for (const field of (_a = collection.fields) !== null && _a !== void 0 ? _a : []) {
        if (field.type === 'hasMany' || field.type === 'belongsToMany')
            continue;
        const entry = {
            key: field.name,
            label: field.label || humanize(field.name),
            type: outputType(field),
        };
        if (field.type === 'relation' && ((_b = field.relation) === null || _b === void 0 ? void 0 : _b.collection)) {
            entry.collection = field.relation.collection;
            if (depth > 0) {
                // The related record hangs off the foreign key itself, so
                // `{{record.customer_id.email}}` would be the honest path — and
                // nobody would ever write it. The relation is therefore also
                // exposed under its bare name.
                const related = collectionOutputFields(field.relation.collection, depth - 1);
                if (related.length > 0) {
                    fields.push({
                        key: relationKey(field.name),
                        label: field.label || humanize(field.name),
                        type: 'object',
                        collection: field.relation.collection,
                        fields: related,
                    });
                }
            }
        }
        fields.push(entry);
    }
    fields.push({ key: 'created_at', label: 'Created at', type: 'date' }, { key: 'updated_at', label: 'Updated at', type: 'date' });
    // `id` and the timestamps are added whether or not the collection declares
    // them; a collection that does would otherwise offer each of them twice in
    // every picker, with no way to tell the two entries apart.
    const seen = new Set();
    return fields.filter((field) => {
        if (seen.has(field.key))
            return false;
        seen.add(field.key);
        return true;
    });
}
/** `customer_id` → `customer`; anything else is left alone. */
export function relationKey(fieldName) {
    return fieldName.endsWith('_id') ? fieldName.slice(0, -3) : `${fieldName}_record`;
}
/**
 * The dates of a collection, as options for a picker.
 *
 * Two sources, and the second one matters: a project is free to give a date
 * column a form widget of its own — DARWAEMAR fills `appointments.starts_at`
 * with a slot picker rather than a calendar — and reading the admin `type`
 * alone would hide the single most useful date in the schema behind the fact
 * that it is entered in an unusual way. The column's own Sequelize type is the
 * honest answer, so the declared fields are completed with it.
 */
export function dateFieldOptions(name) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const collection = getCollection(name);
    if (!collection)
        return [];
    const declared = new Map(((_a = collection.fields) !== null && _a !== void 0 ? _a : []).map((field) => [field.name, field]));
    const options = [];
    const seen = new Set();
    const add = (key, label) => {
        var _a;
        if (seen.has(key))
            return;
        seen.add(key);
        options.push({ value: key, label: label || ((_a = declared.get(key)) === null || _a === void 0 ? void 0 : _a.label) || humanize(key) });
    };
    for (const field of (_b = collection.fields) !== null && _b !== void 0 ? _b : []) {
        if (field.type === 'date' || field.type === 'datetime')
            add(field.name);
    }
    const model = getModel(name);
    const attributes = (_e = (_d = (_c = model === null || model === void 0 ? void 0 : model.getAttributes) === null || _c === void 0 ? void 0 : _c.call(model)) !== null && _d !== void 0 ? _d : model === null || model === void 0 ? void 0 : model.rawAttributes) !== null && _e !== void 0 ? _e : {};
    for (const [key, attribute] of Object.entries(attributes)) {
        const type = String((_h = (_g = (_f = attribute === null || attribute === void 0 ? void 0 : attribute.type) === null || _f === void 0 ? void 0 : _f.key) !== null && _g !== void 0 ? _g : attribute === null || attribute === void 0 ? void 0 : attribute.type) !== null && _h !== void 0 ? _h : '').toUpperCase();
        if (type.startsWith('DATE'))
            add(key);
    }
    // Always offered, even on a model that declares neither: the timestamps are
    // there, and "created more than three days ago" is half of what these
    // triggers get used for.
    add('created_at', 'Created at');
    add('updated_at', 'Updated at');
    return options;
}
/** The same, as the field definitions themselves — declared ones only. */
export function dateFields(name) {
    var _a;
    const collection = getCollection(name);
    if (!collection)
        return [];
    return ((_a = collection.fields) !== null && _a !== void 0 ? _a : []).filter((f) => f.type === 'date' || f.type === 'datetime');
}
// ─── Hydration ────────────────────────────────────────────────────────────
/**
 * Turns a model instance into the plain object templates read.
 *
 * Two things happen here that matter downstream: Dates and Decimals become
 * values JSON can hold (a run row is JSON, and a run that cannot be written is
 * a run that cannot be read back), and each relation is loaded once and exposed
 * under its bare name.
 */
export function hydrateRecord(collectionName, instance) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (!instance)
            return {};
        const plain = typeof instance.get === 'function' ? instance.get({ plain: true }) : Object.assign({}, instance);
        const record = {};
        for (const [key, value] of Object.entries(plain)) {
            record[key] = normalize(value);
        }
        if (!collectionName)
            return record;
        const collection = getCollection(collectionName);
        if (!collection)
            return record;
        for (const field of (_a = collection.fields) !== null && _a !== void 0 ? _a : []) {
            if (field.type !== 'relation' || !((_b = field.relation) === null || _b === void 0 ? void 0 : _b.collection))
                continue;
            const foreignKey = plain[field.name];
            if (foreignKey === null || foreignKey === undefined)
                continue;
            const key = relationKey(field.name);
            // Already included by the caller's query — no reason to ask again.
            if (plain[key] && typeof plain[key] === 'object') {
                record[key] = normalizeAll(plain[key]);
                continue;
            }
            const relatedModel = getModel(field.relation.collection);
            if (!relatedModel)
                continue;
            try {
                const related = yield relatedModel.findByPk(foreignKey);
                record[key] = related ? normalizeAll(related.get({ plain: true })) : null;
            }
            catch (_c) {
                // A broken relation is not a reason to lose the whole run; the
                // template resolves to an empty string and the step log says so.
                record[key] = null;
            }
        }
        return record;
    });
}
function normalize(value) {
    if (value instanceof Date)
        return value.toISOString();
    if (value && typeof value === 'object' && typeof value.toJSON === 'function') {
        return value.toJSON();
    }
    // Sequelize DECIMAL arrives as a string; a template that compares it to a
    // number would silently take the wrong branch.
    if (typeof value === 'string' && /^-?\d+\.\d+$/.test(value)) {
        const asNumber = Number(value);
        return Number.isFinite(asNumber) ? asNumber : value;
    }
    return value;
}
function normalizeAll(source) {
    const out = {};
    for (const [key, value] of Object.entries(source || {}))
        out[key] = normalize(value);
    return out;
}
