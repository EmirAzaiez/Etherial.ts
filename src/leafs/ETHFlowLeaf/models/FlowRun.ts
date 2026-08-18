import {
    Table,
    Column,
    Model,
    AllowNull,
    Default,
    PrimaryKey,
    AutoIncrement,
    CreatedAt,
    UpdatedAt,
    DataType,
    Index,
} from 'etherial/components/database/provider'

import type { MachineState, StepLog } from '../types.js'

export enum FlowRunStatus {
    RUNNING = 'running',
    /** Suspended on a `flow.wait`, with `resume_at` set and the state stored. */
    WAITING = 'waiting',
    SUCCESS = 'success',
    FAILED = 'failed',
}

/**
 * One execution of a flow, kept whether it worked or not.
 *
 * The run row is the only thing standing between a customer and "the
 * automation did nothing and I don't know why", so `step_logs` records every
 * step — including the skipped and the failed ones, with the message each of
 * them wrote.
 */
@Table({
    timestamps: true,
    tableName: 'flow_runs',
    freezeTableName: true,
})
export class FlowRun extends Model<FlowRun> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column
    declare id: number

    @AllowNull(false)
    @Index
    @Column
    declare flow_id: number

    @AllowNull(false)
    @Default(FlowRunStatus.RUNNING)
    @Index
    @Column(DataType.STRING)
    declare status: FlowRunStatus

    @AllowNull(true)
    @Column
    declare trigger_id: string

    /** Collection of the triggering record, when the trigger carried one. */
    @AllowNull(true)
    @Column
    declare collection: string

    /** Kept as text: a primary key is not an integer everywhere. */
    @AllowNull(true)
    @Column
    declare record_id: string

    @AllowNull(true)
    @Column(DataType.JSON)
    declare trigger_payload: Record<string, any>

    /** Snapshot of the triggering record, as the templates saw it. */
    @AllowNull(true)
    @Column(DataType.JSON)
    declare record: Record<string, any>

    @AllowNull(true)
    @Column(DataType.JSON)
    declare step_logs: StepLog[]

    /**
     * The machine, frozen. Written only while WAITING — a finished run keeps its
     * logs, not its internals.
     */
    @AllowNull(true)
    @Column(DataType.JSON)
    declare state: MachineState

    @AllowNull(true)
    @Index
    @Column
    declare resume_at: Date

    @AllowNull(true)
    @Column(DataType.TEXT)
    declare error: string

    @AllowNull(true)
    @Column
    declare actor_type: string

    @AllowNull(true)
    @Column
    declare actor_id: number

    @AllowNull(true)
    @Column
    declare started_at: Date

    @AllowNull(true)
    @Column
    declare ended_at: Date

    @AllowNull(true)
    @Column
    declare duration_ms: number

    @CreatedAt
    declare created_at: Date

    @UpdatedAt
    declare updated_at: Date
}
