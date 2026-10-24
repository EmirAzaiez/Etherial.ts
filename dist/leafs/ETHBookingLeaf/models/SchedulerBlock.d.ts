import { Model } from 'etherial/components/database/provider';
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
export declare class BaseSchedulerBlock extends Model<any> {
    id: number;
    scheduler_id: number;
    agent_id: number;
    /** Local `YYYY-MM-DD`: a holiday is a date on a calendar, not an instant. */
    day: string;
    start_minute: number;
    end_minute: number;
    reason: string;
    created_at: Date;
    updated_at: Date;
    /** Lets the back-office type "12:00" where the column holds 720. */
    static normalizeMinutes(instance: BaseSchedulerBlock): void;
}
