import { Column, Model, AllowNull, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType } from 'etherial/components/database/provider'

/**
 * Base SchedulerWindowHost (no @Table): one agent holding one window. The
 * windows are the only source of agents: a window without anyone offers no slot.
 *
 * The project adds both foreign keys, `window` and `agent`, and a unique index
 * on the pair.
 */
export class BaseSchedulerWindowHost extends Model<any> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column(DataType.INTEGER)
    id: number

    @AllowNull(false)
    @Column(DataType.INTEGER)
    scheduler_window_id: number

    @AllowNull(false)
    @Column(DataType.INTEGER)
    agent_id: number

    @CreatedAt
    created_at: Date

    @UpdatedAt
    updated_at: Date
}
