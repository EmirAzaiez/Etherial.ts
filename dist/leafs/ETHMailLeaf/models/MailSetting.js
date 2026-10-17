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
 * The leaf's settings that live in the database: the brand as the back-office
 * changed it (`theme`), the secret that signs unsubscribe links.
 */
let MailSetting = class MailSetting extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], MailSetting.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column({ type: DataType.STRING(64), unique: true }),
    __metadata("design:type", String)
], MailSetting.prototype, "key", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Object)
], MailSetting.prototype, "value", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], MailSetting.prototype, "updated_by", void 0);
MailSetting = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'mail_settings',
        freezeTableName: true,
    })
], MailSetting);
export { MailSetting };
