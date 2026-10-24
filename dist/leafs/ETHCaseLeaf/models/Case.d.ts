import { Model } from 'etherial/components/database/provider';
import { CaseStatus, type CaseAttachment, type CaseIssue } from '../services/statuses.js';
/** The options the hooks read: `notify: false` keeps the customer from being told. */
type WriteOptions = {
    notify?: boolean;
    transaction?: any;
};
/** Runs `fn` once the write's transaction commits, or now without one. */
export declare function afterCommit(options: {
    transaction?: any;
} | undefined, fn: () => unknown): Promise<void>;
/**
 * Base Case (no @Table): a customer's request — maintenance, a complaint, a
 * question — and how staff handle it.
 *
 * The project declares the table and adds the foreign keys and associations
 * of `user_id` and `assigned_to_user_id`, what a case is about (a unit), and
 * its own columns (a CRM id):
 *
 * ```typescript
 * @Table({ timestamps: true, tableName: 'cases', freezeTableName: true })
 * export class Case extends BaseCase {
 *     @ForeignKey(() => User)
 *     declare user_id: number
 *
 *     @BelongsTo(() => User, 'user_id')
 *     declare user: User
 * }
 * ```
 *
 * The columns, their indexes and the hooks stay here: a subclass declares
 * no `@Column` nor `@Index` on them again.
 *
 * Whoever writes (the app, staff, a sync), the hooks stamp the status's dates,
 * run the clocks (due times, who waits for whom), keep the history and tell
 * the customer when their case is resolved or closed.
 */
export declare class BaseCase extends Model<any> {
    id: number;
    /** CASE-000123, written after the insert (the leaf's `reference`). */
    reference: string;
    /** The customer. */
    user_id: number;
    assigned_to_user_id: number;
    kind: string;
    subject: string;
    description: string;
    topic: string;
    category: string;
    priority: string;
    /** What the customer asked for; `priority` is what staff decided. */
    requested_priority: string;
    status: CaseStatus;
    status_entered_at: Date;
    /** APP, BACKOFFICE, SURVEY, or the CRM's origin. */
    channel: string;
    location: string;
    issues: CaseIssue[];
    /** The customer's photos and files (Media rows, by id). */
    attachments: CaseAttachment[];
    /** Shown to the customer once resolved. */
    resolution_note: string;
    first_response_at: Date;
    resolved_at: Date;
    closed_at: Date;
    reopened_count: number;
    satisfaction_rating: number;
    satisfaction_note: string;
    /** The customer's word on the last resolution: CONFIRMED or REJECTED. */
    confirmation_status: 'CONFIRMED' | 'REJECTED';
    confirmation_note: string;
    confirmation_at: Date;
    last_activity_at: Date;
    /** When the first staff answer is due (the SLA policy when it opened). */
    first_response_due_at: Date | null;
    /** When the resolution is due; counted again from a reopening. */
    resolution_due_at: Date | null;
    /** Since when the customer waits for an answer: their case, their message. Null once staff answer. */
    awaiting_reply_since: Date | null;
    /** `overdue`, `reply` or null: what the inbox filters on (see `attentionOf`). */
    attention: string | null;
    created_at: Date;
    updated_at: Date;
    get is_open(): boolean;
    /** The clocks of a new case; none for one handled elsewhere or already over. */
    static caseStartClocks(kase: BaseCase): Promise<void>;
    static caseOpened(kase: BaseCase, options: WriteOptions): Promise<void>;
    /** The status's dates and the clocks, whoever changes the case: the app, staff, a sync. */
    static caseMoveClocks(kase: BaseCase): Promise<void>;
    static caseChanged(kase: BaseCase, options: WriteOptions): Promise<void>;
    static caseDestroyed(kase: BaseCase, options: WriteOptions): Promise<void>;
}
export { CaseStatus, OPEN_CASE_STATUSES, DONE_STATUSES, FINISHED_STATUSES, CaseAttention, awaitsConfirmation } from '../services/statuses.js';
export type { CaseAttachment, CaseIssue } from '../services/statuses.js';
