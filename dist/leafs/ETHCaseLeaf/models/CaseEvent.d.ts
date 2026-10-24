import { Model } from 'etherial/components/database/provider';
/** What happened to a case, besides its messages. */
export declare enum CaseEventType {
    CREATED = "created",
    STATUS = "status",
    ASSIGNED = "assigned",
    PRIORITY = "priority",
    CATEGORY = "category",
    KIND = "kind",
    REOPENED = "reopened",
    CONFIRMED = "confirmed",
    REJECTED = "rejected",
    RATED = "rated",
    OVERDUE = "overdue"
}
/**
 * A case's history, shown between its messages in the back-office: who
 * changed the status, the assignee, the priority, and when the customer
 * confirmed, rejected or rated a resolution. Written by the case's hooks,
 * whoever writes (the app, staff, a sync).
 */
export declare class CaseEvent extends Model<CaseEvent> {
    id: number;
    case_id: number;
    type: CaseEventType;
    from_value: string | null;
    to_value: string | null;
    /** `user`, `system`, `salesforce`…: the author of the write (ETHAdminLeaf's audit). */
    actor_type: string | null;
    actor_id: number | null;
    actor_label: string | null;
    /** `back-office`, `app`, `system`… */
    source: string | null;
    note: string | null;
    created_at: Date;
}
