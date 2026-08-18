import type { TriggerDefinition } from '../types.js';
export declare const scheduleTrigger: TriggerDefinition;
export declare const queryTrigger: TriggerDefinition;
export declare function registerScheduleTriggers(): void;
/**
 * One pass over the scheduled flows. Called every minute by the ticker.
 *
 * Flows are handled one after another rather than all at once: a customer's
 * scheduled query can return a hundred records, and a hundred parallel runs
 * hammering the same database is a worse failure than a slow tick.
 */
export declare function runScheduleTick(now?: Date): Promise<{
    flows: number;
    runs: number;
}>;
