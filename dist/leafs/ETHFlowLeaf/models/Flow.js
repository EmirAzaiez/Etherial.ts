var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, Default, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, Index, } from 'etherial/components/database/provider';
/**
 * One automation, as the customer built it.
 *
 * Unlike the ETHPulseLeaf models, this one ships with its `@Table` and is
 * registered by the leaf itself: it has no foreign key into the project's own
 * schema — `created_by_user_id` is a plain integer, deliberately not an
 * association — so there is nothing for a project to extend, and asking every
 * project to redeclare three tables to get automations would be a poor trade.
 */
let Flow = class Flow extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column,
    __metadata("design:type", Number)
], Flow.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column,
    __metadata("design:type", String)
], Flow.prototype, "name", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], Flow.prototype, "description", void 0);
__decorate([
    AllowNull(false),
    Default(false),
    Index,
    Column,
    __metadata("design:type", Boolean)
], Flow.prototype, "enabled", void 0);
__decorate([
    AllowNull(false),
    Index,
    Column,
    __metadata("design:type", String)
], Flow.prototype, "trigger_id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Object)
], Flow.prototype, "trigger_config", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Object)
], Flow.prototype, "graph", void 0);
__decorate([
    AllowNull(true),
    Index,
    Column,
    __metadata("design:type", String)
], Flow.prototype, "webhook_token", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Number)
], Flow.prototype, "created_by_user_id", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date)
], Flow.prototype, "last_run_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], Flow.prototype, "last_error", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column,
    __metadata("design:type", Number)
], Flow.prototype, "run_count", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column,
    __metadata("design:type", Number)
], Flow.prototype, "error_count", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date)
], Flow.prototype, "last_tick_at", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date)
], Flow.prototype, "deleted_at", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], Flow.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date)
], Flow.prototype, "updated_at", void 0);
Flow = __decorate([
    Table({
        timestamps: true,
        tableName: 'flows',
        freezeTableName: true,
    })
], Flow);
export { Flow };
