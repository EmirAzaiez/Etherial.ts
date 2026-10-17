var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, CreatedAt, DataType, Index, } from 'etherial/components/database/provider';
/**
 * One change to one record: who made it, from where, and every column it
 * touched with its value before and after.
 *
 * Rows are keyed by model rather than by collection, so a record listed in two
 * collections (users and staff, say) shows the same history in both. The leaf
 * owns the table: projects that turn `features.audit` on get it on their next
 * sync. `actor_id` is a plain integer for the same reason as in the login
 * journal: the leaf does not know the project's user model, and Salesforce or
 * a cron job has no user at all.
 */
let AdminAuditLog = class AdminAuditLog extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column,
    __metadata("design:type", Number)
], AdminAuditLog.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Index,
    Column(DataType.STRING),
    __metadata("design:type", String)
], AdminAuditLog.prototype, "collection", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING),
    __metadata("design:type", String)
], AdminAuditLog.prototype, "model", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING),
    __metadata("design:type", String)
], AdminAuditLog.prototype, "record_id", void 0);
__decorate([
    AllowNull(false),
    Index,
    Column(DataType.STRING(16)),
    __metadata("design:type", String)
], AdminAuditLog.prototype, "action", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.JSON),
    __metadata("design:type", Object)
], AdminAuditLog.prototype, "changes", void 0);
__decorate([
    AllowNull(false),
    Index,
    Column(DataType.STRING(32)),
    __metadata("design:type", String)
], AdminAuditLog.prototype, "actor_type", void 0);
__decorate([
    AllowNull(true),
    Index,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], AdminAuditLog.prototype, "actor_id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], AdminAuditLog.prototype, "actor_label", void 0);
__decorate([
    AllowNull(true),
    Index,
    Column(DataType.STRING(32)),
    __metadata("design:type", String)
], AdminAuditLog.prototype, "source", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Object)
], AdminAuditLog.prototype, "meta", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], AdminAuditLog.prototype, "created_at", void 0);
AdminAuditLog = __decorate([
    Table({
        timestamps: true,
        updatedAt: false,
        tableName: 'admin_audit_logs',
        freezeTableName: true,
        indexes: [{ fields: ['model', 'record_id', 'id'] }, { fields: ['created_at'] }],
    })
], AdminAuditLog);
export { AdminAuditLog };
