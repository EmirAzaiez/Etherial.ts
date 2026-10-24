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

import { AsyncLocalStorage } from 'async_hooks'
import etherial from 'etherial'
import { Op } from 'sequelize'
import type { Request, Response, NextFunction } from 'express'
import { runExclusive } from '../../../components/database/lock.js'
import { AdminAuditLog } from '../models/AdminAuditLog.js'
import type { CollectionConfig } from './CollectionConfig.js'

export interface AuditActor {
    /** `user` for a person, `salesforce`, `system`, or any name an integration gives itself. */
    type: string
    id?: number | null
    /** Shown in the history. Defaults to the type for non-users, the account's email for users. */
    label?: string | null
}

export interface AuditConfig {
    /** Collections not tracked (by name). The leaf's own journals never are. */
    exclude?: string[]
    /** Columns never recorded, on every model. Timestamps always are left out. */
    ignoreFields?: string[]
    /** Columns never recorded for one collection, e.g. `{ properties: ['sf_synced_at'] }`. */
    ignore?: Record<string, string[]>
    /** Rows read before a bulk update or delete to keep their previous values. Default 500. */
    bulkLimit?: number
    /** Drop entries older than this many days, checked daily. Default: keep everything. */
    retentionDays?: number
    /** Collection a user author links to. Default `users`. */
    usersCollection?: string
    /** Field of the request's user shown as their name. Default `email`. */
    usersDisplayField?: string
    /** Sequelize model the author ids belong to, joined in the change list. Default `User`. */
    userModel?: string
}

export const AUDIT_COLLECTION = 'admin-audit'
/** Values stored in place of what must not be kept (secrets) or could not be (too long). */
export const MASKED = { __masked: true }
const MAX_VALUE_LENGTH = 20000

const TIMESTAMP_FIELDS = ['created_at', 'updated_at', 'deleted_at', 'createdAt', 'updatedAt', 'deletedAt']
const SECRET_NAME = /pass(word)?|secret|token|otp|api_?key|hash/i

export function auditOptions(value: boolean | AuditConfig | undefined): AuditConfig | null {
    if (!value) return null
    return value === true ? {} : value
}

// ── Who is writing ────────────────────────────────────────────────────────

interface AuditStore {
    actor?: AuditActor
    source?: string
    req?: any
    meta?: Record<string, unknown>
}

const storage = new AsyncLocalStorage<AuditStore>()
let adminPrefix = '/admin'
let displayField = 'email'

/**
 * Runs `fn` with `actor` as the author of every write it makes, awaited or
 * not. `source` says where the change came through (default: the actor type).
 *
 *     await withActor({ type: 'salesforce', label: 'Salesforce' }, () => syncProperties())
 */
export function withActor<T>(actor: AuditActor, fn: () => T, source?: string): T {
    const parent = storage.getStore()
    return storage.run({ ...parent, actor, source: source ?? actor.type }, fn)
}

/** Runs `fn` with `meta` attached to every change it records. */
export function withAuditMeta<T>(meta: Record<string, unknown>, fn: () => T): T {
    const parent = storage.getStore()
    return storage.run({ ...parent, meta: { ...parent?.meta, ...meta } }, fn)
}

function labelOf(user: any): string | null {
    if (!user) return null
    const get = (key: string) => (typeof user.get === 'function' ? user.get(key) : user[key])
    const name = [get('firstname') ?? get('first_name'), get('lastname') ?? get('last_name')].filter(Boolean).join(' ')
    const label = get(displayField) || name || get('name') || get('email') || get('username')
    return label ? String(label).slice(0, 255) : null
}

/** The author of a write made now, and where it came through. */
export function currentActor(): { actor: AuditActor; source: string; meta: Record<string, unknown> | null } {
    const store = storage.getStore()
    const meta = store?.meta ?? null
    const req = store?.req
    const user = req?.user
    const userId = Number(typeof user?.get === 'function' ? user.get('id') : user?.id)
    const person = user && Number.isInteger(userId) ? { type: 'user', id: userId, label: labelOf(user) } : null

    // An integration named by the code. The person whose request set it off,
    // if any, is kept: "Salesforce, when Sara opened her properties".
    if (store?.actor) {
        const triggered = person && store.actor.type !== 'user' ? { triggered_by: { id: person.id, label: person.label } } : null
        return { actor: store.actor, source: store.source ?? store.actor.type, meta: triggered ? { ...meta, ...triggered } : meta }
    }

    if (!req) return { actor: { type: 'system' }, source: 'system', meta }
    const source = String(req.originalUrl ?? req.url ?? '').startsWith(adminPrefix) ? 'back-office' : 'app'
    // A change the assistant prepared and the person confirmed: still theirs,
    // but the history says how it was made. Only the back-office sends it.
    const via = source === 'back-office' && req.headers?.['x-admin-via'] === 'assistant' ? { via: 'assistant' } : null
    return { actor: person ?? { type: 'guest' }, source, meta: via ? { ...meta, ...via } : meta }
}

/**
 * Opens the context each request's writes are attributed in. The user is
 * read when a write happens, not here: authentication runs later, per route.
 */
export function auditContextMiddleware(config: AuditConfig, prefix: string) {
    adminPrefix = prefix
    displayField = config.usersDisplayField ?? 'email'
    // Keeps what a middleware mounted earlier set (an integration's `withActor`).
    return (req: Request, _res: Response, next: NextFunction) => storage.run({ ...storage.getStore(), req }, next)
}

// ── What changed ──────────────────────────────────────────────────────────

/** A value as it is kept: JSON-safe, secrets masked, very long values cut. */
function stored(value: unknown, secret: boolean): unknown {
    if (value === undefined || value === null) return null
    if (secret) return MASKED
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
    if (Buffer.isBuffer(value)) return MASKED
    if (typeof value === 'string') {
        return value.length > MAX_VALUE_LENGTH ? { __truncated: true, preview: value.slice(0, 200) } : value
    }
    if (typeof value === 'object') {
        try {
            const json = JSON.stringify(value)
            return json.length > MAX_VALUE_LENGTH ? { __truncated: true, preview: json.slice(0, 200) } : JSON.parse(json)
        } catch {
            return MASKED
        }
    }
    return value
}

/** Same value for a person: `'12.50'` and `12.5`, a Date and its ISO string. */
function same(a: unknown, b: unknown): boolean {
    if (a === b) return true
    if (a === null || b === null) return false
    if (typeof a !== 'object' && typeof b !== 'object') {
        const na = Number(a)
        const nb = Number(b)
        if (a !== '' && b !== '' && !Number.isNaN(na) && !Number.isNaN(nb)) return na === nb
        return String(a) === String(b)
    }
    return JSON.stringify(a) === JSON.stringify(b)
}

interface ModelAudit {
    model: any
    collection: string
    ignored: Set<string>
    secret: Set<string>
    primaryKey: string
}

function recordIdOf(audit: ModelAudit, row: any): string | null {
    const id = row?.get ? row.get(audit.primaryKey) : row?.[audit.primaryKey]
    return id === undefined || id === null ? null : String(id)
}

function attributesOf(audit: ModelAudit): string[] {
    return Object.keys(audit.model.rawAttributes ?? {}).filter((name) => !audit.ignored.has(name))
}

/** Every column with a value, as a create (`[null, value]`) or a delete (`[value, null]`). */
function snapshot(audit: ModelAudit, row: any, side: 'before' | 'after'): Record<string, [unknown, unknown]> {
    const changes: Record<string, [unknown, unknown]> = {}
    for (const name of attributesOf(audit)) {
        if (name === audit.primaryKey) continue
        const value = stored(row.get ? row.get(name) : row[name], audit.secret.has(name))
        if (value === null) continue
        changes[name] = side === 'after' ? [null, value] : [value, null]
    }
    return changes
}

function diff(audit: ModelAudit, before: any, after: any, fields?: string[]): Record<string, [unknown, unknown]> {
    const changes: Record<string, [unknown, unknown]> = {}
    for (const name of fields ?? attributesOf(audit)) {
        if (audit.ignored.has(name) || !(name in (audit.model.rawAttributes ?? {}))) continue
        const read = (row: any) => (row?.get ? row.get(name) : row?.[name])
        const secret = audit.secret.has(name)
        const a = stored(read(before), false)
        const b = stored(read(after), false)
        if (same(a, b)) continue
        changes[name] = secret ? [MASKED, MASKED] : [a, b]
    }
    return changes
}

// ── Writing it down ───────────────────────────────────────────────────────

interface Entry {
    action: 'create' | 'update' | 'delete' | 'restore'
    recordId: string | null
    changes: Record<string, [unknown, unknown]>
}

function record(audit: ModelAudit, entries: Entry[], options: any) {
    const kept = entries.filter((e) => e.recordId && Object.keys(e.changes).length > 0)
    if (kept.length === 0) return
    const { actor, source, meta } = currentActor()
    const rows = kept.map((e) => ({
        collection: audit.collection,
        model: audit.model.name,
        record_id: e.recordId,
        action: e.action,
        changes: e.changes,
        actor_type: String(actor.type).slice(0, 32),
        actor_id: Number.isInteger(actor.id) ? actor.id : null,
        actor_label: actor.label ?? null,
        source: source.slice(0, 32),
        meta,
    }))
    const write = () => {
        AdminAuditLog.bulkCreate(rows as any[]).catch((err: any) =>
            console.error('[ETHAdminLeaf] Audit:', err?.message || err)
        )
    }
    const transaction = options?.transaction
    if (transaction && typeof transaction.afterCommit === 'function') transaction.afterCommit(write)
    else write()
}

/** A where clause that finds the stored row `values` would land on, if it can tell. */
function matchOf(audit: ModelAudit, values: any, conflictFields?: string[]): Record<string, unknown> | null {
    const read = (name: string) => (values?.get ? values.get(name) : values?.[name])
    if (read(audit.primaryKey) !== undefined && read(audit.primaryKey) !== null) {
        return { [audit.primaryKey]: read(audit.primaryKey) }
    }
    const candidates: string[][] = []
    if (conflictFields?.length) candidates.push(conflictFields)
    for (const key of Object.values<any>(audit.model.uniqueKeys ?? {})) if (key?.fields?.length) candidates.push(key.fields)
    for (const [name, attr] of Object.entries<any>(audit.model.rawAttributes ?? {})) if (attr?.unique) candidates.push([name])
    for (const fields of candidates) {
        if (fields.every((f) => read(f) !== undefined && read(f) !== null)) {
            return Object.fromEntries(fields.map((f) => [f, read(f)]))
        }
    }
    return null
}

const BEFORE = Symbol('ethAuditBefore')
const warned = new Set<string>()

function warnLimit(audit: ModelAudit, limit: number) {
    if (warned.has(audit.model.name)) return
    warned.add(audit.model.name)
    console.warn(`[ETHAdminLeaf] Audit: a bulk write on ${audit.model.name} touched more than ${limit} rows; only the first ${limit} are recorded`)
}

async function readBefore(audit: ModelAudit, where: any, options: any, limit: number): Promise<any[]> {
    const rows = await audit.model.unscoped().findAll({ where, limit: limit + 1, transaction: options?.transaction, hooks: false })
    if (rows.length > limit) {
        warnLimit(audit, limit)
        rows.length = limit
    }
    return rows
}

function attach(audit: ModelAudit, limit: number) {
    const model = audit.model
    const name = 'eth-admin-audit'
    const safe = (fn: (...args: any[]) => Promise<void> | void) => async (...args: any[]) => {
        try {
            await fn(...args)
        } catch (err: any) {
            console.error(`[ETHAdminLeaf] Audit (${model.name}):`, err?.message || err)
        }
    }

    model.addHook('afterCreate', name, safe((instance: any, options: any) => {
        record(audit, [{ action: 'create', recordId: recordIdOf(audit, instance), changes: snapshot(audit, instance, 'after') }], options)
    }))

    model.addHook('afterUpdate', name, safe((instance: any, options: any) => {
        const fields: string[] = options?.fields ?? instance.changed() ?? []
        const previous = Object.fromEntries(fields.map((f) => [f, instance.previous(f)]))
        record(audit, [{ action: 'update', recordId: recordIdOf(audit, instance), changes: diff(audit, previous, instance, fields) }], options)
    }))

    model.addHook('afterDestroy', name, safe((instance: any, options: any) => {
        record(audit, [{ action: 'delete', recordId: recordIdOf(audit, instance), changes: snapshot(audit, instance, 'before') }], options)
    }))

    model.addHook('afterRestore', name, safe((instance: any, options: any) => {
        record(audit, [{ action: 'restore', recordId: recordIdOf(audit, instance), changes: snapshot(audit, instance, 'after') }], options)
    }))

    // Model.update / Model.destroy without individualHooks: read the rows first.
    model.addHook('beforeBulkUpdate', name, safe(async (options: any) => {
        if (options.individualHooks) return
        options[BEFORE] = await readBefore(audit, options.where, options, limit)
    }))
    model.addHook('afterBulkUpdate', name, safe(async (options: any) => {
        const before: any[] | undefined = options[BEFORE]
        if (!before?.length) return
        const fields = Object.keys(options.attributes ?? {})
        const ids = before.map((row) => row.get(audit.primaryKey))
        const after = await model.unscoped().findAll({ where: { [audit.primaryKey]: { [Op.in]: ids } }, transaction: options.transaction, hooks: false })
        const byId = new Map(after.map((row: any) => [String(row.get(audit.primaryKey)), row]))
        record(audit, before.map((row) => {
            const id = recordIdOf(audit, row)
            return { action: 'update' as const, recordId: id, changes: diff(audit, row, byId.get(id!), fields) }
        }), options)
    }))

    model.addHook('beforeBulkDestroy', name, safe(async (options: any) => {
        if (options.individualHooks) return
        options[BEFORE] = await readBefore(audit, options.where, options, limit)
    }))
    model.addHook('afterBulkDestroy', name, safe((options: any) => {
        const before: any[] | undefined = options[BEFORE]
        if (!before?.length) return
        record(audit, before.map((row) => ({ action: 'delete' as const, recordId: recordIdOf(audit, row), changes: snapshot(audit, row, 'before') })), options)
    }))

    // bulkCreate with updateOnDuplicate updates the rows it collides with.
    model.addHook('beforeBulkCreate', name, safe(async (instances: any[], options: any) => {
        if (options.individualHooks || !options.updateOnDuplicate) return
        const matches = instances.slice(0, limit).map((i) => matchOf(audit, i, options.conflictAttributes)).filter(Boolean)
        if (instances.length > limit) warnLimit(audit, limit)
        options[BEFORE] = matches.length
            ? await model.unscoped().findAll({ where: { [Op.or]: matches }, transaction: options.transaction, hooks: false })
            : []
    }))
    model.addHook('afterBulkCreate', name, safe((instances: any[], options: any) => {
        if (options.individualHooks) return
        const before: any[] = options[BEFORE] ?? []
        const byId = new Map(before.map((row) => [recordIdOf(audit, row), row]))
        const fields: string[] | undefined = Array.isArray(options.updateOnDuplicate) ? options.updateOnDuplicate : undefined
        record(audit, instances.slice(0, limit).map((instance) => {
            const id = recordIdOf(audit, instance)
            const previous = id ? byId.get(id) : undefined
            return previous
                ? { action: 'update' as const, recordId: id, changes: diff(audit, previous, instance, fields) }
                : { action: 'create' as const, recordId: id, changes: snapshot(audit, instance, 'after') }
        }), options)
    }))

    model.addHook('beforeUpsert', name, safe(async (values: any, options: any) => {
        const where = matchOf(audit, values, options.conflictFields)
        options[BEFORE] = where ? await model.unscoped().findOne({ where, transaction: options.transaction, hooks: false }) : null
    }))
    model.addHook('afterUpsert', name, safe((result: any, options: any) => {
        const [instance] = Array.isArray(result) ? result : [result]
        if (!instance) return
        const previous = options[BEFORE]
        record(audit, [previous
            ? { action: 'update', recordId: recordIdOf(audit, instance), changes: diff(audit, previous, instance, options.fields) }
            : { action: 'create', recordId: recordIdOf(audit, instance), changes: snapshot(audit, instance, 'after') }], options)
    }))
}

// ── Wiring ────────────────────────────────────────────────────────────────

// Logs of their own, written in bulk: auditing them would double every write.
// The outgoing syncs too: each send rewrites its row.
const LEAF_COLLECTIONS = new Set([AUDIT_COLLECTION, 'admin-logins', 'analytics-events', 'analytics-sessions', 'external-syncs'])
let auditedModels = new Map<any, ModelAudit>()

/**
 * Hooks every model the back-office shows, once each: a model listed in two
 * collections is recorded under the first. Returns the collections tracked.
 */
export function installAuditHooks(collections: CollectionConfig[], config: AuditConfig): string[] {
    const excluded = new Set(config.exclude ?? [])
    const limit = Math.max(1, config.bulkLimit ?? 500)
    const tracked: string[] = []

    for (const collection of collections) {
        const model = collection.model
        if (!model?.addHook || LEAF_COLLECTIONS.has(collection.name) || excluded.has(collection.name)) continue
        tracked.push(collection.name)

        const existing = auditedModels.get(model)
        const secretFields = (collection.fields ?? []).filter((f) => f.secure).map((f) => f.name)
        if (existing) {
            for (const f of secretFields) existing.secret.add(f)
            for (const f of config.ignore?.[collection.name] ?? []) existing.ignored.add(f)
            continue
        }

        const attributes = Object.keys(model.rawAttributes ?? {})
        const timestamps = Object.values<string>(model._timestampAttributes ?? {})
        const audit: ModelAudit = {
            model,
            collection: collection.name,
            primaryKey: model.primaryKeyAttribute ?? 'id',
            ignored: new Set([...TIMESTAMP_FIELDS, ...timestamps, ...(config.ignoreFields ?? []), ...(config.ignore?.[collection.name] ?? [])]),
            secret: new Set([...secretFields, ...attributes.filter((a) => SECRET_NAME.test(a))]),
        }
        auditedModels.set(model, audit)
        attach(audit, limit)
    }
    return tracked
}

/**
 * Removes entries older than `retentionDays`, now and then once a day. Once a
 * day across all servers: the lease is kept for most of the day, so the boot
 * of a second server, or of the next deploy, does not purge again.
 */
export function scheduleAuditRetention(config: AuditConfig) {
    const days = config.retentionDays
    if (!days || days <= 0) return
    const DAY = 24 * 3600 * 1000
    const purge = () => {
        runExclusive('eth_admin.audit_retention', { ttlMs: DAY - 10 * 60 * 1000, release: false }, async () => {
            const cutoff = new Date(Date.now() - days * DAY)
            await AdminAuditLog.destroy({ where: { created_at: { [Op.lt]: cutoff } } as any })
        }).catch((err: any) => console.error('[ETHAdminLeaf] Audit retention:', err?.message || err))
    }
    purge()
    setInterval(purge, DAY).unref()
}

/** Joins entries to the user model so the change list names the author. */
export function linkAuditToUsers(config: AuditConfig): boolean {
    const models = (etherial as any).database?.sequelize?.models ?? {}
    const User = models[config.userModel ?? 'User']
    if (!User) return false
    if (!(AdminAuditLog as any).associations?.actor) {
        AdminAuditLog.belongsTo(User, { foreignKey: 'actor_id', as: 'actor', constraints: false })
    }
    return true
}

/** The model, collection and secrets for a collection's records, when they are tracked. */
export function auditOf(collection: CollectionConfig | undefined): ModelAudit | undefined {
    return collection?.model ? auditedModels.get(collection.model) : undefined
}

/** The read-only collection listing every recorded change. */
export function auditCollection(config: AuditConfig, tracked: string[], hasUsers: boolean, linked: boolean) {
    const usersCollection = config.usersCollection ?? 'users'
    const userField = config.usersDisplayField ?? 'email'
    const include = linked ? [{ association: 'actor', attributes: ['id', userField] }] : []
    const ACTIONS = [
        { value: 'create', label: 'Created', color: 'green' },
        { value: 'update', label: 'Edited', color: 'blue' },
        { value: 'delete', label: 'Deleted', color: 'red' },
        { value: 'restore', label: 'Restored', color: 'purple' },
    ]
    return {
        name: AUDIT_COLLECTION,
        model: AdminAuditLog,
        crud: ['list', 'show'] as ('list' | 'show')[],
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
            { name: 'id', type: 'integer' as const, readonly: true, sortable: true },
            { name: 'action', type: 'select' as const, label: 'Change', filterable: true, options: ACTIONS },
            {
                name: 'collection',
                type: 'select' as const,
                label: 'Collection',
                filterable: true,
                options: tracked.map((name) => ({ value: name, label: name })),
            },
            { name: 'record_id', type: 'string' as const, label: 'Record', searchable: true },
            {
                name: 'actor_type',
                type: 'select' as const,
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
                ? { name: 'actor_id', type: 'relation' as const, label: 'Person', filterable: true, relation: { collection: usersCollection, displayField: userField } }
                : { name: 'actor_id', type: 'integer' as const, label: 'Person', filterable: true },
            { name: 'actor_label', type: 'string' as const, label: 'Author', searchable: true },
            {
                name: 'source',
                type: 'select' as const,
                label: 'Through',
                filterable: true,
                options: [
                    { value: 'back-office', label: 'Back office' },
                    { value: 'app', label: 'App' },
                    { value: 'salesforce', label: 'Salesforce' },
                    { value: 'system', label: 'System' },
                ],
            },
            { name: 'changes', type: 'json' as const, label: 'Changes', readonly: true },
            { name: 'meta', type: 'json' as const, label: 'Context', readonly: true },
            { name: 'created_at', type: 'datetime' as const, label: 'Date', readonly: true, sortable: true, filterable: true },
        ],
        views: {
            list: {
                fields: ['created_at', 'action', 'collection', 'record_id', 'actor_label', 'source'],
                sort: { field: 'created_at', direction: 'desc' as const },
                search: ['record_id', 'actor_label'],
                filters: ['action', 'collection', 'actor_type', 'source', 'actor_id', 'created_at'],
                include,
            },
            show: {
                layout: 'sections' as const,
                sections: [
                    { title: 'Change', fields: ['action', 'collection', 'record_id', 'created_at'] },
                    { title: 'Author', fields: ['actor_type', 'actor_id', 'actor_label', 'source'] },
                    { title: 'Details', fields: ['changes', 'meta'] },
                ],
                include,
            },
        },
    }
}
