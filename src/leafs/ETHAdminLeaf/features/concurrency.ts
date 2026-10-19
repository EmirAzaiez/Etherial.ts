import { Op } from 'sequelize'

import type { CollectionConfig } from './CollectionConfig.js'
import { auditOf } from './audit.js'
import { AdminAuditLog } from '../models/AdminAuditLog.js'

/**
 * Concurrent edits on the back-office's edit page.
 *
 * The form sends `If-Match: <updated_at as it loaded it>` with its save. When
 * the record has moved on since, the save is refused with a 409 that says what
 * changed and who changed it, and the back-office decides: merge silently when
 * the two edits touch different fields, ask otherwise. No header, no check —
 * inline and bulk edits, and older back-offices, save as before.
 */

export interface EditConflict {
    changedFields: string[]
    changedBy: { id: number | null; name: string | null } | null
    changedAt: string
}

/**
 * An audit entry is written right after its commit, a few milliseconds after
 * the `updated_at` it stamped. Entries this close to the version the form
 * loaded are that version's own write, not someone else's.
 */
const OWN_WRITE_SLACK_MS = 1500

/** `W/"2026-10-19T08:00:00.000Z"` or a bare ISO string → epoch ms; anything else → null. */
function parseIfMatch(header: unknown): number | null {
    if (typeof header !== 'string' || !header.trim()) {
        return null
    }
    const cleaned = header.trim().replace(/^W\//, '').replace(/^"(.*)"$/, '$1')
    const ms = Date.parse(cleaned)
    return Number.isNaN(ms) ? null : ms
}

/** When the record was last written, read from the column the model stamps. */
function versionOf(collection: CollectionConfig, record: any): Date | null {
    const stamped = collection.model?._timestampAttributes?.updatedAt
    for (const name of [stamped, 'updated_at', 'updatedAt']) {
        if (!name) {
            continue
        }
        const value = record?.get ? record.get(name) : record?.[name]
        if (value) {
            const date = value instanceof Date ? value : new Date(value)
            if (!Number.isNaN(date.getTime())) {
                return date
            }
        }
    }
    return null
}

/**
 * The conflict between the version the form loaded and the record as it is
 * now, or null when there is none: no header, an unreadable one, a model
 * without `updated_at`, or the same version.
 */
export async function detectEditConflict(collection: CollectionConfig, record: any, ifMatch: unknown): Promise<EditConflict | null> {
    const loaded = parseIfMatch(ifMatch)
    if (loaded === null) {
        return null
    }
    const current = versionOf(collection, record)
    if (!current || current.getTime() === loaded) {
        return null
    }

    const conflict: EditConflict = { changedFields: [], changedBy: null, changedAt: current.toISOString() }

    // Who and what, when the change history keeps it. The back-office works
    // the fields out itself otherwise, from the record the 409 carries.
    const audit = auditOf(collection)
    if (!audit) {
        return conflict
    }
    try {
        const id = record.get ? record.get(audit.primaryKey) : record[audit.primaryKey]
        const entries = await AdminAuditLog.findAll({
            where: {
                model: audit.model.name,
                record_id: String(id),
                action: 'update',
                created_at: { [Op.gt]: new Date(loaded) },
            } as any,
            order: [['id', 'ASC']],
            limit: 50,
        })
        if (entries.length === 0) {
            return conflict
        }
        // The last entry wrote the version on the server now; the earlier
        // ones count unless they are the loaded version's own write.
        const latest = entries[entries.length - 1]
        const since = entries.filter(
            (e) => e === latest || new Date(e.created_at).getTime() > loaded + OWN_WRITE_SLACK_MS
        )
        conflict.changedFields = Array.from(new Set(since.flatMap((e) => Object.keys(e.changes ?? {}))))
        conflict.changedBy = latest.actor_id || latest.actor_label
            ? { id: latest.actor_id ?? null, name: latest.actor_label ?? null }
            : null
    } catch (err: any) {
        // Without the history the conflict still stands, it just names no one.
        console.error('[ETHAdminLeaf] Edit conflict history lookup failed:', err?.message ?? err)
    }
    return conflict
}
