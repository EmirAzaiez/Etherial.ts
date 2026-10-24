import { currentActor } from '../../ETHAdminLeaf/features/audit.js'
import { CaseEvent, CaseEventType } from '../models/CaseEvent.js'

const short = (value: unknown): string | null => (value === null || value === undefined || value === '' ? null : String(value).slice(0, 255))

/**
 * Writes a line of the case's history, signed with whoever writes (the
 * signed-in person, `system`, an integration's `withActor`). After the commit
 * of the write it belongs to, so a rolled-back change leaves no line; its
 * failure only prints, as the history never blocks a write.
 */
export function logCaseEvent(
    caseId: number,
    type: CaseEventType,
    values: { from?: unknown; to?: unknown; note?: string | null } = {},
    options: { transaction?: any } = {},
): void {
    const { actor, source } = currentActor()
    const row = {
        case_id: caseId,
        type,
        from_value: short(values.from),
        to_value: short(values.to),
        actor_type: actor.type,
        actor_id: actor.id ?? null,
        actor_label: short(actor.label),
        source,
        note: values.note ?? null,
    }
    const write = () =>
        CaseEvent.create(row as any).catch((error: any) => console.error(`[ETHCaseLeaf] Could not log ${type} on case #${caseId}:`, error?.message || error))
    if (options.transaction?.afterCommit) options.transaction.afterCommit(write)
    else void write()
}

/** Who writes now: the staff member's id in the back-office, else null. */
export function staffActorId(): number | null {
    const { actor, source } = currentActor()
    return source === 'back-office' && actor.type === 'user' ? (actor.id ?? null) : null
}

export const writtenFrom = () => currentActor().source
