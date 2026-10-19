import { Model } from 'etherial/components/database/provider';
/**
 * What happened to a campaign on one device.
 *
 * sent      Expo accepted it (we hold a ticket, the receipt is not in yet)
 * delivered the receipt says Apple / Google took it
 * failed    refused on send, or by Apple / Google in the receipt
 */
export declare enum NotificationDeliveryStatus {
    SENT = "sent",
    DELIVERED = "delivered",
    FAILED = "failed"
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
export declare const notificationCampaignDeliveryTable: {
    timestamps: boolean;
    tableName: string;
    freezeTableName: boolean;
    indexes: ({
        name: string;
        unique: boolean;
        fields: string[];
    } | {
        name: string;
        fields: string[];
        unique?: undefined;
    })[];
};
/**
 * One line per (campaign, device). It is the campaign's results: the counters
 * on the campaign are only an aggregate of these rows. No @Table: the project
 * defines it, with the associations to its campaign, device and user models.
 */
export declare class BaseNotificationCampaignDelivery extends Model {
    id: number;
    campaign_id: number;
    device_id: number;
    user_id: number | null;
    status: NotificationDeliveryStatus;
    /** Expo ticket id — the key to fetch the receipt. */
    ticket_id: string | null;
    /** Expo's error code (DeviceNotRegistered, MessageRateExceeded, …) or message. */
    error: string | null;
    receipt_checked_at: Date | null;
    /** First tap on the notification on this device. */
    opened_at: Date | null;
    created_at: Date;
    updated_at: Date;
}
