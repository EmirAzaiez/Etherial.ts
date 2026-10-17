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
 * An address that asked for no more campaigns. Campaigns skip it; the
 * emails a person needs (a sign-in code, an appointment) still go out.
 */
let MailUnsubscribe = class MailUnsubscribe extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], MailUnsubscribe.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column({ type: DataType.STRING(320), unique: true }),
    __metadata("design:type", String)
], MailUnsubscribe.prototype, "email", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], MailUnsubscribe.prototype, "user_id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], MailUnsubscribe.prototype, "campaign_id", void 0);
MailUnsubscribe = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        tableName: 'mail_unsubscribes',
        freezeTableName: true,
    })
], MailUnsubscribe);
export { MailUnsubscribe };
