var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Op } from 'sequelize';
import { auditOf } from './audit.js';
import { AdminAuditLog } from '../models/AdminAuditLog.js';
/**
 * An audit entry is written right after its commit, a few milliseconds after
 * the `updated_at` it stamped. Entries this close to the version the form
 * loaded are that version's own write, not someone else's.
 */
const OWN_WRITE_SLACK_MS = 1500;
/** `W/"2026-10-19T08:00:00.000Z"` or a bare ISO string → epoch ms; anything else → null. */
function parseIfMatch(header) {
    if (typeof header !== 'string' || !header.trim()) {
        return null;
    }
    const cleaned = header.trim().replace(/^W\//, '').replace(/^"(.*)"$/, '$1');
    const ms = Date.parse(cleaned);
    return Number.isNaN(ms) ? null : ms;
}
/** When the record was last written, read from the column the model stamps. */
function versionOf(collection, record) {
    var _a, _b;
    const stamped = (_b = (_a = collection.model) === null || _a === void 0 ? void 0 : _a._timestampAttributes) === null || _b === void 0 ? void 0 : _b.updatedAt;
    for (const name of [stamped, 'updated_at', 'updatedAt']) {
        if (!name) {
            continue;
        }
        const value = (record === null || record === void 0 ? void 0 : record.get) ? record.get(name) : record === null || record === void 0 ? void 0 : record[name];
        if (value) {
            const date = value instanceof Date ? value : new Date(value);
            if (!Number.isNaN(date.getTime())) {
                return date;
            }
        }
    }
    return null;
}
/**
 * The conflict between the version the form loaded and the record as it is
 * now, or null when there is none: no header, an unreadable one, a model
 * without `updated_at`, or the same version.
 */
export function detectEditConflict(collection, record, ifMatch) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const loaded = parseIfMatch(ifMatch);
        if (loaded === null) {
            return null;
        }
        const current = versionOf(collection, record);
        if (!current || current.getTime() === loaded) {
            return null;
        }
        const conflict = { changedFields: [], changedBy: null, changedAt: current.toISOString() };
        // Who and what, when the change history keeps it. The back-office works
        // the fields out itself otherwise, from the record the 409 carries.
        const audit = auditOf(collection);
        if (!audit) {
            return conflict;
        }
        try {
            const id = record.get ? record.get(audit.primaryKey) : record[audit.primaryKey];
            const entries = yield AdminAuditLog.findAll({
                where: {
                    model: audit.model.name,
                    record_id: String(id),
                    action: 'update',
                    created_at: { [Op.gt]: new Date(loaded) },
                },
                order: [['id', 'ASC']],
                limit: 50,
            });
            if (entries.length === 0) {
                return conflict;
            }
            // The last entry wrote the version on the server now; the earlier
            // ones count unless they are the loaded version's own write.
            const latest = entries[entries.length - 1];
            const since = entries.filter((e) => e === latest || new Date(e.created_at).getTime() > loaded + OWN_WRITE_SLACK_MS);
            conflict.changedFields = Array.from(new Set(since.flatMap((e) => { var _a; return Object.keys((_a = e.changes) !== null && _a !== void 0 ? _a : {}); })));
            conflict.changedBy = latest.actor_id || latest.actor_label
                ? { id: (_a = latest.actor_id) !== null && _a !== void 0 ? _a : null, name: (_b = latest.actor_label) !== null && _b !== void 0 ? _b : null }
                : null;
        }
        catch (err) {
            // Without the history the conflict still stands, it just names no one.
            console.error('[ETHAdminLeaf] Edit conflict history lookup failed:', (_c = err === null || err === void 0 ? void 0 : err.message) !== null && _c !== void 0 ? _c : err);
        }
        return conflict;
    });
}
