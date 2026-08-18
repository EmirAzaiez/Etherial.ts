import type { FieldDefinition } from '../types.js';
export type DedupMode = 'always' | 'once_per_record' | 'once_per_day' | 'every_n_hours' | 'custom';
/**
 * The repeat policy, offered under every trigger in the builder.
 *
 * Worth stating plainly in the UI because the default is the dangerous one:
 * `always` is right for "a ticket was answered" and catastrophic for "an
 * appointment starts within 24 hours".
 */
export declare function dedupFields(): FieldDefinition[];
export interface DedupPlan {
    key: string;
    /** Null means the key is never released — "once, ever". */
    expiresAt: Date | null;
}
/**
 * Builds the key for one candidate run, or null when the flow accepts repeats.
 *
 * The time window is folded *into* the key rather than compared against a
 * timestamp: with a `2026-08-19` suffix, "once a day" is the same insert as
 * "once ever", and there is no second code path to get wrong.
 */
export declare function planDedup(triggerConfig: Record<string, any>, args: {
    triggerId: string;
    recordId?: string | number | null;
    render: (template: string) => string;
    timezone?: string;
    now?: Date;
}): DedupPlan | null;
/**
 * Takes the key, or reports that someone else already has it.
 *
 * An expired key is reclaimed in place rather than deleted and re-inserted:
 * the update is conditional on the row still being expired, so a racing worker
 * updates zero rows and backs off.
 */
export declare function claim(flowId: number, plan: DedupPlan): Promise<boolean>;
/** Attaches the run to its key, so an operator can see what the key stopped. */
export declare function attachRun(flowId: number, key: string, runId: number): Promise<void>;
/** Releases a key whose run never started, so a retry is not blocked by it. */
export declare function release(flowId: number, key: string): Promise<void>;
export declare function sweepExpired(): Promise<number>;
export declare function forgetFlow(flowId: number): Promise<void>;
