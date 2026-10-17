import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default } from 'etherial/components/database/provider'

/**
 * `pending` → `sending` (taken by a batch) → `sent` | `failed`. `skipped`:
 * unsubscribed before it left. `cancelled`: the campaign was stopped first.
 */
export type MailRecipientStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped' | 'cancelled'

/** One address a campaign goes to, listed when the campaign starts. */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'mail_campaign_recipients',
    freezeTableName: true,
    indexes: [
        { unique: true, fields: ['campaign_id', 'email'] },
        { fields: ['campaign_id', 'status'] },
        { fields: ['claim'] },
    ],
})
export class MailCampaignRecipient extends Model<MailCampaignRecipient> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    @AllowNull(false)
    @Column(DataType.INTEGER)
    declare campaign_id: number

    /** Lower case. */
    @AllowNull(false)
    @Column(DataType.STRING(320))
    declare email: string

    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare user_id: number | null

    @AllowNull(false)
    @Column(DataType.STRING(16))
    declare locale: string

    /** What fills this person's `{{variables}}`: their first name… */
    @AllowNull(true)
    @Column(DataType.JSON)
    declare data: Record<string, unknown> | null

    @AllowNull(false)
    @Default('pending')
    @Column(DataType.STRING(16))
    declare status: MailRecipientStatus

    /** The batch that took it: two servers never send the same email. */
    @AllowNull(true)
    @Column(DataType.STRING(36))
    declare claim: string | null

    @AllowNull(true)
    @Column(DataType.TEXT)
    declare error: string | null

    @AllowNull(true)
    @Column(DataType.STRING(300))
    declare message_id: string | null

    @AllowNull(true)
    @Column(DataType.DATE)
    declare sent_at: Date | null

    declare created_at: Date
    declare updated_at: Date
}
