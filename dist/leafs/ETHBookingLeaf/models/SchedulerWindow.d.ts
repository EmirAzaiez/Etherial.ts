import { Model } from 'etherial/components/database/provider';
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
export declare class BaseSchedulerWindow extends Model<any> {
    id: number;
    scheduler_id: number;
    /** The days it opens, as `Date.getDay()`: 0 Sunday … 6 Saturday. */
    weekdays: number[];
    start_minute: number;
    end_minute: number;
    /** How long an appointment lasts in it. */
    duration_minutes: number;
    /** Between two offered starts: one-hour visits every quarter hour fill a day much finer. */
    slot_step_minutes: number;
    /** Free time kept on each side of an appointment. */
    gap_minutes: number;
    /** Appointments it takes on one day: it closes the window, not the day. */
    max_per_day: number;
    created_at: Date;
    updated_at: Date;
    /**
     * Lets the back-office type "09:00" where the column holds 540, and
     * refuses a window ending before it starts. A multiselect sometimes sends
     * one ticked day as a string: Postgres wants `{2}`, not "2".
     */
    static normalizeMinutes(instance: BaseSchedulerWindow): void;
    /**
     * Refuses two windows of the same scheduler overlapping on a day: each has
     * its own length and staff, so a start in both would have two lengths.
     * "Tuesday, Thursday" and "Thursday, Friday" clash on Thursday alone.
     */
    static rejectOverlap(instance: BaseSchedulerWindow): Promise<void>;
}
