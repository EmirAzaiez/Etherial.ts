import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default } from 'etherial/components/database/provider'

/**
 * `draft` → `scheduled` → `preparing` (listing the recipients) → `sending` →
 * `sent`. `cancelled` stops it on the way; `failed` when its audience could
 * not be read.
 */
export type MailCampaignStatus = 'draft' | 'scheduled' | 'preparing' | 'sending' | 'sent' | 'cancelled' | 'failed'

/** An email written in the back-office and sent to an audience, once. */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'mail_campaigns',
    freezeTableName: true,
    indexes: [{ fields: ['status', 'scheduled_at'] }],
})
export class MailCampaign extends Model<MailCampaign> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    /** For the back-office only: recipients never see it. */
    @AllowNull(false)
    @Column(DataType.STRING(200))
    declare name: string

    @AllowNull(false)
    @Default('draft')
    @Column(DataType.STRING(16))
    declare status: MailCampaignStatus

    /** One of the project's audiences, by key. */
    @AllowNull(true)
    @Column(DataType.STRING(200))
    declare audience: string | null

    /** Its name when the campaign was scheduled: the audience may be renamed or deleted since. */
    @AllowNull(true)
    @Column(DataType.STRING(300))
    declare audience_label: string | null

    /** `{ en: { subject, preheader, blocks }, ar: { … } }`. A language left out gets the default one's. */
    @AllowNull(false)
    @Default({})
    @Column(DataType.JSON)
    declare content: Record<string, { subject: string; preheader: string; blocks: any[] }>

    @AllowNull(true)
    @Column(DataType.DATE)
    declare scheduled_at: Date | null

    @AllowNull(true)
    @Column(DataType.DATE)
    declare started_at: Date | null

    @AllowNull(true)
    @Column(DataType.DATE)
    declare finished_at: Date | null

    /** Where the unsubscribe links point: the config's `publicUrl`, else the API's address when it was scheduled. */
    @AllowNull(true)
    @Column(DataType.STRING(500))
    declare public_url: string | null

    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare recipients_count: number

    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare sent_count: number

    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare failed_count: number

    /** Unsubscribed before it left, or stopped by a cancel. */
    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare skipped_count: number

    /** Unsubscribed through this campaign's link. */
    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare unsubscribed_count: number

    @AllowNull(true)
    @Column(DataType.TEXT)
    declare error: string | null

    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare created_by: number | null

    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare updated_by: number | null

    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare scheduled_by: number | null

    declare created_at: Date
    declare updated_at: Date
}
