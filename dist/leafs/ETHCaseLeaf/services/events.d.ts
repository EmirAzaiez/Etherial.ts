import { CaseEventType } from '../models/CaseEvent.js';
/**
 * Writes a line of the case's history, signed with whoever writes (the
 * signed-in person, `system`, an integration's `withActor`). After the commit
 * of the write it belongs to, so a rolled-back change leaves no line; its
 * failure only prints, as the history never blocks a write.
 */
export declare function logCaseEvent(caseId: number, type: CaseEventType, values?: {
    from?: unknown;
    to?: unknown;
    note?: string | null;
}, options?: {
    transaction?: any;
}): void;
/** Who writes now: the staff member's id in the back-office, else null. */
export declare function staffActorId(): number | null;
export declare const writtenFrom: () => string;
