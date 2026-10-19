var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, } from 'etherial/components/database/provider';
/**
 * One back-office preference of one user (favorites, saved views, hidden
 * columns…), so they follow the account from one browser to the next.
 *
 * One row per key rather than one blob per user: the back-office writes each
 * key on its own, so two tabs saving different keys never overwrite each
 * other. `user_id` is a plain integer, like the login journal's: the leaf does
 * not know the project's user model.
 */
let AdminPreference = class AdminPreference extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column,
    __metadata("design:type", Number)
], AdminPreference.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], AdminPreference.prototype, "user_id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(64)),
    __metadata("design:type", String)
], AdminPreference.prototype, "key", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Object)
], AdminPreference.prototype, "value", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], AdminPreference.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date)
], AdminPreference.prototype, "updated_at", void 0);
AdminPreference = __decorate([
    Table({
        timestamps: true,
        tableName: 'admin_preferences',
        freezeTableName: true,
        indexes: [{ unique: true, fields: ['user_id', 'key'] }],
    })
], AdminPreference);
export { AdminPreference };
