import { currentActor } from '../../ETHAdminLeaf/features/audit.js';
import { CaseEvent } from '../models/CaseEvent.js';
const short = (value) => (value === null || value === undefined || value === '' ? null : String(value).slice(0, 255));
/**
 * Writes a line of the case's history, signed with whoever writes (the
 * signed-in person, `system`, an integration's `withActor`). After the commit
 * of the write it belongs to, so a rolled-back change leaves no line; its
 * failure only prints, as the history never blocks a write.
 */
export function logCaseEvent(caseId, type, values = {}, options = {}) {
    var _a, _b, _c;
    const { actor, source } = currentActor();
    const row = {
        case_id: caseId,
        type,
        from_value: short(values.from),
        to_value: short(values.to),
        actor_type: actor.type,
        actor_id: (_a = actor.id) !== null && _a !== void 0 ? _a : null,
        actor_label: short(actor.label),
        source,
        note: (_b = values.note) !== null && _b !== void 0 ? _b : null,
    };
    const write = () => CaseEvent.create(row).catch((error) => console.error(`[ETHCaseLeaf] Could not log ${type} on case #${caseId}:`, (error === null || error === void 0 ? void 0 : error.message) || error));
    if ((_c = options.transaction) === null || _c === void 0 ? void 0 : _c.afterCommit)
        options.transaction.afterCommit(write);
    else
        void write();
}
/** Who writes now: the staff member's id in the back-office, else null. */
export function staffActorId() {
    var _a;
    const { actor, source } = currentActor();
    return source === 'back-office' && actor.type === 'user' ? ((_a = actor.id) !== null && _a !== void 0 ? _a : null) : null;
}
export const writtenFrom = () => currentActor().source;
