import {
    Table,
    Column,
    Model,
    AllowNull,
    PrimaryKey,
    AutoIncrement,
    DataType,
    Default,
    Index,
} from 'etherial/components/database/provider'

/**
 * "This flow has already dealt with this."
 *
 * A flow that watches for appointments starting within 24 hours is asked the
 * same question every ten minutes, and for six hours running the same
 * appointment answers yes. Something has to remember that the reminder went
 * out, and it cannot be a variable in the process: two workers, or one worker
 * restarted, would both send it.
 *
 * So the memory is a row, and the guarantee is the unique index. The engine
 * inserts `(flow_id, key)` before it does anything else; a duplicate key error
 * *is* the answer "already done", and no run is created. `expires_at` decides
 * when the same key becomes fireable again — which is how "once", "once a day"
 * and "once every N hours" are all the same mechanism.
 */
@Table({
    timestamps: false,
    tableName: 'flow_run_keys',
    freezeTableName: true,
    indexes: [
        {
            name: 'flow_run_keys_flow_key',
            unique: true,
            fields: ['flow_id', 'key'],
        },
    ],
})
export class FlowRunKey extends Model<FlowRunKey> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column
    declare id: number

    @AllowNull(false)
    @Column
    declare flow_id: number

    /**
     * 191 characters, not 255: a composite unique index on utf8mb4 MySQL does
     * not fit otherwise, and a key that silently fails to be unique defeats the
     * whole table.
     */
    @AllowNull(false)
    @Column(DataType.STRING(191))
    declare key: string

    /** Null means forever — "notify once, ever". */
    @AllowNull(true)
    @Index
    @Column
    declare expires_at: Date

    @AllowNull(true)
    @Column
    declare run_id: number

    /**
     * Declared as a plain column, not `@CreatedAt`: the table opts out of
     * timestamps, and under that setting the decorator registers nothing at all
     * — the column would never be created and every write to it would be
     * silently dropped.
     */
    @AllowNull(false)
    @Default(DataType.NOW)
    @Column
    declare created_at: Date
}
