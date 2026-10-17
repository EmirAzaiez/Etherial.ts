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
 * The back-office's version of one email in one language. While it exists it
 * is sent instead of the one written in the project's code; deleting it goes
 * back to the code's.
 */
let MailTemplate = class MailTemplate extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], MailTemplate.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(128)),
    __metadata("design:type", String)
], MailTemplate.prototype, "key", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(16)),
    __metadata("design:type", String)
], MailTemplate.prototype, "locale", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], MailTemplate.prototype, "subject", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], MailTemplate.prototype, "preheader", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.JSON),
    __metadata("design:type", Array)
], MailTemplate.prototype, "blocks", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], MailTemplate.prototype, "updated_by", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(40)),
    __metadata("design:type", String)
], MailTemplate.prototype, "default_hash", void 0);
MailTemplate = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'mail_templates',
        freezeTableName: true,
        indexes: [{ unique: true, fields: ['key', 'locale'] }],
    })
], MailTemplate);
export { MailTemplate };
