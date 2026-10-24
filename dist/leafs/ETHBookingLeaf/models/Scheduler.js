var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Column, Model, AllowNull, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, Default } from 'etherial/components/database/provider';
/** What the appointment is for: the back-office sorts and filters on it, the app doesn't show it. */
export var SchedulerKind;
(function (SchedulerKind) {
    SchedulerKind["HANDOVER"] = "HANDOVER";
    SchedulerKind["SITE_VISIT"] = "SITE_VISIT";
    SchedulerKind["MAINTENANCE"] = "MAINTENANCE";
    SchedulerKind["MEETING"] = "MEETING";
})(SchedulerKind || (SchedulerKind = {}));
/**
 * Base Scheduler (no @Table: the project defines it): one reason to meet a
 * customer (the key handover, a site visit), with its notice, its horizon,
 * its rules and its on/off switch. Its opening hours and its staff are its
 * windows'.
 *
 * What it belongs to (a project) is the project's column, named in the
 * leaf's `scope` option, with its association `scope.model` in lower case.
 *
 * @example
 * ```typescript
 * @Table({ timestamps: true, tableName: 'schedulers', freezeTableName: true })
 * export class Scheduler extends BaseScheduler {
 *     @ForeignKey(() => Project)
 *     @AllowNull(true)
 *     @Column
 *     declare project_id: number
 *
 *     @BelongsTo(() => Project)
 *     declare project: Project
 *
 *     @HasMany(() => SchedulerWindow)
 *     declare windows: SchedulerWindow[]
 *
 *     @HasMany(() => SchedulerBlock)
 *     declare blocks: SchedulerBlock[]
 *
 *     @HasMany(() => BookingAppointment)
 *     declare appointments: BookingAppointment[]
 * }
 * ```
 */
export class BaseScheduler extends Model {
}
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseScheduler.prototype, "id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseScheduler.prototype, "label", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseScheduler.prototype, "label_ar", void 0);
__decorate([
    AllowNull(false),
    Default(SchedulerKind.SITE_VISIT),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseScheduler.prototype, "kind", void 0);
__decorate([
    AllowNull(false),
    Default(false),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], BaseScheduler.prototype, "active", void 0);
__decorate([
    AllowNull(false),
    Default(true),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], BaseScheduler.prototype, "show_in_mobile_app", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATEONLY),
    __metadata("design:type", String)
], BaseScheduler.prototype, "starts_on", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATEONLY),
    __metadata("design:type", String)
], BaseScheduler.prototype, "ends_on", void 0);
__decorate([
    AllowNull(false),
    Default(1),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseScheduler.prototype, "lead_time_days", void 0);
__decorate([
    AllowNull(false),
    Default(false),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], BaseScheduler.prototype, "lead_time_working_days", void 0);
__decorate([
    AllowNull(false),
    Default(60),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseScheduler.prototype, "horizon_days", void 0);
__decorate([
    AllowNull(false),
    Default(true),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], BaseScheduler.prototype, "allow_cancellation", void 0);
__decorate([
    AllowNull(false),
    Default(48),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseScheduler.prototype, "cancellation_notice_hours", void 0);
__decorate([
    AllowNull(false),
    Default(true),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], BaseScheduler.prototype, "allow_reschedule", void 0);
__decorate([
    AllowNull(false),
    Default(48),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseScheduler.prototype, "reschedule_notice_hours", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseScheduler.prototype, "max_reschedules", void 0);
__decorate([
    AllowNull(true),
    Default(1),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseScheduler.prototype, "max_active_appointments", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseScheduler.prototype, "max_appointments_total", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseScheduler.prototype, "location", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseScheduler.prototype, "location_ar", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], BaseScheduler.prototype, "instructions", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], BaseScheduler.prototype, "instructions_ar", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseScheduler.prototype, "timezone", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.ARRAY(DataType.INTEGER)),
    __metadata("design:type", Array)
], BaseScheduler.prototype, "weekend_days", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], BaseScheduler.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date)
], BaseScheduler.prototype, "updated_at", void 0);
