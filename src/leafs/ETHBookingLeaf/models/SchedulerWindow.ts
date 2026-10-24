import { Op } from 'sequelize'
import { Column, Model, AllowNull, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, Default, BeforeValidate, BeforeSave } from 'etherial/components/database/provider'

import { minutesToLabel, parseMinuteInput, toWeekdayList, WEEKDAY_LABELS } from '../services/slots.js'

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
export class BaseSchedulerWindow extends Model<any> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column(DataType.INTEGER)
    id: number

    @AllowNull(false)
    @Column(DataType.INTEGER)
    scheduler_id: number

    /** The days it opens, as `Date.getDay()`: 0 Sunday … 6 Saturday. */
    @AllowNull(false)
    @Column(DataType.ARRAY(DataType.INTEGER))
    weekdays: number[]

    @AllowNull(false)
    @Column(DataType.INTEGER)
    start_minute: number

    @AllowNull(false)
    @Column(DataType.INTEGER)
    end_minute: number

    /** How long an appointment lasts in it. */
    @AllowNull(false)
    @Default(60)
    @Column(DataType.INTEGER)
    duration_minutes: number

    /** Between two offered starts: one-hour visits every quarter hour fill a day much finer. */
    @AllowNull(false)
    @Default(30)
    @Column(DataType.INTEGER)
    slot_step_minutes: number

    /** Free time kept on each side of an appointment. */
    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    gap_minutes: number

    /** Appointments it takes on one day: it closes the window, not the day. */
    @AllowNull(true)
    @Column(DataType.INTEGER)
    max_per_day: number

    @CreatedAt
    created_at: Date

    @UpdatedAt
    updated_at: Date

    /**
     * Lets the back-office type "09:00" where the column holds 540, and
     * refuses a window ending before it starts. A multiselect sometimes sends
     * one ticked day as a string: Postgres wants `{2}`, not "2".
     */
    @BeforeValidate
    static normalizeMinutes(instance: BaseSchedulerWindow) {
        instance.weekdays = toWeekdayList(instance.weekdays)
        instance.start_minute = parseMinuteInput(instance.start_minute) as number
        instance.end_minute = parseMinuteInput(instance.end_minute) as number

        if (instance.weekdays.length === 0) {
            throw new Error('scheduler_window.weekdays must name at least one day')
        }

        if (typeof instance.start_minute === 'number' && typeof instance.end_minute === 'number' && instance.end_minute <= instance.start_minute) {
            throw new Error('scheduler_window.end_minute must be after start_minute')
        }
    }

    /**
     * Refuses two windows of the same scheduler overlapping on a day: each has
     * its own length and staff, so a start in both would have two lengths.
     * "Tuesday, Thursday" and "Thursday, Friday" clash on Thursday alone.
     */
    @BeforeSave
    static async rejectOverlap(instance: BaseSchedulerWindow) {
        const siblings: BaseSchedulerWindow[] = await (instance.constructor as any).findAll({
            where: {
                scheduler_id: instance.scheduler_id,
                ...(instance.id ? { id: { [Op.ne]: instance.id } } : {}),
            },
        })

        const clash = siblings.find(
            (w) => w.weekdays.some((d) => instance.weekdays.includes(d)) && instance.start_minute < w.end_minute && w.start_minute < instance.end_minute
        )

        if (clash) {
            const day = clash.weekdays.find((d) => instance.weekdays.includes(d))
            throw new Error(
                `scheduler_window overlaps another window on ${WEEKDAY_LABELS[day as number]} (${minutesToLabel(clash.start_minute)}–${minutesToLabel(clash.end_minute)})`
            )
        }
    }
}
