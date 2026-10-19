// ──────────────────────────────────────────────────────────────────────────
// Change history.
//
// Every write to a model the back-office shows is recorded with its author:
// the signed-in person when it comes through a request, `system` when nothing
// claims it (a cron job, a script), or whoever the code names with
// `withActor()` — Salesforce for a sync, say. The author travels with the
// async call chain (AsyncLocalStorage), so nothing has to pass it down.
//
// Sequelize hooks do the recording, so changes made outside the back-office
// (the app, a sync, a script) land in the same history. Bulk writes have no
// instance to read previous values from: the matching rows are read first, up
// to `bulkLimit`. Raw SQL is not seen.
//
// Recording never blocks or breaks a write: the row is inserted after the
// transaction commits (or right away without one), and a failure only prints.
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
import { AsyncLocalStorage } from 'async_hooks';
import etherial from 'etherial';
import { Op } from 'sequelize';
import { runExclusive } from '../../../components/database/lock.js';
import { AdminAuditLog } from '../models/AdminAuditLog.js';
export const AUDIT_COLLECTION = 'admin-audit';
/** Values stored in place of what must not be kept (secrets) or could not be (too long). */
export const MASKED = { __masked: true };
const MAX_VALUE_LENGTH = 20000;
const TIMESTAMP_FIELDS = ['created_at', 'updated_at', 'deleted_at', 'createdAt', 'updatedAt', 'deletedAt'];
const SECRET_NAME = /pass(word)?|secret|token|otp|api_?key|hash/i;
export function auditOptions(value) {
    if (!value)
        return null;
    return value === true ? {} : value;
}
const storage = new AsyncLocalStorage();
let adminPrefix = '/admin';
let displayField = 'email';
/**
 * Runs `fn` with `actor` as the author of every write it makes, awaited or
 * not. `source` says where the change came through (default: the actor type).
 *
 *     await withActor({ type: 'salesforce', label: 'Salesforce' }, () => syncProperties())
 */
export function withActor(actor, fn, source) {
    const parent = storage.getStore();
    return storage.run(Object.assign(Object.assign({}, parent), { actor, source: source !== null && source !== void 0 ? source : actor.type }), fn);
}
/** Runs `fn` with `meta` attached to every change it records. */
export function withAuditMeta(meta, fn) {
    const parent = storage.getStore();
    return storage.run(Object.assign(Object.assign({}, parent), { meta: Object.assign(Object.assign({}, parent === null || parent === void 0 ? void 0 : parent.meta), meta) }), fn);
}
function labelOf(user) {
    var _a, _b;
    if (!user)
        return null;
    const get = (key) => (typeof user.get === 'function' ? user.get(key) : user[key]);
    const name = [(_a = get('firstname')) !== null && _a !== void 0 ? _a : get('first_name'), (_b = get('lastname')) !== null && _b !== void 0 ? _b : get('last_name')].filter(Boolean).join(' ');
    const label = get(displayField) || name || get('name') || get('email') || get('username');
    return label ? String(label).slice(0, 255) : null;
}
/** The author of a write made now, and where it came through. */
export function currentActor() {
    var _a, _b, _c, _d, _e;
    const store = storage.getStore();
    const meta = (_a = store === null || store === void 0 ? void 0 : store.meta) !== null && _a !== void 0 ? _a : null;
    const req = store === null || store === void 0 ? void 0 : store.req;
    const user = req === null || req === void 0 ? void 0 : req.user;
    const userId = Number(typeof (user === null || user === void 0 ? void 0 : user.get) === 'function' ? user.get('id') : user === null || user === void 0 ? void 0 : user.id);
    const person = user && Number.isInteger(userId) ? { type: 'user', id: userId, label: labelOf(user) } : null;
    // An integration named by the code. The person whose request set it off,
    // if any, is kept: "Salesforce, when Sara opened her properties".
    if (store === null || store === void 0 ? void 0 : store.actor) {
        const triggered = person && store.actor.type !== 'user' ? { triggered_by: { id: person.id, label: person.label } } : null;
        return { actor: store.actor, source: (_b = store.source) !== null && _b !== void 0 ? _b : store.actor.type, meta: triggered ? Object.assign(Object.assign({}, meta), triggered) : meta };
    }
    if (!req)
        return { actor: { type: 'system' }, source: 'system', meta };
    const source = String((_d = (_c = req.originalUrl) !== null && _c !== void 0 ? _c : req.url) !== null && _d !== void 0 ? _d : '').startsWith(adminPrefix) ? 'back-office' : 'app';
    // A change the assistant prepared and the person confirmed: still theirs,
    // but the history says how it was made. Only the back-office sends it.
    const via = source === 'back-office' && ((_e = req.headers) === null || _e === void 0 ? void 0 : _e['x-admin-via']) === 'assistant' ? { via: 'assistant' } : null;
    return { actor: person !== null && person !== void 0 ? person : { type: 'guest' }, source, meta: via ? Object.assign(Object.assign({}, meta), via) : meta };
}
/**
 * Opens the context each request's writes are attributed in. The user is
 * read when a write happens, not here: authentication runs later, per route.
 */
export function auditContextMiddleware(config, prefix) {
    var _a;
    adminPrefix = prefix;
    displayField = (_a = config.usersDisplayField) !== null && _a !== void 0 ? _a : 'email';
    // Keeps what a middleware mounted earlier set (an integration's `withActor`).
    return (req, _res, next) => storage.run(Object.assign(Object.assign({}, storage.getStore()), { req }), next);
}
// ── What changed ──────────────────────────────────────────────────────────
/** A value as it is kept: JSON-safe, secrets masked, very long values cut. */
function stored(value, secret) {
    if (value === undefined || value === null)
        return null;
    if (secret)
        return MASKED;
    if (value instanceof Date)
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
    if (Buffer.isBuffer(value))
        return MASKED;
    if (typeof value === 'string') {
        return value.length > MAX_VALUE_LENGTH ? { __truncated: true, preview: value.slice(0, 200) } : value;
    }
    if (typeof value === 'object') {
        try {
            const json = JSON.stringify(value);
            return json.length > MAX_VALUE_LENGTH ? { __truncated: true, preview: json.slice(0, 200) } : JSON.parse(json);
        }
        catch (_a) {
            return MASKED;
        }
    }
    return value;
}
/** Same value for a person: `'12.50'` and `12.5`, a Date and its ISO string. */
function same(a, b) {
    if (a === b)
        return true;
    if (a === null || b === null)
        return false;
    if (typeof a !== 'object' && typeof b !== 'object') {
        const na = Number(a);
        const nb = Number(b);
        if (a !== '' && b !== '' && !Number.isNaN(na) && !Number.isNaN(nb))
            return na === nb;
        return String(a) === String(b);
    }
    return JSON.stringify(a) === JSON.stringify(b);
}
function recordIdOf(audit, row) {
    const id = (row === null || row === void 0 ? void 0 : row.get) ? row.get(audit.primaryKey) : row === null || row === void 0 ? void 0 : row[audit.primaryKey];
    return id === undefined || id === null ? null : String(id);
}
function attributesOf(audit) {
    var _a;
    return Object.keys((_a = audit.model.rawAttributes) !== null && _a !== void 0 ? _a : {}).filter((name) => !audit.ignored.has(name));
}
/** Every column with a value, as a create (`[null, value]`) or a delete (`[value, null]`). */
function snapshot(audit, row, side) {
    const changes = {};
    for (const name of attributesOf(audit)) {
        if (name === audit.primaryKey)
            continue;
        const value = stored(row.get ? row.get(name) : row[name], audit.secret.has(name));
        if (value === null)
            continue;
        changes[name] = side === 'after' ? [null, value] : [value, null];
    }
    return changes;
}
function diff(audit, before, after, fields) {
    var _a;
    const changes = {};
    for (const name of fields !== null && fields !== void 0 ? fields : attributesOf(audit)) {
        if (audit.ignored.has(name) || !(name in ((_a = audit.model.rawAttributes) !== null && _a !== void 0 ? _a : {})))
            continue;
        const read = (row) => ((row === null || row === void 0 ? void 0 : row.get) ? row.get(name) : row === null || row === void 0 ? void 0 : row[name]);
        const secret = audit.secret.has(name);
        const a = stored(read(before), false);
        const b = stored(read(after), false);
        if (same(a, b))
            continue;
        changes[name] = secret ? [MASKED, MASKED] : [a, b];
    }
    return changes;
}
function record(audit, entries, options) {
    const kept = entries.filter((e) => e.recordId && Object.keys(e.changes).length > 0);
    if (kept.length === 0)
        return;
    const { actor, source, meta } = currentActor();
    const rows = kept.map((e) => {
        var _a;
        return ({
            collection: audit.collection,
            model: audit.model.name,
            record_id: e.recordId,
            action: e.action,
            changes: e.changes,
            actor_type: String(actor.type).slice(0, 32),
            actor_id: Number.isInteger(actor.id) ? actor.id : null,
            actor_label: (_a = actor.label) !== null && _a !== void 0 ? _a : null,
            source: source.slice(0, 32),
            meta,
        });
    });
    const write = () => {
        AdminAuditLog.bulkCreate(rows).catch((err) => console.error('[ETHAdminLeaf] Audit:', (err === null || err === void 0 ? void 0 : err.message) || err));
    };
    const transaction = options === null || options === void 0 ? void 0 : options.transaction;
    if (transaction && typeof transaction.afterCommit === 'function')
        transaction.afterCommit(write);
    else
        write();
}
/** A where clause that finds the stored row `values` would land on, if it can tell. */
function matchOf(audit, values, conflictFields) {
    var _a, _b, _c;
    const read = (name) => ((values === null || values === void 0 ? void 0 : values.get) ? values.get(name) : values === null || values === void 0 ? void 0 : values[name]);
    if (read(audit.primaryKey) !== undefined && read(audit.primaryKey) !== null) {
        return { [audit.primaryKey]: read(audit.primaryKey) };
    }
    const candidates = [];
    if (conflictFields === null || conflictFields === void 0 ? void 0 : conflictFields.length)
        candidates.push(conflictFields);
    for (const key of Object.values((_a = audit.model.uniqueKeys) !== null && _a !== void 0 ? _a : {}))
        if ((_b = key === null || key === void 0 ? void 0 : key.fields) === null || _b === void 0 ? void 0 : _b.length)
            candidates.push(key.fields);
    for (const [name, attr] of Object.entries((_c = audit.model.rawAttributes) !== null && _c !== void 0 ? _c : {}))
        if (attr === null || attr === void 0 ? void 0 : attr.unique)
            candidates.push([name]);
    for (const fields of candidates) {
        if (fields.every((f) => read(f) !== undefined && read(f) !== null)) {
            return Object.fromEntries(fields.map((f) => [f, read(f)]));
        }
    }
    return null;
}
const BEFORE = Symbol('ethAuditBefore');
const warned = new Set();
function warnLimit(audit, limit) {
    if (warned.has(audit.model.name))
        return;
    warned.add(audit.model.name);
    console.warn(`[ETHAdminLeaf] Audit: a bulk write on ${audit.model.name} touched more than ${limit} rows; only the first ${limit} are recorded`);
}
function readBefore(audit, where, options, limit) {
    return __awaiter(this, void 0, void 0, function* () {
        const rows = yield audit.model.unscoped().findAll({ where, limit: limit + 1, transaction: options === null || options === void 0 ? void 0 : options.transaction, hooks: false });
        if (rows.length > limit) {
            warnLimit(audit, limit);
            rows.length = limit;
        }
        return rows;
    });
}
function attach(audit, limit) {
    const model = audit.model;
    const name = 'eth-admin-audit';
    const safe = (fn) => (...args) => __awaiter(this, void 0, void 0, function* () {
        try {
            yield fn(...args);
        }
        catch (err) {
            console.error(`[ETHAdminLeaf] Audit (${model.name}):`, (err === null || err === void 0 ? void 0 : err.message) || err);
        }
    });
    model.addHook('afterCreate', name, safe((instance, options) => {
        record(audit, [{ action: 'create', recordId: recordIdOf(audit, instance), changes: snapshot(audit, instance, 'after') }], options);
    }));
    model.addHook('afterUpdate', name, safe((instance, options) => {
        var _a, _b;
        const fields = (_b = (_a = options === null || options === void 0 ? void 0 : options.fields) !== null && _a !== void 0 ? _a : instance.changed()) !== null && _b !== void 0 ? _b : [];
        const previous = Object.fromEntries(fields.map((f) => [f, instance.previous(f)]));
        record(audit, [{ action: 'update', recordId: recordIdOf(audit, instance), changes: diff(audit, previous, instance, fields) }], options);
    }));
    model.addHook('afterDestroy', name, safe((instance, options) => {
        record(audit, [{ action: 'delete', recordId: recordIdOf(audit, instance), changes: snapshot(audit, instance, 'before') }], options);
    }));
    model.addHook('afterRestore', name, safe((instance, options) => {
        record(audit, [{ action: 'restore', recordId: recordIdOf(audit, instance), changes: snapshot(audit, instance, 'after') }], options);
    }));
    // Model.update / Model.destroy without individualHooks: read the rows first.
    model.addHook('beforeBulkUpdate', name, safe((options) => __awaiter(this, void 0, void 0, function* () {
        if (options.individualHooks)
            return;
        options[BEFORE] = yield readBefore(audit, options.where, options, limit);
    })));
    model.addHook('afterBulkUpdate', name, safe((options) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const before = options[BEFORE];
        if (!(before === null || before === void 0 ? void 0 : before.length))
            return;
        const fields = Object.keys((_a = options.attributes) !== null && _a !== void 0 ? _a : {});
        const ids = before.map((row) => row.get(audit.primaryKey));
        const after = yield model.unscoped().findAll({ where: { [audit.primaryKey]: { [Op.in]: ids } }, transaction: options.transaction, hooks: false });
        const byId = new Map(after.map((row) => [String(row.get(audit.primaryKey)), row]));
        record(audit, before.map((row) => {
            const id = recordIdOf(audit, row);
            return { action: 'update', recordId: id, changes: diff(audit, row, byId.get(id), fields) };
        }), options);
    })));
    model.addHook('beforeBulkDestroy', name, safe((options) => __awaiter(this, void 0, void 0, function* () {
        if (options.individualHooks)
            return;
        options[BEFORE] = yield readBefore(audit, options.where, options, limit);
    })));
    model.addHook('afterBulkDestroy', name, safe((options) => {
        const before = options[BEFORE];
        if (!(before === null || before === void 0 ? void 0 : before.length))
            return;
        record(audit, before.map((row) => ({ action: 'delete', recordId: recordIdOf(audit, row), changes: snapshot(audit, row, 'before') })), options);
    }));
    // bulkCreate with updateOnDuplicate updates the rows it collides with.
    model.addHook('beforeBulkCreate', name, safe((instances, options) => __awaiter(this, void 0, void 0, function* () {
        if (options.individualHooks || !options.updateOnDuplicate)
            return;
        const matches = instances.slice(0, limit).map((i) => matchOf(audit, i, options.conflictAttributes)).filter(Boolean);
        if (instances.length > limit)
            warnLimit(audit, limit);
        options[BEFORE] = matches.length
            ? yield model.unscoped().findAll({ where: { [Op.or]: matches }, transaction: options.transaction, hooks: false })
            : [];
    })));
    model.addHook('afterBulkCreate', name, safe((instances, options) => {
        var _a;
        if (options.individualHooks)
            return;
        const before = (_a = options[BEFORE]) !== null && _a !== void 0 ? _a : [];
        const byId = new Map(before.map((row) => [recordIdOf(audit, row), row]));
        const fields = Array.isArray(options.updateOnDuplicate) ? options.updateOnDuplicate : undefined;
        record(audit, instances.slice(0, limit).map((instance) => {
            const id = recordIdOf(audit, instance);
            const previous = id ? byId.get(id) : undefined;
            return previous
                ? { action: 'update', recordId: id, changes: diff(audit, previous, instance, fields) }
                : { action: 'create', recordId: id, changes: snapshot(audit, instance, 'after') };
        }), options);
    }));
    model.addHook('beforeUpsert', name, safe((values, options) => __awaiter(this, void 0, void 0, function* () {
        const where = matchOf(audit, values, options.conflictFields);
        options[BEFORE] = where ? yield model.unscoped().findOne({ where, transaction: options.transaction, hooks: false }) : null;
    })));
    model.addHook('afterUpsert', name, safe((result, options) => {
        const [instance] = Array.isArray(result) ? result : [result];
        if (!instance)
            return;
        const previous = options[BEFORE];
        record(audit, [previous
                ? { action: 'update', recordId: recordIdOf(audit, instance), changes: diff(audit, previous, instance, options.fields) }
                : { action: 'create', recordId: recordIdOf(audit, instance), changes: snapshot(audit, instance, 'after') }], options);
    }));
}
// ── Wiring ────────────────────────────────────────────────────────────────
// Logs of their own, written in bulk: auditing them would double every write.
const LEAF_COLLECTIONS = new Set([AUDIT_COLLECTION, 'admin-logins', 'analytics-events', 'analytics-sessions']);
let auditedModels = new Map();
/**
 * Hooks every model the back-office shows, once each: a model listed in two
 * collections is recorded under the first. Returns the collections tracked.
 */
export function installAuditHooks(collections, config) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    const excluded = new Set((_a = config.exclude) !== null && _a !== void 0 ? _a : []);
    const limit = Math.max(1, (_b = config.bulkLimit) !== null && _b !== void 0 ? _b : 500);
    const tracked = [];
    for (const collection of collections) {
        const model = collection.model;
        if (!(model === null || model === void 0 ? void 0 : model.addHook) || LEAF_COLLECTIONS.has(collection.name) || excluded.has(collection.name))
            continue;
        tracked.push(collection.name);
        const existing = auditedModels.get(model);
        const secretFields = ((_c = collection.fields) !== null && _c !== void 0 ? _c : []).filter((f) => f.secure).map((f) => f.name);
        if (existing) {
            for (const f of secretFields)
                existing.secret.add(f);
            for (const f of (_e = (_d = config.ignore) === null || _d === void 0 ? void 0 : _d[collection.name]) !== null && _e !== void 0 ? _e : [])
                existing.ignored.add(f);
            continue;
        }
        const attributes = Object.keys((_f = model.rawAttributes) !== null && _f !== void 0 ? _f : {});
        const timestamps = Object.values((_g = model._timestampAttributes) !== null && _g !== void 0 ? _g : {});
        const audit = {
            model,
            collection: collection.name,
            primaryKey: (_h = model.primaryKeyAttribute) !== null && _h !== void 0 ? _h : 'id',
            ignored: new Set([...TIMESTAMP_FIELDS, ...timestamps, ...((_j = config.ignoreFields) !== null && _j !== void 0 ? _j : []), ...((_l = (_k = config.ignore) === null || _k === void 0 ? void 0 : _k[collection.name]) !== null && _l !== void 0 ? _l : [])]),
            secret: new Set([...secretFields, ...attributes.filter((a) => SECRET_NAME.test(a))]),
        };
        auditedModels.set(model, audit);
        attach(audit, limit);
    }
    return tracked;
}
/**
 * Removes entries older than `retentionDays`, now and then once a day. Once a
 * day across all servers: the lease is kept for most of the day, so the boot
 * of a second server, or of the next deploy, does not purge again.
 */
export function scheduleAuditRetention(config) {
    const days = config.retentionDays;
    if (!days || days <= 0)
        return;
    const DAY = 24 * 3600 * 1000;
    const purge = () => {
        runExclusive('eth_admin.audit_retention', { ttlMs: DAY - 10 * 60 * 1000, release: false }, () => __awaiter(this, void 0, void 0, function* () {
            const cutoff = new Date(Date.now() - days * DAY);
            yield AdminAuditLog.destroy({ where: { created_at: { [Op.lt]: cutoff } } });
        })).catch((err) => console.error('[ETHAdminLeaf] Audit retention:', (err === null || err === void 0 ? void 0 : err.message) || err));
    };
    purge();
    setInterval(purge, DAY).unref();
}
/** Joins entries to the user model so the change list names the author. */
export function linkAuditToUsers(config) {
    var _a, _b, _c, _d, _e;
    const models = (_c = (_b = (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize) === null || _b === void 0 ? void 0 : _b.models) !== null && _c !== void 0 ? _c : {};
    const User = models[(_d = config.userModel) !== null && _d !== void 0 ? _d : 'User'];
    if (!User)
        return false;
    if (!((_e = AdminAuditLog.associations) === null || _e === void 0 ? void 0 : _e.actor)) {
        AdminAuditLog.belongsTo(User, { foreignKey: 'actor_id', as: 'actor', constraints: false });
    }
    return true;
}
/** The model, collection and secrets for a collection's records, when they are tracked. */
export function auditOf(collection) {
    return (collection === null || collection === void 0 ? void 0 : collection.model) ? auditedModels.get(collection.model) : undefined;
}
/** The read-only collection listing every recorded change. */
export function auditCollection(config, tracked, hasUsers, linked) {
    var _a, _b;
    const usersCollection = (_a = config.usersCollection) !== null && _a !== void 0 ? _a : 'users';
    const userField = (_b = config.usersDisplayField) !== null && _b !== void 0 ? _b : 'email';
    const include = linked ? [{ association: 'actor', attributes: ['id', userField] }] : [];
    const ACTIONS = [
        { value: 'create', label: 'Created', color: 'green' },
        { value: 'update', label: 'Edited', color: 'blue' },
        { value: 'delete', label: 'Deleted', color: 'red' },
        { value: 'restore', label: 'Restored', color: 'purple' },
    ];
    return {
        name: AUDIT_COLLECTION,
        model: AdminAuditLog,
        crud: ['list', 'show'],
        exportable: true,
        meta: {
            label: 'Change',
            labelPlural: 'Change history',
            icon: 'History',
            description: 'Every change to a record, who made it and what it was before',
            group: 'System',
            order: 96,
        },
        fields: [
            { name: 'id', type: 'integer', readonly: true, sortable: true },
            { name: 'action', type: 'select', label: 'Change', filterable: true, options: ACTIONS },
            {
                name: 'collection',
                type: 'select',
                label: 'Collection',
                filterable: true,
                options: tracked.map((name) => ({ value: name, label: name })),
            },
            { name: 'record_id', type: 'string', label: 'Record', searchable: true },
            {
                name: 'actor_type',
                type: 'select',
                label: 'By',
                filterable: true,
                options: [
                    { value: 'user', label: 'A person', color: 'blue' },
                    { value: 'salesforce', label: 'Salesforce', color: 'purple' },
                    { value: 'system', label: 'System', color: 'gray' },
                    { value: 'guest', label: 'Signed-out visitor', color: 'gray' },
                ],
            },
            hasUsers
                ? { name: 'actor_id', type: 'relation', label: 'Person', filterable: true, relation: { collection: usersCollection, displayField: userField } }
                : { name: 'actor_id', type: 'integer', label: 'Person', filterable: true },
            { name: 'actor_label', type: 'string', label: 'Author', searchable: true },
            {
                name: 'source',
                type: 'select',
                label: 'Through',
                filterable: true,
                options: [
                    { value: 'back-office', label: 'Back office' },
                    { value: 'app', label: 'App' },
                    { value: 'salesforce', label: 'Salesforce' },
                    { value: 'system', label: 'System' },
                ],
            },
            { name: 'changes', type: 'json', label: 'Changes', readonly: true },
            { name: 'meta', type: 'json', label: 'Context', readonly: true },
            { name: 'created_at', type: 'datetime', label: 'Date', readonly: true, sortable: true, filterable: true },
        ],
        views: {
            list: {
                fields: ['created_at', 'action', 'collection', 'record_id', 'actor_label', 'source'],
                sort: { field: 'created_at', direction: 'desc' },
                search: ['record_id', 'actor_label'],
                filters: ['action', 'collection', 'actor_type', 'source', 'actor_id', 'created_at'],
                include,
            },
            show: {
                layout: 'sections',
                sections: [
                    { title: 'Change', fields: ['action', 'collection', 'record_id', 'created_at'] },
                    { title: 'Author', fields: ['actor_type', 'actor_id', 'actor_label', 'source'] },
                    { title: 'Details', fields: ['changes', 'meta'] },
                ],
                include,
            },
        },
    };
}
