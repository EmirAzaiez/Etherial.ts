/**
 * One pass. Exported so it can be triggered by hand — from a test, or from a
 * project that would rather drive the schedule with its own cron.
 */
export declare function tick(now?: Date): Promise<void>;
export declare function startTicker(): void;
export declare function stopTicker(): void;
