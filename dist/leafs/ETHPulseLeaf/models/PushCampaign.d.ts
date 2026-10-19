import { BaseNotificationCampaign } from './NotificationCampaign.js';
/**
 * Where a campaign is in its life.
 *
 * draft → scheduled → sending → sent, with `failed` when the dispatch itself
 * threw. Only draft and scheduled campaigns can still be edited or deleted:
 * past that point the message is on people's phones.
 */
export declare enum NotificationCampaignStatus {
    DRAFT = "draft",
    SCHEDULED = "scheduled",
    SENDING = "sending",
    SENT = "sent",
    FAILED = "failed"
}
/** Past `scheduled` the message is on people's phones: no edit, no delete. */
export declare const EDITABLE_CAMPAIGN_STATUSES: string[];
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
export declare const pushCampaignTable: {
    timestamps: boolean;
    tableName: string;
    freezeTableName: boolean;
};
/**
 * A push campaign of the `campaigns` feature (no @Table: the project defines
 * it, adding its own targeting columns). Every column the engine reads or
 * writes is here: projects sync with `alter`, which drops what a model lacks.
 */
export declare class BasePushCampaign extends BaseNotificationCampaign {
    /** Push title. Empty → the leaf's `push.defaultNotificationTitle`. */
    title: string | null;
    /** Arabic version, sent to the devices the `arabic` option picks. Empty → the English one. */
    title_ar: string | null;
    message_ar: string | null;
    /**
     * Also leaves the campaign in the app's notification centre (the bell), so
     * people can find it once the push is gone. Off = push only.
     */
    show_in_notifications: boolean;
    status: NotificationCampaignStatus;
    /**
     * The back-office "When" choice on create (now / schedule / draft). Never
     * stored: the lifecycle hook turns it into `status` + `scheduled_at`.
     */
    send_mode: 'now' | 'schedule' | 'draft' | undefined;
    /** When the sweep sends it. Set to "now" by the Send now choice / action. */
    scheduled_at: Date | null;
    sent_at: Date | null;
    /** Why the dispatch failed, when status is `failed`. */
    error: string | null;
    /** Accepted by Expo (ticket ok). */
    sent_count: number;
    /** Refused by Expo on send, or by Apple/Google in the receipt. */
    failed_count: number;
    /** Handed over to Apple/Google (receipt ok). */
    delivered_count: number;
    /** Devices on which the notification was tapped. */
    opened_count: number;
    /** Opened / sent, as a readable percentage for the back-office. */
    get open_rate(): string | null;
}
