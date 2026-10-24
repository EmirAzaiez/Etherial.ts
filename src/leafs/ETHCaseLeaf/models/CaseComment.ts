import { Column, Model, AllowNull, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, Default, Index, AfterCreate } from 'etherial/components/database/provider'

import { afterCommit } from './Case.js'
import { alertStaff, caseTitle, notifyCustomer } from '../services/notices.js'
import { caseModels, readOnlyReason } from '../services/options.js'
import { CaseStatus, type CaseAttachment } from '../services/statuses.js'

/**
 * Base CaseComment (no @Table): a message on a case, from the customer
 * (`resident`) or from staff. A staff message is a reply the customer reads,
 * or an internal note they never see.
 *
 * The project declares the table and adds the foreign keys and associations
 * of `case_id` and `author_user_id`:
 *
 * ```typescript
 * @Table({ timestamps: true, tableName: 'case_comments', freezeTableName: true })
 * export class CaseComment extends BaseCaseComment {
 *     @ForeignKey(() => Case)
 *     declare case_id: number
 *
 *     @BelongsTo(() => Case)
 *     declare case: Case
 * }
 * ```
 */
export class BaseCaseComment extends Model<any> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column(DataType.INTEGER)
    id: number

    @AllowNull(false)
    @Index
    @Column(DataType.INTEGER)
    case_id: number

    @AllowNull(true)
    @Column(DataType.INTEGER)
    author_user_id: number

    @AllowNull(false)
    @Default('staff')
    @Column(DataType.STRING(255))
    author_kind: 'staff' | 'resident'

    /** As the customer reads it: the staff member's first name, or "Customer care". */
    @AllowNull(true)
    @Column(DataType.STRING(255))
    author_name: string

    @AllowNull(false)
    @Column(DataType.TEXT)
    body: string

    /** Between staff: the customer neither sees it nor is told. */
    @AllowNull(false)
    @Default(false)
    @Column(DataType.BOOLEAN)
    internal: boolean

    /** Files staff put on the message (Media rows, by id). */
    @AllowNull(false)
    @Default([])
    @Column(DataType.JSONB)
    attachments: CaseAttachment[]

    @CreatedAt
    created_at: Date

    @UpdatedAt
    updated_at: Date

    /**
     * A staff reply answers the customer: it starts the "answered" clock and
     * tells them (unless `{ notify: false }`). A customer message puts the
     * case back in the staff's hands and alerts them.
     */
    @AfterCreate
    static async commentPosted(comment: BaseCaseComment, options: { notify?: boolean; transaction?: any }) {
        if (comment.author_kind === 'staff' && comment.internal) return
        const transaction = options?.transaction
        const kase = await caseModels().Case.findByPk(comment.case_id, { transaction })
        if (!kase) return
        const now = new Date()

        if (comment.author_kind === 'staff') {
            await kase.update({ first_response_at: kase.first_response_at ?? now, last_activity_at: now, awaiting_reply_since: null }, { notify: false, transaction } as any)
            if (options?.notify === false) return
            await notifyCustomer(kase, 'reply', comment)
            return
        }

        await kase.update(
            {
                last_activity_at: now,
                awaiting_reply_since: kase.awaiting_reply_since ?? now,
                ...(kase.status === CaseStatus.WAITING_ON_CUSTOMER ? { status: CaseStatus.IN_PROGRESS } : {}),
            },
            { notify: false, transaction } as any,
        )
        if (readOnlyReason(kase)) return
        await afterCommit(options, () => alertStaff('customerReply', kase, { type: 'case_reply', title: caseTitle.reply(kase), body: comment.body, assignee: true }))
    }
}
