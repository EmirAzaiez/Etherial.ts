export interface TickOptions {
    /**
     * Do the shared work only if this server takes the tick's lease, held this
     * many ms. The ticker passes it. Without it the pass runs regardless — a
     * test, or a project driving the schedule with its own cron on one machine;
     * one with several should pass it too.
     */
    leaseMs?: number;
}
/**
 * One pass. Exported so it can be triggered by hand — from a test, or from a
 * project that would rather drive the schedule with its own cron.
 */
export declare function tick(now?: Date, options?: TickOptions): Promise<void>;
export declare function startTicker(): void;
export declare function stopTicker(): void;
