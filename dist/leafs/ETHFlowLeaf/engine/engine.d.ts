import { Flow } from '../models/Flow.js';
import { FlowRun, FlowRunStatus } from '../models/FlowRun.js';
import type { FlowGraph, MachineState, RunContext } from '../types.js';
export declare function emptyState(): MachineState;
/**
 * Prepares the machine for a fresh run: the entry node's successors, queued.
 *
 * The trigger node itself is never executed — it already happened; it is on the
 * canvas so the customer can see and configure what started things.
 */
export declare function initialState(graph: FlowGraph): MachineState;
export interface MachineOutcome {
    status: FlowRunStatus.SUCCESS | FlowRunStatus.FAILED | FlowRunStatus.WAITING;
    resumeAt?: Date;
    error?: string;
}
/**
 * Runs until the graph is exhausted, a step asks to wait, or a step fails.
 *
 * `context.state` is mutated in place: the caller holds the same object, so
 * whatever happens it can write the current position to the row.
 */
export declare function runMachine(graph: FlowGraph, context: RunContext): Promise<MachineOutcome>;
/**
 * Runs a flow and keeps the row in step with it.
 *
 * The run row is written before the first step and updated after the last, so a
 * process killed mid-flow leaves a RUNNING row behind rather than nothing at
 * all — an operator can see that something started and did not finish.
 */
export declare function executeRun(flow: Flow, run: FlowRun, context: RunContext): Promise<FlowRun>;
