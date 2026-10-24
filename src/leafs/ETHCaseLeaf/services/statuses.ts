import { CaseOption, state } from './options.js'

// The case's states and what they mean for the clocks. Kept apart from the
// models so the services import them without importing the hooks.

export enum CaseStatus {
    NEW = 'NEW',
    TRIAGED = 'TRIAGED',
    IN_PROGRESS = 'IN_PROGRESS',
    WAITING_ON_CUSTOMER = 'WAITING_ON_CUSTOMER',
    WAITING_ON_VENDOR = 'WAITING_ON_VENDOR',
    RESOLVED = 'RESOLVED',
    CLOSED = 'CLOSED',
    CANCELLED = 'CANCELLED',
}

/** Staff still have something to do. */
export const OPEN_CASE_STATUSES = [
    CaseStatus.NEW,
    CaseStatus.TRIAGED,
    CaseStatus.IN_PROGRESS,
    CaseStatus.WAITING_ON_CUSTOMER,
    CaseStatus.WAITING_ON_VENDOR,
]

/** Over for good: the customer can no longer write on it. */
export const DONE_STATUSES = [CaseStatus.CLOSED, CaseStatus.CANCELLED]

/** No answer is owed: resolved (the customer confirms or not), closed, cancelled. */
export const FINISHED_STATUSES = [CaseStatus.RESOLVED, CaseStatus.CLOSED, CaseStatus.CANCELLED]

export const isOpenStatus = (status: string | null | undefined) => OPEN_CASE_STATUSES.includes(status as CaseStatus)

const DEFAULT_STATUS_OPTIONS: CaseOption[] = [
    { value: CaseStatus.NEW, label: 'New', color: 'blue' },
    { value: CaseStatus.TRIAGED, label: 'Triaged', color: 'sky' },
    { value: CaseStatus.IN_PROGRESS, label: 'In progress', color: 'amber' },
    { value: CaseStatus.WAITING_ON_CUSTOMER, label: 'Waiting on customer', color: 'orange' },
    { value: CaseStatus.WAITING_ON_VENDOR, label: 'Waiting on vendor', color: 'amber' },
    { value: CaseStatus.RESOLVED, label: 'Resolved', color: 'green' },
    { value: CaseStatus.CLOSED, label: 'Closed', color: 'gray' },
    { value: CaseStatus.CANCELLED, label: 'Cancelled', color: 'gray' },
]

/** The statuses as staff read them: the leaf's names, or the project's. */
export function statusOptions(): CaseOption[] {
    const custom = state.config.statuses ?? {}
    return DEFAULT_STATUS_OPTIONS.map((o) => ({ ...o, ...(custom[o.value] ?? {}) }) as CaseOption)
}

/**
 * Why a case is in the staff's way, kept on the case so the list filters on
 * it: `overdue` past its first-answer or resolution time (set by the clock,
 * which alerts once), `reply` the customer is waiting for an answer.
 */
export enum CaseAttention {
    OVERDUE = 'overdue',
    REPLY = 'reply',
}

export const ATTENTION_OPTIONS: CaseOption[] = [
    { value: CaseAttention.OVERDUE, label: 'Overdue', color: 'red' },
    { value: CaseAttention.REPLY, label: 'A reply', color: 'orange' },
]

export interface CaseAttachment {
    /** The `Media` row. */
    id: number
    url: string
    filename: string | null
    content_type: string | null
}

export interface CaseIssue {
    /** Random hex, not a row: issues live in the case's JSON. */
    id: string
    subject: string
    description: string | null
    type: string | null
    sub_type: string | null
    photos: CaseAttachment[]
}

/** Resolved, and the customer has not said yet whether this resolution fixed it. */
export function awaitsConfirmation(kase: { status: string; resolved_at?: Date | null; confirmation_at?: Date | null }): boolean {
    if (kase.status !== CaseStatus.RESOLVED) return false
    if (!kase.confirmation_at) return true
    return !!kase.resolved_at && new Date(kase.confirmation_at).getTime() < new Date(kase.resolved_at).getTime()
}
