var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default } from 'etherial/components/database/provider';
/** An email written in the back-office and sent to an audience, once. */
let MailCampaign = class MailCampaign extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], MailCampaign.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(200)),
    __metadata("design:type", String)
], MailCampaign.prototype, "name", void 0);
__decorate([
    AllowNull(false),
    Default('draft'),
    Column(DataType.STRING(16)),
    __metadata("design:type", String)
], MailCampaign.prototype, "status", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(200)),
    __metadata("design:type", String)
], MailCampaign.prototype, "audience", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(300)),
    __metadata("design:type", String)
], MailCampaign.prototype, "audience_label", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSON),
    __metadata("design:type", Object)
], MailCampaign.prototype, "content", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], MailCampaign.prototype, "scheduled_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], MailCampaign.prototype, "started_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], MailCampaign.prototype, "finished_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(500)),
    __metadata("design:type", String)
], MailCampaign.prototype, "public_url", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], MailCampaign.prototype, "recipients_count", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], MailCampaign.prototype, "sent_count", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], MailCampaign.prototype, "failed_count", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], MailCampaign.prototype, "skipped_count", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], MailCampaign.prototype, "unsubscribed_count", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], MailCampaign.prototype, "error", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], MailCampaign.prototype, "created_by", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], MailCampaign.prototype, "updated_by", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], MailCampaign.prototype, "scheduled_by", void 0);
MailCampaign = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'mail_campaigns',
        freezeTableName: true,
        indexes: [{ fields: ['status', 'scheduled_at'] }],
    })
], MailCampaign);
export { MailCampaign };
