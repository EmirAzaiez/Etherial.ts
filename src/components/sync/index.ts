import etherial from '../../index.js'
import { AsyncLocalStorage } from 'async_hooks'
import { Op } from 'sequelize'

import { runExclusive } from '../database/lock.js'
import { ExternalSync, ExternalSyncTarget, SyncStatus, setExternalLinker } from './models.js'

export { ExternalSync, ExternalSyncTarget, SyncStatus } from './models.js'
export { registerSyncAdmin, SYNCS_COLLECTION, SYNC_TARGETS_COLLECTION } from './admin.js'

/**
 * Sending our records to an outside system (a Case to Salesforce…), when we
 * are the master and the other side only gets a copy.
 *
 * The project writes the send — what to create or update over there, with its
 * own client — and a leaf registers it as a target. This decides when: after
 * the commit of each create and update, then retries at 1 min, 5 min, 30 min,
 * 2 h and 6 h, after which the record is blocked until it changes again or
 * staff resend it. Only the last state goes out, with the fields changed
 * since the last success, and never twice at once for the same record, across
 * servers. Each record's place lives in `external_syncs`, shown in the
 * back-office with its error, a Resend button and a pause per target.
 *
 *     registerSync('cases', {
 *         model: 'Case',
 *         label: 'Salesforce',
 *         send: async (ticket, { externalId, changes, remember }) => { … return { externalId: id } },
 *         link: (id) => `https://example.my.salesforce.com/${id}`,
 *     })
 *
 * Nothing is registered, nothing is created: no table, no timer.
 */

export interface SyncContext {
    /** The copy's id over there; null on the first send, which creates it. */
    externalId: string | null
    /** The fields changed since the last success; [] when staff resend it. */
    changes: string[]
    /** 1 on the first try of this state, 2 on the first retry… */
    attempt: number
    /**
     * Keeps the copy's id right away, before the rest of the send: a send
     * that creates the copy then fails further on finds it on the retry,
     * instead of creating a second one.
     */
    remember(externalId: string): Promise<void>
}

export interface SyncResult {
    /** The copy's id over there; left out, the one known is kept. */
    externalId?: string | null
}

export interface TrackOptions {
    /** Only changes to these fields are sent (default: any field). */
    fields?: string[]
    /** Changes to these fields alone are not sent (timestamps never are). */
    ignore?: string[]
    /** Only records it accepts are sent, read after the commit. */
    when?: (record: any) => boolean
}

export interface SyncTarget<R = any> {
    /** The model sent: its name in Sequelize, or a function returning it. */
    model: string | (() => any)
    /**
     * Sends the record's whole current state. Throws on failure: the error
     * is kept and the send retried. It may save the record (the copy's id in
     * a column of its own): that save is not sent back.
     */
    send: (record: R, context: SyncContext) => Promise<SyncResult | void>
    /** The copy's address over there, for the back-office's link. */
    link?: (externalId: string) => string | null
    /** The outside system's name, for the back-office: "Salesforce". */
    label?: string
    /** Which saves are sent (default: every create and update); `false` sends only what the code queues. */
    track?: TrackOptions | false
}

/**
 * A leaf's `sync` option: the project's send, the leaf deciding which saves
 * go out. Without it, the leaf sends nothing.
 */
export interface LeafSync<R = any> {
    send: SyncTarget<R>['send']
    link?: SyncTarget<R>['link']
    /** The outside system's name, for the back-office: "Salesforce". */
    label?: string
}

export type SyncOutcome =
    | { status: SyncStatus; externalId?: string | null; error?: string }
    /** Another server is sending it, or it isn't due. */
    | { status: 'skipped' }
    | { status: 'paused' }

/** The waits after each failed try; one more failure than there are waits blocks it. */
export const SYNC_RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3600_000, 6 * 3600_000]
/** How long a server may send one record before another presumes it gone and takes over. */
const LOCK_MS = 5 * 60_000
const TICK_MS = 60_000
const BATCH = 50
const ERROR_LENGTH = 2000

const targets = new Map<string, SyncTarget>()
const tracked = new Set<string>()
const quiet = new AsyncLocalStorage<boolean>()
const changesOf = new WeakMap<object, string[]>()
let modelsAdded = false
let workerStarted = false
let targetsReady: Promise<void> | null = null

setExternalLinker((target, externalId) => targets.get(target)?.link?.(externalId) ?? null)

const sequelize = () => (etherial as any).database?.sequelize

/**
 * Declares a target. Called before the database runs (a leaf's beforeRun):
 * the first one hands it the sync tables.
 */
export function registerSync<R = any>(target: string, config: SyncTarget<R>): void {
    if (!/^[a-z0-9][a-z0-9:_-]{0,63}$/.test(target)) throw new Error(`[sync] Invalid target "${target}": lowercase letters, digits, - _ :`)
    if (typeof config?.send !== 'function') throw new Error(`[sync] ${target}: send is required`)
    if (!config.model) throw new Error(`[sync] ${target}: model is required`)
    targets.set(target, config)
    if (!modelsAdded) {
        const database = (etherial as any).database
        if (!database?.addModels) throw new Error('[sync] registerSync needs the database module')
        database.addModels([ExternalSync, ExternalSyncTarget])
        modelsAdded = true
    }
}

/** Whether `target` is registered: a leaf without its `sync` option sends nothing. */
export function hasSyncTarget(target: string): boolean {
    return targets.has(target)
}

export function syncTargets(): { target: string; label: string }[] {
    return [...targets].map(([target, config]) => ({ target, label: config.label || target }))
}

function modelOf(target: string): any {
    const config = targets.get(target)
    if (!config) throw new Error(`[sync] Unknown target "${target}"`)
    const model = typeof config.model === 'string' ? sequelize()?.models?.[config.model] : config.model()
    if (!model) throw new Error(`[sync] ${target}: model ${typeof config.model === 'string' ? config.model : ''} not found`)
    return model
}

/**
 * Runs `fn` without sending what it saves: the changes that came from the
 * outside system itself (Salesforce's own edits), which must not echo back.
 */
export function withoutSync<T>(fn: () => T): T {
    return quiet.run(true, fn)
}

const isQuiet = () => quiet.getStore() === true

/**
 * Sends `target`'s creates and updates once committed. `registerSync`'s
 * `track` does it for the leafs (`startSync`); a project calls it for a
 * target it registered with `track: false`. Saves passing `{ sync: false }`
 * and those inside `withoutSync` are not sent, nor bulk updates (no hooks).
 */
export function trackSync(target: string, options: TrackOptions = {}): void {
    if (tracked.has(target)) return
    const model = modelOf(target)
    const ignored = new Set([
        'created_at', 'updated_at', 'createdAt', 'updatedAt', 'deleted_at', 'deletedAt',
        ...Object.values<string>(model._timestampAttributes ?? {}),
        ...(options.ignore ?? []),
    ])
    const only = options.fields ? new Set(options.fields) : null
    const name = `eth_sync:${target}`

    model.addHook('beforeSave', name, (record: any, saveOptions: any) => {
        if (saveOptions?.sync === false || isQuiet()) return
        let changed: string[] = record.changed() || []
        if (Array.isArray(saveOptions?.fields)) changed = changed.filter((field) => saveOptions.fields.includes(field))
        const fields = changed.filter((field) => !ignored.has(field) && (!only || only.has(field)))
        if (fields.length || record.isNewRecord) changesOf.set(record, fields)
    })
    model.addHook('afterSave', name, (record: any, saveOptions: any) => {
        const fields = changesOf.get(record)
        if (!fields) return
        changesOf.delete(record)
        const go = () => {
            try {
                if (options.when && !options.when(record)) return
            } catch (err: any) {
                return console.error(`[sync] ${target}: when() failed:`, err?.message || err)
            }
            enqueueSync(target, record.get(model.primaryKeyAttribute ?? 'id'), fields).catch((err: any) =>
                console.error(`[sync] ${target}: could not queue #${record.get(model.primaryKeyAttribute ?? 'id')}:`, err?.message || err)
            )
        }
        if (saveOptions?.transaction?.afterCommit) saveOptions.transaction.afterCommit(go)
        else go()
    })
    tracked.add(target)
}

const union = (a: string[] | null | undefined, b: string[]) => [...new Set([...(a ?? []), ...b])]

/**
 * Queues the record's current state, then tries it at once (unless
 * `attempt: false`). A record already queued keeps a single place: its
 * changes add up, its tries start over.
 */
export async function enqueueSync(target: string, recordId: string | number, changes: string[] = [], options: { attempt?: boolean } = {}): Promise<void> {
    if (!targets.has(target)) return
    const record_id = String(recordId)
    for (let round = 0; round < 5; round++) {
        const row = await ExternalSync.findOne({ where: { target, record_id } })
        if (!row) {
            const created = await ExternalSync.create({
                target,
                record_id,
                status: SyncStatus.PENDING,
                version: 1,
                changes: union(null, changes),
                attempts: 0,
                next_attempt_at: new Date(),
            } as any).then(
                () => true,
                (err: any) => {
                    // Queued by another save meanwhile: add to its place.
                    if (err?.name === 'SequelizeUniqueConstraintError') return false
                    throw err
                }
            )
            if (created) break
            continue
        }
        // Being sent: it stays with its sender, who sees the new version
        // when done and sends again.
        const sending = row.status === SyncStatus.SENDING
        const [updated] = await ExternalSync.update(
            {
                version: row.version + 1,
                changes: union(row.changes, changes),
                ...(sending ? {} : { status: SyncStatus.PENDING, attempts: 0, next_attempt_at: new Date() }),
            } as any,
            { where: { id: row.id, version: row.version } }
        )
        if (updated) break
    }
    if (options.attempt !== false) {
        attemptSync(target, record_id).catch((err: any) => console.error(`[sync] ${target} #${record_id}:`, err?.message || err))
    }
}

async function isPaused(target: string): Promise<boolean> {
    const row = await ExternalSyncTarget.findOne({ where: { target }, attributes: ['paused'] })
    return !!row?.paused
}

const dueWhere = (now: Date) => ({
    [Op.or]: [
        { status: [SyncStatus.PENDING, SyncStatus.FAILED], next_attempt_at: { [Op.lte]: now } },
        // Its sender is gone (a crash, a deploy): take over.
        { status: SyncStatus.SENDING, locked_until: { [Op.lt]: now } },
    ],
})

/**
 * Sends the record if it is due and no one else is sending it. Resolves
 * with where it stands; never throws for the send itself.
 */
export async function attemptSync(target: string, recordId: string | number): Promise<SyncOutcome> {
    const config = targets.get(target)
    if (!config) return { status: 'skipped' }
    if (await isPaused(target)) return { status: 'paused' }
    const record_id = String(recordId)

    // A change landing during a send is sent right after: a few rounds at most.
    for (let round = 0; round < 3; round++) {
        const now = new Date()
        const [claimed] = await ExternalSync.update(
            { status: SyncStatus.SENDING, locked_until: new Date(now.getTime() + LOCK_MS) } as any,
            { where: { target, record_id, ...dueWhere(now) } as any }
        )
        if (!claimed) return { status: 'skipped' }
        const row = await ExternalSync.findOne({ where: { target, record_id } })
        if (!row) return { status: 'skipped' }
        const outcome = await sendOnce(target, config, row)
        if (outcome !== 'again') return outcome
    }
    return { status: SyncStatus.PENDING }
}

function messageOf(err: any): string {
    const text = err?.message || (typeof err === 'string' ? err : JSON.stringify(err)) || 'Unknown error'
    return String(text).slice(0, ERROR_LENGTH)
}

async function sendOnce(target: string, config: SyncTarget, row: ExternalSync): Promise<SyncOutcome | 'again'> {
    let externalId = row.external_id
    let failure: any = null
    let missing = false
    try {
        const record = await modelOf(target).findByPk(row.record_id)
        if (!record) missing = true
        else {
            const result = await withoutSync(() =>
                config.send(record, {
                    externalId,
                    changes: row.changes ?? [],
                    attempt: row.attempts + 1,
                    remember: async (id: string) => {
                        externalId = String(id)
                        await ExternalSync.update({ external_id: externalId } as any, { where: { id: row.id } })
                    },
                })
            )
            if (result && result.externalId) externalId = String(result.externalId)
        }
    } catch (err) {
        failure = err ?? new Error('Unknown error')
    }

    const now = new Date()
    if (missing) {
        const error = 'The record no longer exists here'
        await ExternalSync.update(
            { status: SyncStatus.BLOCKED, last_error: error, next_attempt_at: null, locked_until: null } as any,
            { where: { id: row.id } }
        )
        return { status: SyncStatus.BLOCKED, externalId, error }
    }

    if (failure) {
        const error = messageOf(failure)
        const attempts = row.attempts + 1
        const blocked = attempts > SYNC_RETRY_DELAYS_MS.length
        const status = blocked ? SyncStatus.BLOCKED : SyncStatus.FAILED
        const [same] = await ExternalSync.update(
            {
                status,
                attempts,
                last_error: error,
                external_id: externalId,
                next_attempt_at: blocked ? null : new Date(now.getTime() + SYNC_RETRY_DELAYS_MS[attempts - 1]),
                locked_until: null,
            } as any,
            { where: { id: row.id, version: row.version } }
        )
        if (!same) {
            // A change came in during the send: its own tries start now.
            await ExternalSync.update(
                { status: SyncStatus.FAILED, attempts: 1, last_error: error, external_id: externalId, next_attempt_at: new Date(now.getTime() + SYNC_RETRY_DELAYS_MS[0]), locked_until: null } as any,
                { where: { id: row.id } }
            )
            console.warn(`[sync] ${target} #${row.record_id}: not sent, retried in a minute: ${error}`)
            return { status: SyncStatus.FAILED, externalId, error }
        }
        console.warn(`[sync] ${target} #${row.record_id}: try ${attempts} failed${blocked ? ', blocked' : ''}: ${error}`)
        if (blocked) alertBlocked(target, config, row, error)
        return { status, externalId, error }
    }

    const [same] = await ExternalSync.update(
        { status: SyncStatus.SYNCED, external_id: externalId, changes: [], attempts: 0, last_error: null, next_attempt_at: null, locked_until: null, synced_at: now } as any,
        { where: { id: row.id, version: row.version } }
    )
    if (same) return { status: SyncStatus.SYNCED, externalId }
    // Changed while it was being sent: the newer state goes out now.
    await ExternalSync.update(
        { status: SyncStatus.PENDING, external_id: externalId, attempts: 0, last_error: null, next_attempt_at: now, locked_until: null, synced_at: now } as any,
        { where: { id: row.id } }
    )
    return 'again'
}

function alertBlocked(target: string, config: SyncTarget, row: ExternalSync, error: string): void {
    const adminLeaf = (etherial as any).eth_admin_leaf
    if (!adminLeaf?.notify || !adminLeaf.getCollection?.('external-syncs')) return
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
        .catch(() => undefined)
}

/**
 * Sends the record again now from its current state, whatever its status
 * (staff's "Resend"): a blocked one gets its tries back, a synced one is sent
 * whole. Queues it first if it never was.
 */
export async function resendSync(target: string, recordId: string | number): Promise<SyncOutcome> {
    if (!targets.has(target)) return { status: 'skipped' }
    const record_id = String(recordId)
    const row = await ExternalSync.findOne({ where: { target, record_id } })
    if (!row) await enqueueSync(target, record_id, [], { attempt: false })
    else if (row.status !== SyncStatus.SENDING) {
        await ExternalSync.update(
            { status: SyncStatus.PENDING, attempts: 0, next_attempt_at: new Date(), locked_until: null } as any,
            { where: { id: row.id, status: { [Op.ne]: SyncStatus.SENDING } } as any }
        )
    }
    return attemptSync(target, record_id)
}

/** Where each of these records stands with `target`, by record id. */
export async function syncStatesOf(target: string, recordIds: (string | number)[]): Promise<Map<string, ExternalSync>> {
    if (!targets.has(target) || !recordIds.length) return new Map()
    const rows = await ExternalSync.findAll({ where: { target, record_id: recordIds.map(String) } })
    return new Map(rows.map((row) => [row.record_id, row]))
}

/** One row per target, for the back-office's pause switches. */
export function ensureSyncTargets(): Promise<void> {
    targetsReady ??= (async () => {
        for (const [target, config] of targets) {
            await ExternalSyncTarget.findOrCreate({ where: { target }, defaults: { target, label: config.label || target, paused: false } as any })
        }
    })().catch((err) => {
        targetsReady = null
        throw err
    })
    return targetsReady
}

async function tick(): Promise<void> {
    try {
        // One server a minute: each record is claimed anyway, a second one
        // would only read the same rows for nothing.
        await runExclusive('eth_sync.tick', { ttlMs: TICK_MS - 10_000, release: false }, async () => {
            await ensureSyncTargets()
            const paused = new Set((await ExternalSyncTarget.findAll({ where: { paused: true }, attributes: ['target'] })).map((row) => row.target))
            const active = [...targets.keys()].filter((target) => !paused.has(target))
            if (!active.length) return
            const due = await ExternalSync.findAll({
                where: { target: active, ...dueWhere(new Date()) } as any,
                order: [['next_attempt_at', 'ASC']],
                limit: BATCH,
                attributes: ['target', 'record_id'],
            })
            for (const row of due) await attemptSync(row.target, row.record_id)
        })
    } catch (err: any) {
        console.error('[sync] Could not send the queued records:', err?.message || err)
    }
}

/**
 * Lifecycle: run — hooks each registered target's saves and starts the
 * minute timer for retries. Any leaf may call it; it does it once.
 */
export function startSync(): void {
    if (!targets.size) return
    for (const [target, config] of targets) {
        if (config.track !== false) trackSync(target, config.track || {})
    }
    if (workerStarted) return
    workerStarted = true
    // Not at boot: the tables may not be synced yet.
    setInterval(tick, TICK_MS).unref?.()
}
