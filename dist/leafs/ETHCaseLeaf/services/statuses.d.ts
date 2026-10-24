import { CaseOption } from './options.js';
export declare enum CaseStatus {
    NEW = "NEW",
    TRIAGED = "TRIAGED",
    IN_PROGRESS = "IN_PROGRESS",
    WAITING_ON_CUSTOMER = "WAITING_ON_CUSTOMER",
    WAITING_ON_VENDOR = "WAITING_ON_VENDOR",
    RESOLVED = "RESOLVED",
    CLOSED = "CLOSED",
    CANCELLED = "CANCELLED"
}
/** Staff still have something to do. */
export declare const OPEN_CASE_STATUSES: CaseStatus[];
/** Over for good: the customer can no longer write on it. */
export declare const DONE_STATUSES: CaseStatus[];
/** No answer is owed: resolved (the customer confirms or not), closed, cancelled. */
export declare const FINISHED_STATUSES: CaseStatus[];
export declare const isOpenStatus: (status: string | null | undefined) => boolean;
/** The statuses as staff read them: the leaf's names, or the project's. */
export declare function statusOptions(): CaseOption[];
/**
 * Why a case is in the staff's way, kept on the case so the list filters on
 * it: `overdue` past its first-answer or resolution time (set by the clock,
 * which alerts once), `reply` the customer is waiting for an answer.
 */
export declare enum CaseAttention {
    OVERDUE = "overdue",
    REPLY = "reply"
}
export declare const ATTENTION_OPTIONS: CaseOption[];
export interface CaseAttachment {
    /** The `Media` row. */
    id: number;
    url: string;
    filename: string | null;
    content_type: string | null;
}
export interface CaseIssue {
    /** Random hex, not a row: issues live in the case's JSON. */
    id: string;
    subject: string;
    description: string | null;
    type: string | null;
    sub_type: string | null;
    photos: CaseAttachment[];
}
/** Resolved, and the customer has not said yet whether this resolution fixed it. */
export declare function awaitsConfirmation(kase: {
    status: string;
    resolved_at?: Date | null;
    confirmation_at?: Date | null;
}): boolean;
