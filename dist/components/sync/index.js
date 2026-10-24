var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import etherial from '../../index.js';
import { AsyncLocalStorage } from 'async_hooks';
import { Op } from 'sequelize';
import { runExclusive } from '../database/lock.js';
import { ExternalSync, ExternalSyncTarget, SyncStatus, setExternalLinker } from './models.js';
export { ExternalSync, ExternalSyncTarget, SyncStatus } from './models.js';
export { registerSyncAdmin, SYNCS_COLLECTION, SYNC_TARGETS_COLLECTION } from './admin.js';
/** The waits after each failed try; one more failure than there are waits blocks it. */
export const SYNC_RETRY_DELAYS_MS = [60000, 5 * 60000, 30 * 60000, 2 * 3600000, 6 * 3600000];
/** How long a server may send one record before another presumes it gone and takes over. */
const LOCK_MS = 5 * 60000;
const TICK_MS = 60000;
const BATCH = 50;
const ERROR_LENGTH = 2000;
const targets = new Map();
const tracked = new Set();
const quiet = new AsyncLocalStorage();
const changesOf = new WeakMap();
let modelsAdded = false;
let workerStarted = false;
let targetsReady = null;
setExternalLinker((target, externalId) => { var _a, _b, _c; return (_c = (_b = (_a = targets.get(target)) === null || _a === void 0 ? void 0 : _a.link) === null || _b === void 0 ? void 0 : _b.call(_a, externalId)) !== null && _c !== void 0 ? _c : null; });
const sequelize = () => { var _a; return (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize; };
/**
 * Declares a target. Called before the database runs (a leaf's beforeRun):
 * the first one hands it the sync tables.
 */
export function registerSync(target, config) {
    if (!/^[a-z0-9][a-z0-9:_-]{0,63}$/.test(target))
        throw new Error(`[sync] Invalid target "${target}": lowercase letters, digits, - _ :`);
    if (typeof (config === null || config === void 0 ? void 0 : config.send) !== 'function')
        throw new Error(`[sync] ${target}: send is required`);
    if (!config.model)
        throw new Error(`[sync] ${target}: model is required`);
    targets.set(target, config);
    if (!modelsAdded) {
        const database = etherial.database;
        if (!(database === null || database === void 0 ? void 0 : database.addModels))
            throw new Error('[sync] registerSync needs the database module');
        database.addModels([ExternalSync, ExternalSyncTarget]);
        modelsAdded = true;
    }
}
/** Whether `target` is registered: a leaf without its `sync` option sends nothing. */
export function hasSyncTarget(target) {
    return targets.has(target);
}
export function syncTargets() {
    return [...targets].map(([target, config]) => ({ target, label: config.label || target }));
}
function modelOf(target) {
    var _a, _b;
    const config = targets.get(target);
    if (!config)
        throw new Error(`[sync] Unknown target "${target}"`);
    const model = typeof config.model === 'string' ? (_b = (_a = sequelize()) === null || _a === void 0 ? void 0 : _a.models) === null || _b === void 0 ? void 0 : _b[config.model] : config.model();
    if (!model)
        throw new Error(`[sync] ${target}: model ${typeof config.model === 'string' ? config.model : ''} not found`);
    return model;
}
/**
 * Runs `fn` without sending what it saves: the changes that came from the
 * outside system itself (Salesforce's own edits), which must not echo back.
 */
export function withoutSync(fn) {
    return quiet.run(true, fn);
}
const isQuiet = () => quiet.getStore() === true;
/**
 * Sends `target`'s creates and updates once committed. `registerSync`'s
 * `track` does it for the leafs (`startSync`); a project calls it for a
 * target it registered with `track: false`. Saves passing `{ sync: false }`
 * and those inside `withoutSync` are not sent, nor bulk updates (no hooks).
 */
export function trackSync(target, options = {}) {
    var _a, _b;
    if (tracked.has(target))
        return;
    const model = modelOf(target);
    const ignored = new Set([
        'created_at', 'updated_at', 'createdAt', 'updatedAt', 'deleted_at', 'deletedAt',
        ...Object.values((_a = model._timestampAttributes) !== null && _a !== void 0 ? _a : {}),
        ...((_b = options.ignore) !== null && _b !== void 0 ? _b : []),
    ]);
    const only = options.fields ? new Set(options.fields) : null;
    const name = `eth_sync:${target}`;
    model.addHook('beforeSave', name, (record, saveOptions) => {
        if ((saveOptions === null || saveOptions === void 0 ? void 0 : saveOptions.sync) === false || isQuiet())
            return;
        let changed = record.changed() || [];
        if (Array.isArray(saveOptions === null || saveOptions === void 0 ? void 0 : saveOptions.fields))
            changed = changed.filter((field) => saveOptions.fields.includes(field));
        const fields = changed.filter((field) => !ignored.has(field) && (!only || only.has(field)));
        if (fields.length || record.isNewRecord)
            changesOf.set(record, fields);
    });
    model.addHook('afterSave', name, (record, saveOptions) => {
        var _a;
        const fields = changesOf.get(record);
        if (!fields)
            return;
        changesOf.delete(record);
        const go = () => {
            var _a;
            try {
                if (options.when && !options.when(record))
                    return;
            }
            catch (err) {
                return console.error(`[sync] ${target}: when() failed:`, (err === null || err === void 0 ? void 0 : err.message) || err);
            }
            enqueueSync(target, record.get((_a = model.primaryKeyAttribute) !== null && _a !== void 0 ? _a : 'id'), fields).catch((err) => { var _a; return console.error(`[sync] ${target}: could not queue #${record.get((_a = model.primaryKeyAttribute) !== null && _a !== void 0 ? _a : 'id')}:`, (err === null || err === void 0 ? void 0 : err.message) || err); });
        };
        if ((_a = saveOptions === null || saveOptions === void 0 ? void 0 : saveOptions.transaction) === null || _a === void 0 ? void 0 : _a.afterCommit)
            saveOptions.transaction.afterCommit(go);
        else
            go();
    });
    tracked.add(target);
}
const union = (a, b) => [...new Set([...(a !== null && a !== void 0 ? a : []), ...b])];
/**
 * Queues the record's current state, then tries it at once (unless
 * `attempt: false`). A record already queued keeps a single place: its
 * changes add up, its tries start over.
 */
export function enqueueSync(target_1, recordId_1) {
    return __awaiter(this, arguments, void 0, function* (target, recordId, changes = [], options = {}) {
        if (!targets.has(target))
            return;
        const record_id = String(recordId);
        for (let round = 0; round < 5; round++) {
            const row = yield ExternalSync.findOne({ where: { target, record_id } });
            if (!row) {
                const created = yield ExternalSync.create({
                    target,
                    record_id,
                    status: SyncStatus.PENDING,
                    version: 1,
                    changes: union(null, changes),
                    attempts: 0,
                    next_attempt_at: new Date(),
                }).then(() => true, (err) => {
                    // Queued by another save meanwhile: add to its place.
                    if ((err === null || err === void 0 ? void 0 : err.name) === 'SequelizeUniqueConstraintError')
                        return false;
                    throw err;
                });
                if (created)
                    break;
                continue;
            }
            // Being sent: it stays with its sender, who sees the new version
            // when done and sends again.
            const sending = row.status === SyncStatus.SENDING;
            const [updated] = yield ExternalSync.update(Object.assign({ version: row.version + 1, changes: union(row.changes, changes) }, (sending ? {} : { status: SyncStatus.PENDING, attempts: 0, next_attempt_at: new Date() })), { where: { id: row.id, version: row.version } });
            if (updated)
                break;
        }
        if (options.attempt !== false) {
            attemptSync(target, record_id).catch((err) => console.error(`[sync] ${target} #${record_id}:`, (err === null || err === void 0 ? void 0 : err.message) || err));
        }
    });
}
function isPaused(target) {
    return __awaiter(this, void 0, void 0, function* () {
        const row = yield ExternalSyncTarget.findOne({ where: { target }, attributes: ['paused'] });
        return !!(row === null || row === void 0 ? void 0 : row.paused);
    });
}
const dueWhere = (now) => ({
    [Op.or]: [
        { status: [SyncStatus.PENDING, SyncStatus.FAILED], next_attempt_at: { [Op.lte]: now } },
        // Its sender is gone (a crash, a deploy): take over.
        { status: SyncStatus.SENDING, locked_until: { [Op.lt]: now } },
    ],
});
/**
 * Sends the record if it is due and no one else is sending it. Resolves
 * with where it stands; never throws for the send itself.
 */
export function attemptSync(target, recordId) {
    return __awaiter(this, void 0, void 0, function* () {
        const config = targets.get(target);
        if (!config)
            return { status: 'skipped' };
        if (yield isPaused(target))
            return { status: 'paused' };
        const record_id = String(recordId);
        // A change landing during a send is sent right after: a few rounds at most.
        for (let round = 0; round < 3; round++) {
            const now = new Date();
            const [claimed] = yield ExternalSync.update({ status: SyncStatus.SENDING, locked_until: new Date(now.getTime() + LOCK_MS) }, { where: Object.assign({ target, record_id }, dueWhere(now)) });
            if (!claimed)
                return { status: 'skipped' };
            const row = yield ExternalSync.findOne({ where: { target, record_id } });
            if (!row)
                return { status: 'skipped' };
            const outcome = yield sendOnce(target, config, row);
            if (outcome !== 'again')
                return outcome;
        }
        return { status: SyncStatus.PENDING };
    });
}
function messageOf(err) {
    const text = (err === null || err === void 0 ? void 0 : err.message) || (typeof err === 'string' ? err : JSON.stringify(err)) || 'Unknown error';
    return String(text).slice(0, ERROR_LENGTH);
}
function sendOnce(target, config, row) {
    return __awaiter(this, void 0, void 0, function* () {
        let externalId = row.external_id;
        let failure = null;
        let missing = false;
        try {
            const record = yield modelOf(target).findByPk(row.record_id);
            if (!record)
                missing = true;
            else {
                const result = yield withoutSync(() => {
                    var _a;
                    return config.send(record, {
                        externalId,
                        changes: (_a = row.changes) !== null && _a !== void 0 ? _a : [],
                        attempt: row.attempts + 1,
                        remember: (id) => __awaiter(this, void 0, void 0, function* () {
                            externalId = String(id);
                            yield ExternalSync.update({ external_id: externalId }, { where: { id: row.id } });
                        }),
                    });
                });
                if (result && result.externalId)
                    externalId = String(result.externalId);
            }
        }
        catch (err) {
            failure = err !== null && err !== void 0 ? err : new Error('Unknown error');
        }
        const now = new Date();
        if (missing) {
            const error = 'The record no longer exists here';
            yield ExternalSync.update({ status: SyncStatus.BLOCKED, last_error: error, next_attempt_at: null, locked_until: null }, { where: { id: row.id } });
            return { status: SyncStatus.BLOCKED, externalId, error };
        }
        if (failure) {
            const error = messageOf(failure);
            const attempts = row.attempts + 1;
            const blocked = attempts > SYNC_RETRY_DELAYS_MS.length;
            const status = blocked ? SyncStatus.BLOCKED : SyncStatus.FAILED;
            const [same] = yield ExternalSync.update({
                status,
                attempts,
                last_error: error,
                external_id: externalId,
                next_attempt_at: blocked ? null : new Date(now.getTime() + SYNC_RETRY_DELAYS_MS[attempts - 1]),
                locked_until: null,
            }, { where: { id: row.id, version: row.version } });
            if (!same) {
                // A change came in during the send: its own tries start now.
                yield ExternalSync.update({ status: SyncStatus.FAILED, attempts: 1, last_error: error, external_id: externalId, next_attempt_at: new Date(now.getTime() + SYNC_RETRY_DELAYS_MS[0]), locked_until: null }, { where: { id: row.id } });
                console.warn(`[sync] ${target} #${row.record_id}: not sent, retried in a minute: ${error}`);
                return { status: SyncStatus.FAILED, externalId, error };
            }
            console.warn(`[sync] ${target} #${row.record_id}: try ${attempts} failed${blocked ? ', blocked' : ''}: ${error}`);
            if (blocked)
                alertBlocked(target, config, row, error);
            return { status, externalId, error };
        }
        const [same] = yield ExternalSync.update({ status: SyncStatus.SYNCED, external_id: externalId, changes: [], attempts: 0, last_error: null, next_attempt_at: null, locked_until: null, synced_at: now }, { where: { id: row.id, version: row.version } });
        if (same)
            return { status: SyncStatus.SYNCED, externalId };
        // Changed while it was being sent: the newer state goes out now.
        yield ExternalSync.update({ status: SyncStatus.PENDING, external_id: externalId, attempts: 0, last_error: null, next_attempt_at: now, locked_until: null, synced_at: now }, { where: { id: row.id } });
        return 'again';
    });
}
function alertBlocked(target, config, row, error) {
    var _a;
    const adminLeaf = etherial.eth_admin_leaf;
    if (!(adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.notify) || !((_a = adminLeaf.getCollection) === null || _a === void 0 ? void 0 : _a.call(adminLeaf, 'external-syncs')))
        return;
    adminLeaf
        .notify({
        to: { permission: { collection: 'external-syncs', permission: 'actions' } },
        type: 'sync',
        title: `Not sent to ${config.label || target}: ${target} #${row.record_id}`,
        body: error,
        link: `/external-syncs/${row.id}`,
        collection: 'external-syncs',
        recordId: row.id,
    })
        .catch(() => undefined);
}
/**
 * Sends the record again now from its current state, whatever its status
 * (staff's "Resend"): a blocked one gets its tries back, a synced one is sent
 * whole. Queues it first if it never was.
 */
export function resendSync(target, recordId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!targets.has(target))
            return { status: 'skipped' };
        const record_id = String(recordId);
        const row = yield ExternalSync.findOne({ where: { target, record_id } });
        if (!row)
            yield enqueueSync(target, record_id, [], { attempt: false });
        else if (row.status !== SyncStatus.SENDING) {
            yield ExternalSync.update({ status: SyncStatus.PENDING, attempts: 0, next_attempt_at: new Date(), locked_until: null }, { where: { id: row.id, status: { [Op.ne]: SyncStatus.SENDING } } });
        }
        return attemptSync(target, record_id);
    });
}
/** Where each of these records stands with `target`, by record id. */
export function syncStatesOf(target, recordIds) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!targets.has(target) || !recordIds.length)
            return new Map();
        const rows = yield ExternalSync.findAll({ where: { target, record_id: recordIds.map(String) } });
        return new Map(rows.map((row) => [row.record_id, row]));
    });
}
/** One row per target, for the back-office's pause switches. */
export function ensureSyncTargets() {
    targetsReady !== null && targetsReady !== void 0 ? targetsReady : (targetsReady = (() => __awaiter(this, void 0, void 0, function* () {
        for (const [target, config] of targets) {
            yield ExternalSyncTarget.findOrCreate({ where: { target }, defaults: { target, label: config.label || target, paused: false } });
        }
    }))().catch((err) => {
        targetsReady = null;
        throw err;
    }));
    return targetsReady;
}
function tick() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // One server a minute: each record is claimed anyway, a second one
            // would only read the same rows for nothing.
            yield runExclusive('eth_sync.tick', { ttlMs: TICK_MS - 10000, release: false }, () => __awaiter(this, void 0, void 0, function* () {
                yield ensureSyncTargets();
                const paused = new Set((yield ExternalSyncTarget.findAll({ where: { paused: true }, attributes: ['target'] })).map((row) => row.target));
                const active = [...targets.keys()].filter((target) => !paused.has(target));
                if (!active.length)
                    return;
                const due = yield ExternalSync.findAll({
                    where: Object.assign({ target: active }, dueWhere(new Date())),
                    order: [['next_attempt_at', 'ASC']],
                    limit: BATCH,
                    attributes: ['target', 'record_id'],
                });
                for (const row of due)
                    yield attemptSync(row.target, row.record_id);
            }));
        }
        catch (err) {
            console.error('[sync] Could not send the queued records:', (err === null || err === void 0 ? void 0 : err.message) || err);
        }
    });
}
/**
 * Lifecycle: run — hooks each registered target's saves and starts the
 * minute timer for retries. Any leaf may call it; it does it once.
 */
export function startSync() {
    var _a, _b;
    if (!targets.size)
        return;
    for (const [target, config] of targets) {
        if (config.track !== false)
            trackSync(target, config.track || {});
    }
    if (workerStarted)
        return;
    workerStarted = true;
    // Not at boot: the tables may not be synced yet.
    (_b = (_a = setInterval(tick, TICK_MS)).unref) === null || _b === void 0 ? void 0 : _b.call(_a);
}
