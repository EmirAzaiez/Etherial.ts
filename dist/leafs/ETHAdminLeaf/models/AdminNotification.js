var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, Index, } from 'etherial/components/database/provider';
/**
 * One line in one back-office user's inbox: a mention, a flow step, a campaign
 * that finished.
 *
 * A notification sent to five people is five rows, not one row and a join
 * table: each recipient reads it on their own, and the bell only ever asks
 * "how many unread for me", which `(user_id, read_at)` answers from the index.
 * `user_id` and `actor_id` are plain integers for the same reason as in the
 * audit log: the leaf does not know the project's user model.
 */
let AdminNotification = class AdminNotification extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column,
    __metadata("design:type", Number)
], AdminNotification.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], AdminNotification.prototype, "user_id", void 0);
__decorate([
    AllowNull(false),
    Index,
    Column(DataType.STRING(32)),
    __metadata("design:type", String)
], AdminNotification.prototype, "type", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING),
    __metadata("design:type", String)
], AdminNotification.prototype, "title", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], AdminNotification.prototype, "body", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(512)),
    __metadata("design:type", String)
], AdminNotification.prototype, "link", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], AdminNotification.prototype, "collection", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], AdminNotification.prototype, "record_id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], AdminNotification.prototype, "actor_id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Object)
], AdminNotification.prototype, "data", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], AdminNotification.prototype, "read_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], AdminNotification.prototype, "emailed_at", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], AdminNotification.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date)
], AdminNotification.prototype, "updated_at", void 0);
AdminNotification = __decorate([
    Table({
        timestamps: true,
        tableName: 'admin_notifications',
        freezeTableName: true,
        indexes: [{ fields: ['user_id', 'read_at'] }, { fields: ['created_at'] }],
    })
], AdminNotification);
export { AdminNotification };
