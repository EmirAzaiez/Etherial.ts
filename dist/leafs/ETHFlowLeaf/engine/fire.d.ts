import { Flow } from '../models/Flow.js';
import { FlowRun } from '../models/FlowRun.js';
import type { FireInput } from '../types.js';
/** Flows listening to a trigger, in a stable order. */
export declare function flowsFor(triggerId: string): Promise<Flow[]>;
export interface FireOutcome {
    flow: Flow;
    /** Null when the flow was skipped — filtered out, or already done. */
    run: FlowRun | null;
    skipped?: 'filtered' | 'deduplicated' | 'invalid';
}
/**
 * Runs one flow for one event, dedup included.
 *
 * The key is claimed *before* the run row exists. If the process dies between
 * the claim and the run, the key is released on the way out; if it dies harder
 * than that, the key expires. Both outcomes are recoverable, whereas sending
 * the notification twice is not.
 */
export declare function runFlow(flow: Flow, input: FireInput): Promise<FireOutcome>;
/**
 * The entry point everything else calls: model hooks, the ticker, webhooks,
 * and application code raising its own domain events.
 */
export declare function fire(input: FireInput): Promise<FireOutcome[]>;
/**
 * Fire without making the caller wait or care.
 *
 * Model hooks use this: saving a record must not get slower, and must not fail,
 * because an automation attached to it does.
 */
export declare function fireAndForget(input: FireInput): void;
/** Picks up runs frozen on a `flow.wait` whose time has come. */
export declare function resumeDueRuns(limit?: number): Promise<number>;
