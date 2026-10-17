var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, Default, PrimaryKey, AutoIncrement, CreatedAt, DataType, Index, } from 'etherial/components/database/provider';
/**
 * One attempt to sign in to the back-office, kept whether it worked or not.
 *
 * The leaf owns the table, so every project that turns `features.loginJournal`
 * on gets it on its next sync. `user_id` is a plain integer rather than a
 * foreign key: the leaf does not know the project's user model, and a failed
 * attempt on an unknown address has no user at all.
 */
let AdminLoginLog = class AdminLoginLog extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column,
    __metadata("design:type", Number)
], AdminLoginLog.prototype, "id", void 0);
__decorate([
    AllowNull(true),
    Index,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], AdminLoginLog.prototype, "user_id", void 0);
__decorate([
    AllowNull(true),
    Index,
    Column(DataType.STRING),
    __metadata("design:type", String)
], AdminLoginLog.prototype, "identifier", void 0);
__decorate([
    AllowNull(false),
    Default(false),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], AdminLoginLog.prototype, "success", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], AdminLoginLog.prototype, "reason", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], AdminLoginLog.prototype, "ip", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], AdminLoginLog.prototype, "client", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], AdminLoginLog.prototype, "user_agent", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], AdminLoginLog.prototype, "created_at", void 0);
AdminLoginLog = __decorate([
    Table({
        timestamps: true,
        updatedAt: false,
        tableName: 'admin_login_logs',
        freezeTableName: true,
    })
], AdminLoginLog);
export { AdminLoginLog };
