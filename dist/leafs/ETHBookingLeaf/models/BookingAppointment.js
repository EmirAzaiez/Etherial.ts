var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Column, Model, AllowNull, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, Default, AfterCreate, AfterUpdate, BeforeUpdate } from 'etherial/components/database/provider';
import { notifyCustomer } from '../services/notices.js';
export var BookingAppointmentStatus;
(function (BookingAppointmentStatus) {
    BookingAppointmentStatus["SCHEDULED"] = "scheduled";
    BookingAppointmentStatus["CANCELLED"] = "cancelled";
    BookingAppointmentStatus["COMPLETED"] = "completed";
    BookingAppointmentStatus["NO_SHOW"] = "no_show";
})(BookingAppointmentStatus || (BookingAppointmentStatus = {}));
/**
 * Base BookingAppointment (no @Table): a customer's appointment with an agent.
 *
 * `starts_at` / `ends_at` are instants (timestamptz), not wall times: the
 * scheduler's zone shows them, it never stores them.
 *
 * The project defines the table with the unique index that makes double
 * booking impossible in the database, not only in the route:
 *
 * ```typescript
 * indexes: [
 *     { name: 'booking_appointments_agent_slot_unique', unique: true,
 *       fields: ['agent_id', 'starts_at', 'slot_seat'], where: { status: 'scheduled' } },
 *     { fields: ['user_id'] },
 *     { fields: ['starts_at'] },
 * ]
 * ```
 *
 * and adds the foreign keys of `user_id`, `agent_id` and `scheduler_id`, the
 * associations `user`, `agent` and `scheduler`, the subject's column (the
 * leaf's `subject.field`) with its association, and a VIRTUAL `property_id`
 * alias of it when the column has another name (the back-office's slot picker
 * reads `property_id`).
 */
export class BaseBookingAppointment extends Model {
    /** A new time is a new appointment for the reminders. */
    static rearmReminders(appointment) {
        if (!appointment.changed('starts_at'))
            return;
        appointment.reminded_day_before_at = null;
        appointment.reminded_soon_at = null;
    }
    /**
     * Told even when the customer booked it: the success screen goes away, the
     * notification stays, and that is where they look the time up again.
     */
    static notifyBooked(appointment, options) {
        if ((options === null || options === void 0 ? void 0 : options.notify) === false || appointment.status !== BookingAppointmentStatus.SCHEDULED)
            return;
        notifyCustomer(appointment, 'confirmed');
    }
    /**
     * Moved, whoever moved it; cancelled, unless the cancel passes `notify:
     * false` (the customer did it). Completed and no-show tell the customer
     * nothing new. Bulk updates (`UPDATE … WHERE id IN`) call no instance hook.
     */
    static notifyChanged(appointment, options) {
        if ((options === null || options === void 0 ? void 0 : options.notify) === false)
            return;
        if (appointment.changed('status') && appointment.status === BookingAppointmentStatus.CANCELLED) {
            notifyCustomer(appointment, 'cancelled');
            return;
        }
        const moved = appointment.changed('starts_at') && new Date(appointment.previous('starts_at')).getTime() !== new Date(appointment.starts_at).getTime();
        if (moved && appointment.status === BookingAppointmentStatus.SCHEDULED) {
            notifyCustomer(appointment, 'rescheduled');
        }
    }
}
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseBookingAppointment.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseBookingAppointment.prototype, "user_id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseBookingAppointment.prototype, "agent_id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseBookingAppointment.prototype, "scheduler_id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], BaseBookingAppointment.prototype, "starts_at", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], BaseBookingAppointment.prototype, "ends_at", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseBookingAppointment.prototype, "duration_minutes", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseBookingAppointment.prototype, "slot_seat", void 0);
__decorate([
    AllowNull(false),
    Default(BookingAppointmentStatus.SCHEDULED),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseBookingAppointment.prototype, "status", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseBookingAppointment.prototype, "notes", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], BaseBookingAppointment.prototype, "cancelled_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseBookingAppointment.prototype, "cancellation_reason", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], BaseBookingAppointment.prototype, "rescheduled_at", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseBookingAppointment.prototype, "reschedule_count", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], BaseBookingAppointment.prototype, "reminded_day_before_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], BaseBookingAppointment.prototype, "reminded_soon_at", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], BaseBookingAppointment.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date
    /** A new time is a new appointment for the reminders. */
    )
], BaseBookingAppointment.prototype, "updated_at", void 0);
__decorate([
    BeforeUpdate,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BaseBookingAppointment]),
    __metadata("design:returntype", void 0)
], BaseBookingAppointment, "rearmReminders", null);
__decorate([
    AfterCreate,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BaseBookingAppointment, Object]),
    __metadata("design:returntype", void 0)
], BaseBookingAppointment, "notifyBooked", null);
__decorate([
    AfterUpdate,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BaseBookingAppointment, Object]),
    __metadata("design:returntype", void 0)
], BaseBookingAppointment, "notifyChanged", null);
