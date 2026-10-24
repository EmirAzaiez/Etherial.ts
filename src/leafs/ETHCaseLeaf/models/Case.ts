import {
    Column,
    Model,
    AllowNull,
    PrimaryKey,
    AutoIncrement,
    CreatedAt,
    UpdatedAt,
    DataType,
    Default,
    Index,
    BeforeCreate,
    AfterCreate,
    BeforeUpdate,
    AfterUpdate,
    AfterDestroy,
} from 'etherial/components/database/provider'

import { currentActor } from '../../ETHAdminLeaf/features/audit.js'
import { CaseEvent, CaseEventType } from './CaseEvent.js'
import { logCaseEvent, writtenFrom } from '../services/events.js'
import { alertStaff, caseTitle, notifyCustomer } from '../services/notices.js'
import { readOnlyReason, referenceOf } from '../services/options.js'
import { attentionOf, dueDates } from '../services/sla.js'
import { CaseStatus, FINISHED_STATUSES, OPEN_CASE_STATUSES, isOpenStatus, type CaseAttachment, type CaseIssue } from '../services/statuses.js'

/** The options the hooks read: `notify: false` keeps the customer from being told. */
type WriteOptions = { notify?: boolean; transaction?: any }

/** Runs `fn` once the write's transaction commits, or now without one. */
export async function afterCommit(options: { transaction?: any } | undefined, fn: () => unknown): Promise<void> {
    if (options?.transaction?.afterCommit) options.transaction.afterCommit(() => fn())
    else await fn()
}

/** The changes the history keeps, beside the status's. */
const TRACKED: [string, CaseEventType][] = [
    ['assigned_to_user_id', CaseEventType.ASSIGNED],
    ['priority', CaseEventType.PRIORITY],
    ['category', CaseEventType.CATEGORY],
    ['kind', CaseEventType.KIND],
]

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
export class BaseCase extends Model<any> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column(DataType.INTEGER)
    id: number

    /** CASE-000123, written after the insert (the leaf's `reference`). */
    @AllowNull(true)
    @Column(DataType.STRING(255))
    reference: string

    /** The customer. */
    @AllowNull(true)
    @Index
    @Column(DataType.INTEGER)
    user_id: number

    @AllowNull(true)
    @Column(DataType.INTEGER)
    assigned_to_user_id: number

    @AllowNull(false)
    @Default('GENERAL_INQUIRY')
    @Column(DataType.STRING(255))
    kind: string

    @AllowNull(false)
    @Column(DataType.STRING(255))
    subject: string

    @AllowNull(true)
    @Column(DataType.TEXT)
    description: string

    @AllowNull(true)
    @Column(DataType.STRING(255))
    topic: string

    @AllowNull(false)
    @Default('OTHER')
    @Column(DataType.STRING(255))
    category: string

    @AllowNull(false)
    @Default('MEDIUM')
    @Column(DataType.STRING(255))
    priority: string

    /** What the customer asked for; `priority` is what staff decided. */
    @AllowNull(true)
    @Column(DataType.STRING(255))
    requested_priority: string

    @AllowNull(false)
    @Default(CaseStatus.NEW)
    @Index
    @Column(DataType.STRING(255))
    status: CaseStatus

    @AllowNull(false)
    @Default(DataType.NOW)
    @Column(DataType.DATE)
    status_entered_at: Date

    /** APP, BACKOFFICE, SURVEY, or the CRM's origin. */
    @AllowNull(false)
    @Default('APP')
    @Column(DataType.STRING(255))
    channel: string

    @AllowNull(true)
    @Column(DataType.STRING(255))
    location: string

    @AllowNull(false)
    @Default([])
    @Column(DataType.JSONB)
    issues: CaseIssue[]

    /** The customer's photos and files (Media rows, by id). */
    @AllowNull(false)
    @Default([])
    @Column(DataType.JSONB)
    attachments: CaseAttachment[]

    /** Shown to the customer once resolved. */
    @AllowNull(true)
    @Column(DataType.TEXT)
    resolution_note: string

    @AllowNull(true)
    @Column(DataType.DATE)
    first_response_at: Date

    @AllowNull(true)
    @Column(DataType.DATE)
    resolved_at: Date

    @AllowNull(true)
    @Column(DataType.DATE)
    closed_at: Date

    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    reopened_count: number

    @AllowNull(true)
    @Column(DataType.INTEGER)
    satisfaction_rating: number

    @AllowNull(true)
    @Column(DataType.TEXT)
    satisfaction_note: string

    /** The customer's word on the last resolution: CONFIRMED or REJECTED. */
    @AllowNull(true)
    @Column(DataType.STRING(255))
    confirmation_status: 'CONFIRMED' | 'REJECTED'

    @AllowNull(true)
    @Column(DataType.TEXT)
    confirmation_note: string

    @AllowNull(true)
    @Column(DataType.DATE)
    confirmation_at: Date

    @AllowNull(false)
    @Default(DataType.NOW)
    @Index
    @Column(DataType.DATE)
    last_activity_at: Date

    /** When the first staff answer is due (the SLA policy when it opened). */
    @AllowNull(true)
    @Column(DataType.DATE)
    first_response_due_at: Date | null

    /** When the resolution is due; counted again from a reopening. */
    @AllowNull(true)
    @Column(DataType.DATE)
    resolution_due_at: Date | null

    /** Since when the customer waits for an answer: their case, their message. Null once staff answer. */
    @AllowNull(true)
    @Column(DataType.DATE)
    awaiting_reply_since: Date | null

    /** `overdue`, `reply` or null: what the inbox filters on (see `attentionOf`). */
    @AllowNull(true)
    @Column(DataType.STRING(16))
    attention: string | null

    @CreatedAt
    created_at: Date

    @UpdatedAt
    updated_at: Date

    get is_open(): boolean {
        return OPEN_CASE_STATUSES.includes(this.status)
    }

    /** The clocks of a new case; none for one handled elsewhere or already over. */
    @BeforeCreate
    static async caseStartClocks(kase: BaseCase) {
        if (readOnlyReason(kase) || !isOpenStatus(kase.status)) return
        const from = kase.created_at ? new Date(kase.created_at) : new Date()
        if (!kase.awaiting_reply_since && !kase.first_response_at && kase.status !== CaseStatus.WAITING_ON_CUSTOMER) kase.awaiting_reply_since = from
        const due = await dueDates(kase, from)
        if (!kase.first_response_due_at && !kase.first_response_at) kase.first_response_due_at = due.first_response_due_at
        if (!kase.resolution_due_at) kase.resolution_due_at = due.resolution_due_at
        kase.attention = attentionOf(kase)
    }

    @AfterCreate
    static async caseOpened(kase: BaseCase, options: WriteOptions) {
        if (!kase.reference) {
            const reference = referenceOf(kase.id)
            if (reference) await kase.update({ reference }, { transaction: options?.transaction, hooks: false })
        }
        logCaseEvent(kase.id, CaseEventType.CREATED, { to: kase.status }, options)
        // Staff opening one on a customer's behalf know it already.
        if (readOnlyReason(kase) || writtenFrom() === 'back-office') return
        await afterCommit(options, () => alertStaff('created', kase, { type: 'case_created', title: caseTitle.created(kase), body: kase.subject }))
    }

    /** The status's dates and the clocks, whoever changes the case: the app, staff, a sync. */
    @BeforeUpdate
    static async caseMoveClocks(kase: BaseCase) {
        const now = new Date()
        const statusChanged = kase.changed('status')
        if (statusChanged) {
            if (!kase.changed('status_entered_at')) kase.status_entered_at = now
            if (kase.status === CaseStatus.RESOLVED && !kase.changed('resolved_at')) kase.resolved_at = now
            if (kase.status === CaseStatus.CLOSED && !kase.changed('closed_at')) kase.closed_at = now
        }

        // Handled elsewhere: no clock, even if it was not when it opened.
        if (readOnlyReason(kase)) {
            for (const field of ['first_response_due_at', 'resolution_due_at', 'awaiting_reply_since', 'attention'] as const) {
                if (kase[field] !== null && kase[field] !== undefined) (kase as any)[field] = null
            }
            return
        }

        const wasFinished = FINISHED_STATUSES.includes(kase.previous('status') as CaseStatus)
        const finished = FINISHED_STATUSES.includes(kase.status)
        const reopened = statusChanged && wasFinished && !finished
        if (statusChanged && (finished || kase.status === CaseStatus.WAITING_ON_CUSTOMER) && !kase.changed('awaiting_reply_since')) {
            kase.awaiting_reply_since = null
        }
        if (reopened) {
            if (!kase.changed('reopened_count')) kase.reopened_count = (kase.reopened_count ?? 0) + 1
            // The customer reopening waits for an answer; staff reopening do not make them.
            if (writtenFrom() !== 'back-office' && !kase.changed('awaiting_reply_since')) kase.awaiting_reply_since = now
            kase.resolution_due_at = (await dueDates(kase, now)).resolution_due_at
        } else if (!finished && (kase.changed('kind') || kase.changed('category') || kase.changed('priority'))) {
            const due = await dueDates(kase, new Date(kase.created_at ?? now))
            if (!kase.first_response_at) kase.first_response_due_at = due.first_response_due_at
            if (!kase.reopened_count) kase.resolution_due_at = due.resolution_due_at
        }
        const attention = attentionOf(kase, now)
        if (attention !== kase.attention) kase.attention = attention
    }

    @AfterUpdate
    static async caseChanged(kase: BaseCase, options: WriteOptions) {
        const transaction = options?.transaction
        if (kase.changed('status')) {
            const from = kase.previous('status') as CaseStatus
            const reopened = FINISHED_STATUSES.includes(from) && !FINISHED_STATUSES.includes(kase.status)
            logCaseEvent(kase.id, reopened ? CaseEventType.REOPENED : CaseEventType.STATUS, { from, to: kase.status }, { transaction })
        }
        for (const [field, type] of TRACKED) {
            if (kase.changed(field as keyof BaseCase)) logCaseEvent(kase.id, type, { from: kase.previous(field as keyof BaseCase), to: (kase as any)[field] }, { transaction })
        }
        if (kase.changed('confirmation_status') && kase.confirmation_status) {
            const type = kase.confirmation_status === 'REJECTED' ? CaseEventType.REJECTED : CaseEventType.CONFIRMED
            logCaseEvent(kase.id, type, { to: kase.confirmation_status, note: kase.confirmation_note }, { transaction })
        }
        if (kase.changed('satisfaction_rating') && kase.satisfaction_rating !== null && kase.satisfaction_rating !== undefined) {
            logCaseEvent(kase.id, CaseEventType.RATED, { from: kase.previous('satisfaction_rating'), to: kase.satisfaction_rating, note: kase.satisfaction_note }, { transaction })
        }

        if (!readOnlyReason(kase)) {
            const { actor } = currentActor()
            const assignee = kase.assigned_to_user_id
            if (kase.changed('assigned_to_user_id') && assignee && !(actor.type === 'user' && actor.id === assignee)) {
                await afterCommit(options, () => alertStaff('assigned', kase, { type: 'case_assigned', title: caseTitle.assigned(kase), body: kase.subject, userIds: [assignee] }))
            }
            if (kase.changed('confirmation_status') && kase.confirmation_status === 'REJECTED') {
                await afterCommit(options, () =>
                    alertStaff('customerReply', kase, { type: 'case_rejected', title: caseTitle.rejected(kase), body: kase.confirmation_note, assignee: true }),
                )
            }
        }

        // The customer, when staff (or the CRM) resolve or close their case; not when they did it themselves.
        if (options?.notify === false || !kase.changed('status') || !kase.user_id) return
        const kind = kase.status === CaseStatus.RESOLVED ? 'resolved' : kase.status === CaseStatus.CLOSED ? 'closed' : null
        if (kind) await notifyCustomer(kase, kind)
    }

    @AfterDestroy
    static async caseDestroyed(kase: BaseCase, options: WriteOptions) {
        await CaseEvent.destroy({ where: { case_id: kase.id }, transaction: options?.transaction })
    }
}

export { CaseStatus, OPEN_CASE_STATUSES, DONE_STATUSES, FINISHED_STATUSES, CaseAttention, awaitsConfirmation } from '../services/statuses.js'
export type { CaseAttachment, CaseIssue } from '../services/statuses.js'
