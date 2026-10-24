var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Column, Model, AllowNull, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType } from 'etherial/components/database/provider';
/**
 * Base SchedulerWindowHost (no @Table): one agent holding one window. The
 * windows are the only source of agents: a window without anyone offers no slot.
 *
 * The project adds both foreign keys, `window` and `agent`, and a unique index
 * on the pair.
 */
export class BaseSchedulerWindowHost extends Model {
}
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseSchedulerWindowHost.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseSchedulerWindowHost.prototype, "scheduler_window_id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseSchedulerWindowHost.prototype, "agent_id", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], BaseSchedulerWindowHost.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date)
], BaseSchedulerWindowHost.prototype, "updated_at", void 0);
