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
export var FlowRunStatus;
(function (FlowRunStatus) {
    FlowRunStatus["RUNNING"] = "running";
    /** Suspended on a `flow.wait`, with `resume_at` set and the state stored. */
    FlowRunStatus["WAITING"] = "waiting";
    FlowRunStatus["SUCCESS"] = "success";
    FlowRunStatus["FAILED"] = "failed";
})(FlowRunStatus || (FlowRunStatus = {}));
/**
 * One execution of a flow, kept whether it worked or not.
 *
 * The run row is the only thing standing between a customer and "the
 * automation did nothing and I don't know why", so `step_logs` records every
 * step — including the skipped and the failed ones, with the message each of
 * them wrote.
 */
let FlowRun = class FlowRun extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column,
    __metadata("design:type", Number)
], FlowRun.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Index,
    Column,
    __metadata("design:type", Number)
], FlowRun.prototype, "flow_id", void 0);
__decorate([
    AllowNull(false),
    Default(FlowRunStatus.RUNNING),
    Index,
    Column(DataType.STRING),
    __metadata("design:type", String)
], FlowRun.prototype, "status", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], FlowRun.prototype, "trigger_id", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], FlowRun.prototype, "collection", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], FlowRun.prototype, "record_id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Object)
], FlowRun.prototype, "trigger_payload", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Object)
], FlowRun.prototype, "record", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Array)
], FlowRun.prototype, "step_logs", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Object)
], FlowRun.prototype, "state", void 0);
__decorate([
    AllowNull(true),
    Index,
    Column,
    __metadata("design:type", Date)
], FlowRun.prototype, "resume_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], FlowRun.prototype, "error", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], FlowRun.prototype, "actor_type", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Number)
], FlowRun.prototype, "actor_id", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date)
], FlowRun.prototype, "started_at", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date)
], FlowRun.prototype, "ended_at", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Number)
], FlowRun.prototype, "duration_ms", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], FlowRun.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date)
], FlowRun.prototype, "updated_at", void 0);
FlowRun = __decorate([
    Table({
        timestamps: true,
        tableName: 'flow_runs',
        freezeTableName: true,
    })
], FlowRun);
export { FlowRun };
