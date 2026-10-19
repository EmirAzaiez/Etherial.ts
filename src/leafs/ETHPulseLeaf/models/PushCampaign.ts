import { Column, AllowNull, Default, DataType } from 'etherial/components/database/provider'
import { BaseNotificationCampaign } from './NotificationCampaign.js'

/**
 * Where a campaign is in its life.
 *
 * draft → scheduled → sending → sent, with `failed` when the dispatch itself
 * threw. Only draft and scheduled campaigns can still be edited or deleted:
 * past that point the message is on people's phones.
 */
export enum NotificationCampaignStatus {
    DRAFT = 'draft',
    SCHEDULED = 'scheduled',
    SENDING = 'sending',
    SENT = 'sent',
    FAILED = 'failed',
}

/** Past `scheduled` the message is on people's phones: no edit, no delete. */
export const EDITABLE_CAMPAIGN_STATUSES: string[] = [NotificationCampaignStatus.DRAFT, NotificationCampaignStatus.SCHEDULED]

/**
 * The table options of a campaign model. The project's model uses them as is,
 * so the table keeps its name (and its rows) whatever the project calls the class:
 *
 * ```typescript
 * @Table(pushCampaignTable)
 * export class NotificationCampaign extends BasePushCampaign {
 *     @ForeignKey(() => User) @AllowNull(true) @Column
 *     declare created_by_user_id: number
 *     @BelongsTo(() => User) declare created_by_user: User
 *     @HasMany(() => NotificationCampaignDelivery, 'campaign_id') deliveries: NotificationCampaignDelivery[]
 *     // + the project's targeting columns (a segment, an account type…)
 * }
 * ```
 */
export const pushCampaignTable = {
    timestamps: true,
    tableName: 'notification_campaigns',
    freezeTableName: true,
}

/**
 * A push campaign of the `campaigns` feature (no @Table: the project defines
 * it, adding its own targeting columns). Every column the engine reads or
 * writes is here: projects sync with `alter`, which drops what a model lacks.
 */
export class BasePushCampaign extends BaseNotificationCampaign {
    /** Push title. Empty → the leaf's `push.defaultNotificationTitle`. */
    @AllowNull(true)
    @Column(DataType.STRING)
    declare title: string | null

    /** Arabic version, sent to the devices the `arabic` option picks. Empty → the English one. */
    @AllowNull(true)
    @Column(DataType.STRING)
    declare title_ar: string | null

    @AllowNull(true)
    @Column(DataType.TEXT)
    declare message_ar: string | null

    /**
     * Also leaves the campaign in the app's notification centre (the bell), so
     * people can find it once the push is gone. Off = push only.
     */
    @AllowNull(false)
    @Default(true)
    @Column(DataType.BOOLEAN)
    declare show_in_notifications: boolean

    @AllowNull(false)
    @Default(NotificationCampaignStatus.DRAFT)
    @Column(DataType.STRING)
    declare status: NotificationCampaignStatus

    /**
     * The back-office "When" choice on create (now / schedule / draft). Never
     * stored: the lifecycle hook turns it into `status` + `scheduled_at`.
     */
    @Column(DataType.VIRTUAL)
    declare send_mode: 'now' | 'schedule' | 'draft' | undefined

    /** When the sweep sends it. Set to "now" by the Send now choice / action. */
    @AllowNull(true)
    @Column(DataType.DATE)
    declare scheduled_at: Date | null

    @AllowNull(true)
    @Column(DataType.DATE)
    declare sent_at: Date | null

    /** Why the dispatch failed, when status is `failed`. */
    @AllowNull(true)
    @Column(DataType.TEXT)
    declare error: string | null

    // ── Results, recomputed from the deliveries (see refreshCampaignStats) ──

    /** Accepted by Expo (ticket ok). */
    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare sent_count: number

    /** Refused by Expo on send, or by Apple/Google in the receipt. */
    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare failed_count: number

    /** Handed over to Apple/Google (receipt ok). */
    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare delivered_count: number

    /** Devices on which the notification was tapped. */
    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare opened_count: number

    /** Opened / sent, as a readable percentage for the back-office. */
    @Column(DataType.VIRTUAL)
    get open_rate(): string | null {
        // The base model's attribute type doesn't know this class's columns.
        const self = this as any
        const sent = self.getDataValue('sent_count')
        if (!sent) {
            return null
        }
        return `${((100 * (self.getDataValue('opened_count') || 0)) / sent).toFixed(1)}%`
    }
}
