var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Op } from 'sequelize';
import { Column, Model, AllowNull, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, Default, BeforeValidate, BeforeSave } from 'etherial/components/database/provider';
import { minutesToLabel, parseMinuteInput, toWeekdayList, WEEKDAY_LABELS } from '../services/slots.js';
/**
 * Base SchedulerWindow (no @Table): weekdays sharing the same hours, the same
 * pace and the same staff. "Tuesday and Thursday, 09:00 to 12:00, 60 minutes,
 * Ahmed and Fatima" is one row; two rows on the same day open the morning and
 * the afternoon and keep the break closed.
 *
 * Hours are minutes from local midnight (09:00 is 540), never timestamps: a
 * weekly window is an intention that repeats, not an instant.
 *
 * The project adds `scheduler_id`'s foreign key, `scheduler`, `agents`
 * (through the hosts) and `window_hosts`.
 */
export class BaseSchedulerWindow extends Model {
    /**
     * Lets the back-office type "09:00" where the column holds 540, and
     * refuses a window ending before it starts. A multiselect sometimes sends
     * one ticked day as a string: Postgres wants `{2}`, not "2".
     */
    static normalizeMinutes(instance) {
        instance.weekdays = toWeekdayList(instance.weekdays);
        instance.start_minute = parseMinuteInput(instance.start_minute);
        instance.end_minute = parseMinuteInput(instance.end_minute);
        if (instance.weekdays.length === 0) {
            throw new Error('scheduler_window.weekdays must name at least one day');
        }
        if (typeof instance.start_minute === 'number' && typeof instance.end_minute === 'number' && instance.end_minute <= instance.start_minute) {
            throw new Error('scheduler_window.end_minute must be after start_minute');
        }
    }
    /**
     * Refuses two windows of the same scheduler overlapping on a day: each has
     * its own length and staff, so a start in both would have two lengths.
     * "Tuesday, Thursday" and "Thursday, Friday" clash on Thursday alone.
     */
    static rejectOverlap(instance) {
        return __awaiter(this, void 0, void 0, function* () {
            const siblings = yield instance.constructor.findAll({
                where: Object.assign({ scheduler_id: instance.scheduler_id }, (instance.id ? { id: { [Op.ne]: instance.id } } : {})),
            });
            const clash = siblings.find((w) => w.weekdays.some((d) => instance.weekdays.includes(d)) && instance.start_minute < w.end_minute && w.start_minute < instance.end_minute);
            if (clash) {
                const day = clash.weekdays.find((d) => instance.weekdays.includes(d));
                throw new Error(`scheduler_window overlaps another window on ${WEEKDAY_LABELS[day]} (${minutesToLabel(clash.start_minute)}–${minutesToLabel(clash.end_minute)})`);
            }
        });
    }
}
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseSchedulerWindow.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseSchedulerWindow.prototype, "scheduler_id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.ARRAY(DataType.INTEGER)),
    __metadata("design:type", Array)
], BaseSchedulerWindow.prototype, "weekdays", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseSchedulerWindow.prototype, "start_minute", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseSchedulerWindow.prototype, "end_minute", void 0);
__decorate([
    AllowNull(false),
    Default(60),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseSchedulerWindow.prototype, "duration_minutes", void 0);
__decorate([
    AllowNull(false),
    Default(30),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseSchedulerWindow.prototype, "slot_step_minutes", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseSchedulerWindow.prototype, "gap_minutes", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseSchedulerWindow.prototype, "max_per_day", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], BaseSchedulerWindow.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date
    /**
     * Lets the back-office type "09:00" where the column holds 540, and
     * refuses a window ending before it starts. A multiselect sometimes sends
     * one ticked day as a string: Postgres wants `{2}`, not "2".
     */
    )
], BaseSchedulerWindow.prototype, "updated_at", void 0);
__decorate([
    BeforeValidate,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BaseSchedulerWindow]),
    __metadata("design:returntype", void 0)
], BaseSchedulerWindow, "normalizeMinutes", null);
__decorate([
    BeforeSave,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BaseSchedulerWindow]),
    __metadata("design:returntype", Promise)
], BaseSchedulerWindow, "rejectOverlap", null);
