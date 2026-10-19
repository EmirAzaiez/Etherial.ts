import {
    Column,
    Model,
    AllowNull,
    PrimaryKey,
    AutoIncrement,
    Default,
    DataType,
    CreatedAt,
    UpdatedAt,
} from 'etherial/components/database/provider'

/**
 * What happened to a campaign on one device.
 *
 * sent      Expo accepted it (we hold a ticket, the receipt is not in yet)
 * delivered the receipt says Apple / Google took it
 * failed    refused on send, or by Apple / Google in the receipt
 */
export enum NotificationDeliveryStatus {
    SENT = 'sent',
    DELIVERED = 'delivered',
    FAILED = 'failed',
}

/**
 * The table options of a delivery model, indexes included: the unique one is
 * what keeps a campaign from being recorded twice on a device.
 *
 * ```typescript
 * @Table(notificationCampaignDeliveryTable)
 * export class NotificationCampaignDelivery extends BaseNotificationCampaignDelivery {
 *     @BelongsTo(() => NotificationCampaign, 'campaign_id') campaign: NotificationCampaign
 *     @BelongsTo(() => Device, 'device_id') device: Device
 *     @BelongsTo(() => User, 'user_id') user: User
 * }
 * ```
 */
export const notificationCampaignDeliveryTable = {
    timestamps: true,
    tableName: 'notification_campaign_deliveries',
    freezeTableName: true,
    indexes: [
        { name: 'notification_campaign_deliveries_unique', unique: true, fields: ['campaign_id', 'device_id'] },
        // The receipt sweep: tickets still waiting for their receipt.
        { name: 'notification_campaign_deliveries_pending', fields: ['status', 'receipt_checked_at'] },
    ],
}

/**
 * One line per (campaign, device). It is the campaign's results: the counters
 * on the campaign are only an aggregate of these rows. No @Table: the project
 * defines it, with the associations to its campaign, device and user models.
 */
export class BaseNotificationCampaignDelivery extends Model {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column(DataType.INTEGER)
    declare id: number

    @AllowNull(false)
    @Column(DataType.INTEGER)
    declare campaign_id: number

    @AllowNull(false)
    @Column(DataType.INTEGER)
    declare device_id: number

    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare user_id: number | null

    @AllowNull(false)
    @Default(NotificationDeliveryStatus.SENT)
    @Column(DataType.STRING)
    declare status: NotificationDeliveryStatus

    /** Expo ticket id — the key to fetch the receipt. */
    @AllowNull(true)
    @Column(DataType.STRING)
    declare ticket_id: string | null

    /** Expo's error code (DeviceNotRegistered, MessageRateExceeded, …) or message. */
    @AllowNull(true)
    @Column(DataType.TEXT)
    declare error: string | null

    @AllowNull(true)
    @Column(DataType.DATE)
    declare receipt_checked_at: Date | null

    /** First tap on the notification on this device. */
    @AllowNull(true)
    @Column(DataType.DATE)
    declare opened_at: Date | null

    @CreatedAt
    declare created_at: Date

    @UpdatedAt
    declare updated_at: Date
}
