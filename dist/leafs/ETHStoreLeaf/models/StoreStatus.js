var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, PrimaryKey, DataType } from 'etherial/components/database/provider';
/** Where each store's sync stands: one row per store, shared by every server. */
let StoreStatus = class StoreStatus extends Model {
};
__decorate([
    PrimaryKey,
    Column(DataType.STRING(16)),
    __metadata("design:type", String)
], StoreStatus.prototype, "store", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], StoreStatus.prototype, "synced_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], StoreStatus.prototype, "sync_started_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], StoreStatus.prototype, "error", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], StoreStatus.prototype, "notice", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATEONLY),
    __metadata("design:type", String)
], StoreStatus.prototype, "data_through", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATEONLY),
    __metadata("design:type", String)
], StoreStatus.prototype, "backfilled_from", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Object)
], StoreStatus.prototype, "app", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Object)
], StoreStatus.prototype, "cursor", void 0);
StoreStatus = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'store_statuses',
        freezeTableName: true,
    })
], StoreStatus);
export { StoreStatus };
