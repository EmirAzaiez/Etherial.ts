import { Model } from 'etherial/components/database/provider';
import type { MachineState, StepLog } from '../types.js';
export declare enum FlowRunStatus {
    RUNNING = "running",
    /** Suspended on a `flow.wait`, with `resume_at` set and the state stored. */
    WAITING = "waiting",
    SUCCESS = "success",
    FAILED = "failed"
}
/**
 * One execution of a flow, kept whether it worked or not.
 *
 * The run row is the only thing standing between a customer and "the
 * automation did nothing and I don't know why", so `step_logs` records every
 * step — including the skipped and the failed ones, with the message each of
 * them wrote.
 */
export declare class FlowRun extends Model<FlowRun> {
    id: number;
    flow_id: number;
    status: FlowRunStatus;
    trigger_id: string;
    /** Collection of the triggering record, when the trigger carried one. */
    collection: string;
    /** Kept as text: a primary key is not an integer everywhere. */
    record_id: string;
    trigger_payload: Record<string, any>;
    /** Snapshot of the triggering record, as the templates saw it. */
    record: Record<string, any>;
    step_logs: StepLog[];
    /**
     * The machine, frozen. Written only while WAITING — a finished run keeps its
     * logs, not its internals.
     */
    state: MachineState;
    resume_at: Date;
    error: string;
    actor_type: string;
    actor_id: number;
    started_at: Date;
    ended_at: Date;
    duration_ms: number;
    created_at: Date;
    updated_at: Date;
}
