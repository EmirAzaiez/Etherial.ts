var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Column, AllowNull, Default, DataType } from 'etherial/components/database/provider';
import { BaseNotificationCampaign } from './NotificationCampaign.js';
/**
 * Where a campaign is in its life.
 *
 * draft → scheduled → sending → sent, with `failed` when the dispatch itself
 * threw. Only draft and scheduled campaigns can still be edited or deleted:
 * past that point the message is on people's phones.
 */
export var NotificationCampaignStatus;
(function (NotificationCampaignStatus) {
    NotificationCampaignStatus["DRAFT"] = "draft";
    NotificationCampaignStatus["SCHEDULED"] = "scheduled";
    NotificationCampaignStatus["SENDING"] = "sending";
    NotificationCampaignStatus["SENT"] = "sent";
    NotificationCampaignStatus["FAILED"] = "failed";
})(NotificationCampaignStatus || (NotificationCampaignStatus = {}));
/** Past `scheduled` the message is on people's phones: no edit, no delete. */
export const EDITABLE_CAMPAIGN_STATUSES = [NotificationCampaignStatus.DRAFT, NotificationCampaignStatus.SCHEDULED];
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
};
/**
 * A push campaign of the `campaigns` feature (no @Table: the project defines
 * it, adding its own targeting columns). Every column the engine reads or
 * writes is here: projects sync with `alter`, which drops what a model lacks.
 */
export class BasePushCampaign extends BaseNotificationCampaign {
    /** Opened / sent, as a readable percentage for the back-office. */
    get open_rate() {
        // The base model's attribute type doesn't know this class's columns.
        const self = this;
        const sent = self.getDataValue('sent_count');
        if (!sent) {
            return null;
        }
        return `${((100 * (self.getDataValue('opened_count') || 0)) / sent).toFixed(1)}%`;
    }
}
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BasePushCampaign.prototype, "title", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BasePushCampaign.prototype, "title_ar", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], BasePushCampaign.prototype, "message_ar", void 0);
__decorate([
    AllowNull(false),
    Default(true),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], BasePushCampaign.prototype, "show_in_notifications", void 0);
__decorate([
    AllowNull(false),
    Default(NotificationCampaignStatus.DRAFT),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BasePushCampaign.prototype, "status", void 0);
__decorate([
    Column(DataType.VIRTUAL),
    __metadata("design:type", String)
], BasePushCampaign.prototype, "send_mode", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], BasePushCampaign.prototype, "scheduled_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], BasePushCampaign.prototype, "sent_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], BasePushCampaign.prototype, "error", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BasePushCampaign.prototype, "sent_count", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BasePushCampaign.prototype, "failed_count", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BasePushCampaign.prototype, "delivered_count", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BasePushCampaign.prototype, "opened_count", void 0);
__decorate([
    Column(DataType.VIRTUAL),
    __metadata("design:type", String),
    __metadata("design:paramtypes", [])
], BasePushCampaign.prototype, "open_rate", null);
