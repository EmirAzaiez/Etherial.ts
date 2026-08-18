export interface ZonedMinute {
    minute: number;
    hour: number;
    day: number;
    month: number;
    /** 0 = Sunday, matching cron. */
    weekday: number;
}
export declare function zonedMinute(date: Date, timezone?: string): ZonedMinute;
export declare function matchesCron(expression: string, at: ZonedMinute): boolean;
export declare function isValidCron(expression: string): boolean;
/**
 * Builds the cron expression the dropdown modes stand for.
 *
 * Going through cron rather than keeping a second scheduler means there is one
 * thing to get right, and the advanced mode is the same code path as the easy
 * one — not a rarely-exercised branch beside it.
 */
export declare function cronFromConfig(config: Record<string, any>): string | null;
