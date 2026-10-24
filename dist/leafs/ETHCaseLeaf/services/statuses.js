import { state } from './options.js';
// The case's states and what they mean for the clocks. Kept apart from the
// models so the services import them without importing the hooks.
export var CaseStatus;
(function (CaseStatus) {
    CaseStatus["NEW"] = "NEW";
    CaseStatus["TRIAGED"] = "TRIAGED";
    CaseStatus["IN_PROGRESS"] = "IN_PROGRESS";
    CaseStatus["WAITING_ON_CUSTOMER"] = "WAITING_ON_CUSTOMER";
    CaseStatus["WAITING_ON_VENDOR"] = "WAITING_ON_VENDOR";
    CaseStatus["RESOLVED"] = "RESOLVED";
    CaseStatus["CLOSED"] = "CLOSED";
    CaseStatus["CANCELLED"] = "CANCELLED";
})(CaseStatus || (CaseStatus = {}));
/** Staff still have something to do. */
export const OPEN_CASE_STATUSES = [
    CaseStatus.NEW,
    CaseStatus.TRIAGED,
    CaseStatus.IN_PROGRESS,
    CaseStatus.WAITING_ON_CUSTOMER,
    CaseStatus.WAITING_ON_VENDOR,
];
/** Over for good: the customer can no longer write on it. */
export const DONE_STATUSES = [CaseStatus.CLOSED, CaseStatus.CANCELLED];
/** No answer is owed: resolved (the customer confirms or not), closed, cancelled. */
export const FINISHED_STATUSES = [CaseStatus.RESOLVED, CaseStatus.CLOSED, CaseStatus.CANCELLED];
export const isOpenStatus = (status) => OPEN_CASE_STATUSES.includes(status);
const DEFAULT_STATUS_OPTIONS = [
    { value: CaseStatus.NEW, label: 'New', color: 'blue' },
    { value: CaseStatus.TRIAGED, label: 'Triaged', color: 'sky' },
    { value: CaseStatus.IN_PROGRESS, label: 'In progress', color: 'amber' },
    { value: CaseStatus.WAITING_ON_CUSTOMER, label: 'Waiting on customer', color: 'orange' },
    { value: CaseStatus.WAITING_ON_VENDOR, label: 'Waiting on vendor', color: 'amber' },
    { value: CaseStatus.RESOLVED, label: 'Resolved', color: 'green' },
    { value: CaseStatus.CLOSED, label: 'Closed', color: 'gray' },
    { value: CaseStatus.CANCELLED, label: 'Cancelled', color: 'gray' },
];
/** The statuses as staff read them: the leaf's names, or the project's. */
export function statusOptions() {
    var _a;
    const custom = (_a = state.config.statuses) !== null && _a !== void 0 ? _a : {};
    return DEFAULT_STATUS_OPTIONS.map((o) => { var _a; return (Object.assign(Object.assign({}, o), ((_a = custom[o.value]) !== null && _a !== void 0 ? _a : {}))); });
}
/**
 * Why a case is in the staff's way, kept on the case so the list filters on
 * it: `overdue` past its first-answer or resolution time (set by the clock,
 * which alerts once), `reply` the customer is waiting for an answer.
 */
export var CaseAttention;
(function (CaseAttention) {
    CaseAttention["OVERDUE"] = "overdue";
    CaseAttention["REPLY"] = "reply";
})(CaseAttention || (CaseAttention = {}));
export const ATTENTION_OPTIONS = [
    { value: CaseAttention.OVERDUE, label: 'Overdue', color: 'red' },
    { value: CaseAttention.REPLY, label: 'A reply', color: 'orange' },
];
/** Resolved, and the customer has not said yet whether this resolution fixed it. */
export function awaitsConfirmation(kase) {
    if (kase.status !== CaseStatus.RESOLVED)
        return false;
    if (!kase.confirmation_at)
        return true;
    return !!kase.resolved_at && new Date(kase.confirmation_at).getTime() < new Date(kase.resolved_at).getTime();
}
