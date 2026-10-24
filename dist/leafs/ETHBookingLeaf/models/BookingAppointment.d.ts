import { Model } from 'etherial/components/database/provider';
export declare enum BookingAppointmentStatus {
    SCHEDULED = "scheduled",
    CANCELLED = "cancelled",
    COMPLETED = "completed",
    NO_SHOW = "no_show"
}
/** The options the hooks read: `notify: false` keeps the customer from being told. */
type NotifyOptions = {
    notify?: boolean;
};
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
export declare class BaseBookingAppointment extends Model<any> {
    id: number;
    /** The customer. */
    user_id: number;
    agent_id: number;
    scheduler_id: number;
    starts_at: Date;
    ends_at: Date;
    duration_minutes: number;
    /**
     * Which of the agent's seats it takes at that start: with the unique index,
     * an agent receiving several customers at once keeps one row per seat, and
     * the seats stay bounded by `Agent.max_concurrent_appointments`.
     */
    slot_seat: number;
    status: BookingAppointmentStatus;
    notes: string;
    cancelled_at: Date;
    cancellation_reason: string;
    rescheduled_at: Date;
    reschedule_count: number;
    /** When the day-before reminder went out: each reminder goes out once. */
    reminded_day_before_at: Date | null;
    reminded_soon_at: Date | null;
    created_at: Date;
    updated_at: Date;
    /** A new time is a new appointment for the reminders. */
    static rearmReminders(appointment: BaseBookingAppointment): void;
    /**
     * Told even when the customer booked it: the success screen goes away, the
     * notification stays, and that is where they look the time up again.
     */
    static notifyBooked(appointment: BaseBookingAppointment, options: NotifyOptions): void;
    /**
     * Moved, whoever moved it; cancelled, unless the cancel passes `notify:
     * false` (the customer did it). Completed and no-show tell the customer
     * nothing new. Bulk updates (`UPDATE … WHERE id IN`) call no instance hook.
     */
    static notifyChanged(appointment: BaseBookingAppointment, options: NotifyOptions): void;
}
export {};
