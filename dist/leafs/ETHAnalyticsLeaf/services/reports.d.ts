export interface Range {
    from: string;
    to: string;
    days: number;
    tz: string;
}
export declare class ReportError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string);
}
export declare function ensurePostgres(): void;
export declare function timezone(): string;
/** `?from=&to=` as calendar days; the last 30 days when not given. A year at most. */
export declare function rangeOf(query: any): Range;
/** The same number of days, just before. */
export declare function previousOf(range: Range): Range;
export interface PersonLabel {
    id: number;
    label: string;
}
/** Names the users behind ids, the way the project names them. */
export declare function labelUsers(ids: (number | null | undefined)[]): Promise<Record<number, string>>;
export declare function overview(range: Range): Promise<{
    range: Range;
    appTracking: boolean;
    current: any;
    previous: any;
    active: {
        dau: any;
        wau: any;
        mau: any;
        stickiness: number;
    };
    timeseries: {
        day: string;
        users: any;
        guests: any;
        sessions: any;
        screens: any;
        actions: any;
    }[];
    platforms: any[];
    versions: any[];
    locales: any[];
    heatmap: any[];
    topScreens: any[];
    topActions: any[];
}>;
export declare function live(minutes?: number): Promise<{
    minutes: number;
    count: number;
    sessions: any[];
}>;
export declare function events(type: string, range: Range): Promise<{
    range: Range;
    type: string;
    items: any[];
}>;
export declare function flows(type: 'screen' | 'api' | 'action', range: Range, name?: string): Promise<{
    range: Range;
    type: "action" | "api" | "screen";
    name: string;
    total: any;
    from: {
        name: any;
        count: any;
    }[];
    to: {
        name: any;
        count: any;
    }[];
    transitions?: undefined;
    paths?: undefined;
} | {
    range: Range;
    type: "action" | "api" | "screen";
    transitions: {
        from: any;
        to: any;
        count: any;
    }[];
    paths: {
        steps: string[];
        count: any;
    }[];
    name?: undefined;
    total?: undefined;
    from?: undefined;
    to?: undefined;
}>;
export declare function parseSteps(value: unknown): string[];
/**
 * How many went through each step in order: in the same visit, or at any
 * time in the range for `scope = person`. Each step also says how long it
 * took, on average, from the one before.
 */
export declare function funnel(stepList: string[], range: Range, scope: 'session' | 'person'): Promise<{
    range: Range;
    scope: "session" | "person";
    steps: {
        step: string;
        count: any;
        avg_seconds: any;
    }[];
}>;
/**
 * Weekly cohorts: the people first seen in a week, and the share of them back
 * in each week after. Signed-in users by default; `who = all` adds guests by
 * their install.
 */
export declare function retention(weeks: number, who: 'users' | 'all'): Promise<{
    weeks: number;
    who: "all" | "users";
    cohorts: {
        week: string;
        size: number;
        weeks: number[];
    }[];
}>;
export declare function userActivity(userId: number, before?: Date): Promise<{
    sessions: any[];
    nextBefore: string;
    summary: any;
    days: any[];
    topScreens: any[];
    topActions: any[];
}>;
export declare function session(id: string): Promise<{
    session: any;
    events: any[];
    truncated: boolean;
}>;
