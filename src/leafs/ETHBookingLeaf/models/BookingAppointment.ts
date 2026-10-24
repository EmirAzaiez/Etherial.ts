import { Column, Model, AllowNull, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, Default, AfterCreate, AfterUpdate, BeforeUpdate } from 'etherial/components/database/provider'

import { notifyCustomer } from '../services/notices.js'

export enum BookingAppointmentStatus {
    SCHEDULED = 'scheduled',
    CANCELLED = 'cancelled',
    COMPLETED = 'completed',
    NO_SHOW = 'no_show',
}

/** The options the hooks read: `notify: false` keeps the customer from being told. */
type NotifyOptions = { notify?: boolean }

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
export class BaseBookingAppointment extends Model<any> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column(DataType.INTEGER)
    id: number

    /** The customer. */
    @AllowNull(false)
    @Column(DataType.INTEGER)
    user_id: number

    @AllowNull(false)
    @Column(DataType.INTEGER)
    agent_id: number

    @AllowNull(false)
    @Column(DataType.INTEGER)
    scheduler_id: number

    @AllowNull(false)
    @Column(DataType.DATE)
    starts_at: Date

    @AllowNull(false)
    @Column(DataType.DATE)
    ends_at: Date

    @AllowNull(false)
    @Column(DataType.INTEGER)
    duration_minutes: number

    /**
     * Which of the agent's seats it takes at that start: with the unique index,
     * an agent receiving several customers at once keeps one row per seat, and
     * the seats stay bounded by `Agent.max_concurrent_appointments`.
     */
    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    slot_seat: number

    @AllowNull(false)
    @Default(BookingAppointmentStatus.SCHEDULED)
    @Column(DataType.STRING)
    status: BookingAppointmentStatus

    @AllowNull(true)
    @Column(DataType.STRING)
    notes: string

    @AllowNull(true)
    @Column(DataType.DATE)
    cancelled_at: Date

    @AllowNull(true)
    @Column(DataType.STRING)
    cancellation_reason: string

    @AllowNull(true)
    @Column(DataType.DATE)
    rescheduled_at: Date

    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    reschedule_count: number

    /** When the day-before reminder went out: each reminder goes out once. */
    @AllowNull(true)
    @Column(DataType.DATE)
    reminded_day_before_at: Date | null

    @AllowNull(true)
    @Column(DataType.DATE)
    reminded_soon_at: Date | null

    @CreatedAt
    created_at: Date

    @UpdatedAt
    updated_at: Date

    /** A new time is a new appointment for the reminders. */
    @BeforeUpdate
    static rearmReminders(appointment: BaseBookingAppointment) {
        if (!appointment.changed('starts_at')) return
        appointment.reminded_day_before_at = null
        appointment.reminded_soon_at = null
    }

    /**
     * Told even when the customer booked it: the success screen goes away, the
     * notification stays, and that is where they look the time up again.
     */
    @AfterCreate
    static notifyBooked(appointment: BaseBookingAppointment, options: NotifyOptions) {
        if (options?.notify === false || appointment.status !== BookingAppointmentStatus.SCHEDULED) return
        notifyCustomer(appointment, 'confirmed')
    }

    /**
     * Moved, whoever moved it; cancelled, unless the cancel passes `notify:
     * false` (the customer did it). Completed and no-show tell the customer
     * nothing new. Bulk updates (`UPDATE … WHERE id IN`) call no instance hook.
     */
    @AfterUpdate
    static notifyChanged(appointment: BaseBookingAppointment, options: NotifyOptions) {
        if (options?.notify === false) return

        if (appointment.changed('status') && appointment.status === BookingAppointmentStatus.CANCELLED) {
            notifyCustomer(appointment, 'cancelled')
            return
        }

        const moved = appointment.changed('starts_at') && new Date(appointment.previous('starts_at')).getTime() !== new Date(appointment.starts_at).getTime()
        if (moved && appointment.status === BookingAppointmentStatus.SCHEDULED) {
            notifyCustomer(appointment, 'rescheduled')
        }
    }
}
