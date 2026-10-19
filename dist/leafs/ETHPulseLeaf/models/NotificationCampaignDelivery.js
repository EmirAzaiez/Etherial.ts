var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Column, Model, AllowNull, PrimaryKey, AutoIncrement, Default, DataType, CreatedAt, UpdatedAt, } from 'etherial/components/database/provider';
/**
 * What happened to a campaign on one device.
 *
 * sent      Expo accepted it (we hold a ticket, the receipt is not in yet)
 * delivered the receipt says Apple / Google took it
 * failed    refused on send, or by Apple / Google in the receipt
 */
export var NotificationDeliveryStatus;
(function (NotificationDeliveryStatus) {
    NotificationDeliveryStatus["SENT"] = "sent";
    NotificationDeliveryStatus["DELIVERED"] = "delivered";
    NotificationDeliveryStatus["FAILED"] = "failed";
})(NotificationDeliveryStatus || (NotificationDeliveryStatus = {}));
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
};
/**
 * One line per (campaign, device). It is the campaign's results: the counters
 * on the campaign are only an aggregate of these rows. No @Table: the project
 * defines it, with the associations to its campaign, device and user models.
 */
export class BaseNotificationCampaignDelivery extends Model {
}
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseNotificationCampaignDelivery.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseNotificationCampaignDelivery.prototype, "campaign_id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseNotificationCampaignDelivery.prototype, "device_id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseNotificationCampaignDelivery.prototype, "user_id", void 0);
__decorate([
    AllowNull(false),
    Default(NotificationDeliveryStatus.SENT),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseNotificationCampaignDelivery.prototype, "status", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseNotificationCampaignDelivery.prototype, "ticket_id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], BaseNotificationCampaignDelivery.prototype, "error", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], BaseNotificationCampaignDelivery.prototype, "receipt_checked_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], BaseNotificationCampaignDelivery.prototype, "opened_at", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], BaseNotificationCampaignDelivery.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date)
], BaseNotificationCampaignDelivery.prototype, "updated_at", void 0);
