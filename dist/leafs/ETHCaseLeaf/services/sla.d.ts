import { CaseAttention } from './statuses.js';
interface Policy {
    id: number;
    kind: string | null;
    category: string | null;
    priority: string | null;
    first_response_hours: number | null;
    resolution_hours: number | null;
}
/** Drops the policies read: the next case reads them again. */
export declare function forgetSlaPolicies(): void;
/** The most specific active policy naming nothing the case contradicts; the oldest of equals. */
export declare function policyFor(kase: {
    kind?: string | null;
    category?: string | null;
    priority?: string | null;
}): Promise<Policy | null>;
/** When the first answer and the resolution are due, counted from `from`. */
export declare function dueDates(kase: any, from: Date): Promise<{
    first_response_due_at: Date | null;
    resolution_due_at: Date | null;
}>;
/** Staff are late on it: not answered in time, or not resolved in time. Waiting on the customer stops nothing but the alarm. */
export declare function isOverdue(kase: any, now?: Date): boolean;
/**
 * The cases to flag overdue now. The same rule as `isOverdue`, in SQL; the
 * cases read from elsewhere have no due time, so they never match.
 */
export declare function overdueWhere(now?: Date): any;
/**
 * What the case asks of staff, from its state: hooks keep `overdue` only
 * while it still holds (the clock alone sets it, to alert once), else
 * `reply` while the customer waits for an answer.
 */
export declare function attentionOf(kase: any, now?: Date): CaseAttention | null;
export {};
