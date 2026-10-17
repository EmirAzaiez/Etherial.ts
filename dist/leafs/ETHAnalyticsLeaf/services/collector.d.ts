import { AnalyticsContext, EventType } from './options.js';
export interface TrackedEvent {
    type: EventType;
    name: string;
    screen?: string | null;
    properties?: Record<string, unknown> | null;
    duration_ms?: number | null;
    status?: number | null;
    at?: Date;
}
export declare class Collector {
    private timeout;
    private visits;
    private pending;
    private events;
    private dirty;
    private flushing;
    private timer?;
    private sweeper?;
    constructor(timeout: number);
    start(): void;
    stop(): void;
    /**
     * Records events for one person. Never throws: a broken event is dropped.
     * `source` says who reported them — the app itself, or the API watching
     * the app's calls.
     */
    track(events: TrackedEvent[], context: AnalyticsContext, source: 'app' | 'api'): Promise<number>;
    /** Writes what is waiting. Safe to call at any time; calls overlap into one. */
    flush(): Promise<void>;
    /** People in the app right now, from memory: the table lags by a few seconds. */
    liveVisits(withinMs: number): {
        id: string;
        user_id: number | null;
        exit_screen: string | null;
        last_seen_at: Date;
    }[];
    private keysOf;
    /** Is `at` inside this visit, or close enough to extend it? */
    private covers;
    /** The install is someone else's now, or the user is on another phone: a different visit. */
    private belongs;
    private visitFor;
    /** The visit this person was on before the server restarted, if it is still going. */
    private storedVisit;
    private open;
    /** Learns what this event says about the visit: who signed in, on which phone. */
    private adopt;
    private apply;
    /** Forgets visits that ended, once they are written. */
    private sweep;
}
