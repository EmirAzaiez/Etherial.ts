var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType } from 'etherial/components/database/provider';
/**
 * Every save of an email in the back-office, and every reset to the code's
 * version: what the email said, who changed it, when. Read by the editor's
 * history, which can bring an old version back.
 */
let MailTemplateVersion = class MailTemplateVersion extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], MailTemplateVersion.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(128)),
    __metadata("design:type", String)
], MailTemplateVersion.prototype, "key", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(16)),
    __metadata("design:type", String)
], MailTemplateVersion.prototype, "locale", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(16)),
    __metadata("design:type", String)
], MailTemplateVersion.prototype, "action", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], MailTemplateVersion.prototype, "subject", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], MailTemplateVersion.prototype, "preheader", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Array)
], MailTemplateVersion.prototype, "blocks", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], MailTemplateVersion.prototype, "created_by", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], MailTemplateVersion.prototype, "restored_from", void 0);
MailTemplateVersion = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        tableName: 'mail_template_versions',
        freezeTableName: true,
        indexes: [{ fields: ['key', 'locale', 'id'] }],
    })
], MailTemplateVersion);
export { MailTemplateVersion };
