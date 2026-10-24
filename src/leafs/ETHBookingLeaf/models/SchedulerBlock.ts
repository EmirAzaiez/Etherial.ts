import { Column, Model, AllowNull, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, BeforeValidate } from 'etherial/components/database/provider'

import { parseMinuteInput } from '../services/slots.js'

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
export class BaseSchedulerBlock extends Model<any> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column(DataType.INTEGER)
    id: number

    @AllowNull(true)
    @Column(DataType.INTEGER)
    scheduler_id: number

    @AllowNull(true)
    @Column(DataType.INTEGER)
    agent_id: number

    /** Local `YYYY-MM-DD`: a holiday is a date on a calendar, not an instant. */
    @AllowNull(false)
    @Column(DataType.DATEONLY)
    day: string

    @AllowNull(true)
    @Column(DataType.INTEGER)
    start_minute: number

    @AllowNull(true)
    @Column(DataType.INTEGER)
    end_minute: number

    @AllowNull(true)
    @Column(DataType.STRING)
    reason: string

    @CreatedAt
    created_at: Date

    @UpdatedAt
    updated_at: Date

    /** Lets the back-office type "12:00" where the column holds 720. */
    @BeforeValidate
    static normalizeMinutes(instance: BaseSchedulerBlock) {
        instance.start_minute = parseMinuteInput(instance.start_minute) as number
        instance.end_minute = parseMinuteInput(instance.end_minute) as number
    }
}
