import etherial from 'etherial'
import type { Request, Response } from 'express'
import { Op } from 'sequelize'
import { Controller, Get, Post } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'

import { AdminAuditLog } from '../models/AdminAuditLog.js'
import { auditOf, withAuditMeta } from '../features/audit.js'

const getAdminLeaf = () => (etherial as any).eth_admin_leaf

const isPlaceholder = (value: unknown) =>
    !!value && typeof value === 'object' && ('__masked' in (value as any) || '__truncated' in (value as any))

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** What a stored value looks like next to the live one: the same JSON-safe form. */
function comparable(value: unknown): unknown {
    if (value === undefined || value === null) return null
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'object') return JSON.parse(JSON.stringify(value))
    if (typeof value === 'number' || typeof value === 'boolean') return value
    const n = Number(value)
    return value !== '' && !Number.isNaN(n) && String(n) === String(value) ? n : value
}

/** Columns of an edit that can be put back: kept in full, still in the model, editable in the back-office. */
function restorableFields(entry: AdminAuditLog, collection: any): string[] {
    if (entry.action !== 'update') return []
    const attributes = collection.model?.rawAttributes ?? {}
    const readonly = new Set((collection.fields ?? []).filter((f: any) => f.readonly).map((f: any) => f.name))
    return Object.entries(entry.changes ?? {})
        .filter(([field, [before]]) => field in attributes && !readonly.has(field) && !isPlaceholder(before))
        .map(([field]) => field)
}

@Controller()
export default class ETHAdminAuditController {
    /**
     * GET /admin/audit/:collection/:id?before=<entry id>&limit=30&source=salesforce
     *
     * The record's changes, newest first. Whoever may open the record may read
     * them; `canRestore` says whether they may also undo one. The first page
     * also counts the entries per source, for the filter.
     */
    @Get('/admin/audit/:collection/:id')
    @ShouldBeAuthenticated()
    async history(req: Request & { user: any }, res: Response): Promise<any> {
        const adminLeaf = getAdminLeaf()
        const collection = adminLeaf?.getCollection(req.params.collection)
        const audit = auditOf(collection)
        if (!collection || !audit) {
            return (res as any).error({ status: 404, errors: ['not_tracked'] })
        }
        if (!(await adminLeaf.checkAccess(req.user, req.params.collection, 'show'))) {
            return (res as any).error({ status: 403, errors: ['forbidden'] })
        }

        const before = req.query.before ? Number(req.query.before) : undefined
        if (before !== undefined && (!Number.isInteger(before) || before <= 0)) {
            return (res as any).error({ status: 400, errors: ['invalid_cursor'] })
        }
        const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100)
        const source = typeof req.query.source === 'string' && req.query.source ? req.query.source : undefined

        const ofRecord = { model: audit.model.name, record_id: String(req.params.id) }
        const rows = await AdminAuditLog.findAll({
            where: {
                ...ofRecord,
                ...(source ? { source } : {}),
                ...(before ? { id: { [Op.lt]: before } } : {}),
            } as any,
            order: [['id', 'DESC']],
            limit,
        })

        let counts: Record<string, number> | undefined
        if (!before) {
            const grouped = (await AdminAuditLog.count({ where: ofRecord as any, group: ['source'] })) as unknown as { source: string | null; count: number }[]
            counts = Object.fromEntries(grouped.map((g) => [g.source ?? 'system', Number(g.count)]))
        }

        const canRestore = await adminLeaf.checkAccess(req.user, req.params.collection, 'update')
        const paranoid = !!collection.model?.options?.paranoid
        const items = rows.map((entry) => ({
            id: entry.id,
            action: entry.action,
            at: entry.created_at,
            actor: { type: entry.actor_type, id: entry.actor_id, label: entry.actor_label },
            source: entry.source,
            meta: entry.meta,
            changes: Object.entries(entry.changes ?? {}).map(([field, [from, to]]) => ({ field, before: from, after: to })),
            restorable: entry.action === 'delete' ? paranoid : restorableFields(entry, collection).length > 0,
        }))

        return (res as any).success({
            status: 200,
            data: { items, canRestore, counts, nextBefore: rows.length === limit ? rows[rows.length - 1].id : null },
        })
    }

    /**
     * POST /admin/audit/:entry/restore  { fields?: string[], force?: boolean }
     *
     * Puts back what an edit replaced, or brings back a soft-deleted record.
     * A column changed again since that edit is a conflict: nothing is written
     * and the answer lists them, unless `force` is set. The restore goes
     * through the collection's own update hooks and is recorded like any edit.
     */
    @Post('/admin/audit/:entry/restore')
    @ShouldBeAuthenticated()
    async restore(req: Request & { user: any }, res: Response): Promise<any> {
        const adminLeaf = getAdminLeaf()
        const entry = await AdminAuditLog.findByPk(Number(req.params.entry) || 0)
        if (!entry) {
            return (res as any).error({ status: 404, errors: ['not_found'] })
        }

        // The collection the entry was recorded under, or any other showing the same model.
        const collections: any[] = adminLeaf?.collections ?? []
        const collection =
            adminLeaf?.getCollection(entry.collection) ??
            collections.find((c) => c.model?.name === entry.model)
        if (!collection || !(await adminLeaf.checkAccess(req.user, collection.name, 'update'))) {
            return (res as any).error({ status: 403, errors: ['forbidden'] })
        }

        const meta = { restored_from: entry.id }

        if (entry.action === 'delete') {
            const record = await collection.model.findByPk(entry.record_id, { paranoid: false })
            if (!record) return (res as any).error({ status: 409, errors: ['record_gone'] })
            if (!collection.model.options?.paranoid || !record.isSoftDeleted?.()) {
                return (res as any).error({ status: 409, errors: ['not_restorable'] })
            }
            await withAuditMeta(meta, () => record.restore())
            return (res as any).success({ status: 200, data: { restored: true, fields: [] } })
        }

        const allowed = restorableFields(entry, collection)
        const asked: string[] | undefined = Array.isArray(req.body?.fields) ? req.body.fields : undefined
        const fields = asked ? allowed.filter((f) => asked.includes(f)) : allowed
        if (fields.length === 0) {
            return (res as any).error({ status: 409, errors: ['not_restorable'] })
        }

        const record = await collection.model.findByPk(entry.record_id)
        if (!record) return (res as any).error({ status: 409, errors: ['record_gone'] })

        const conflicts = fields
            .map((field) => ({ field, expected: entry.changes[field][1], current: comparable(record.get(field)) }))
            .filter(({ expected, current }) => !same(comparable(expected), current))
        if (conflicts.length > 0 && !req.body?.force) {
            return (res as any).success({ status: 200, data: { restored: false, conflicts } })
        }

        let data: Record<string, unknown> = Object.fromEntries(fields.map((f) => [f, entry.changes[f][0]]))
        const hooks = adminLeaf.getResolvedHooks(collection.name)
        await withAuditMeta(meta, async () => {
            if (hooks?.beforeUpdate) data = (await hooks.beforeUpdate(record, data, req)) ?? data
            await record.update(data)
            if (hooks?.afterUpdate) await hooks.afterUpdate(record, req)
        })

        return (res as any).success({ status: 200, data: { restored: true, fields } })
    }
}
