var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Column, Model, AllowNull, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, BeforeValidate } from 'etherial/components/database/provider';
import { parseMinuteInput } from '../services/slots.js';
/**
 * Base SchedulerBlock (no @Table): a closure. Both keys are optional and
 * combine:
 *
 *   agent + scheduler → the agent takes nothing for that scheduler that day
 *   agent alone       → the agent's day off, everywhere
 *   scheduler alone   → the scheduler is closed that day, for everyone
 *   neither           → closed for all (a national holiday)
 *
 * No `start_minute` closes the whole day; with one, only that slice. A whole
 * closed day always wins over a slice.
 *
 * The project adds both foreign keys, `scheduler` and `agent`.
 */
export class BaseSchedulerBlock extends Model {
    /** Lets the back-office type "12:00" where the column holds 720. */
    static normalizeMinutes(instance) {
        instance.start_minute = parseMinuteInput(instance.start_minute);
        instance.end_minute = parseMinuteInput(instance.end_minute);
    }
}
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseSchedulerBlock.prototype, "id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseSchedulerBlock.prototype, "scheduler_id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseSchedulerBlock.prototype, "agent_id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.DATEONLY),
    __metadata("design:type", String)
], BaseSchedulerBlock.prototype, "day", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseSchedulerBlock.prototype, "start_minute", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseSchedulerBlock.prototype, "end_minute", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseSchedulerBlock.prototype, "reason", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], BaseSchedulerBlock.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date
    /** Lets the back-office type "12:00" where the column holds 720. */
    )
], BaseSchedulerBlock.prototype, "updated_at", void 0);
__decorate([
    BeforeValidate,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BaseSchedulerBlock]),
    __metadata("design:returntype", void 0)
], BaseSchedulerBlock, "normalizeMinutes", null);
