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
/** One address a campaign goes to, listed when the campaign starts. */
let MailCampaignRecipient = class MailCampaignRecipient extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], MailCampaignRecipient.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], MailCampaignRecipient.prototype, "campaign_id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(320)),
    __metadata("design:type", String)
], MailCampaignRecipient.prototype, "email", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], MailCampaignRecipient.prototype, "user_id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(16)),
    __metadata("design:type", String)
], MailCampaignRecipient.prototype, "locale", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Object)
], MailCampaignRecipient.prototype, "data", void 0);
__decorate([
    AllowNull(false),
    Default('pending'),
    Column(DataType.STRING(16)),
    __metadata("design:type", String)
], MailCampaignRecipient.prototype, "status", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(36)),
    __metadata("design:type", String)
], MailCampaignRecipient.prototype, "claim", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], MailCampaignRecipient.prototype, "error", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(300)),
    __metadata("design:type", String)
], MailCampaignRecipient.prototype, "message_id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], MailCampaignRecipient.prototype, "sent_at", void 0);
MailCampaignRecipient = __decorate([
    Table({
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
], MailCampaignRecipient);
export { MailCampaignRecipient };
