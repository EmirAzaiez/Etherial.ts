import { Etherial } from 'etherial';
import { TrackedEvent } from './services/collector.js';
import { AnalyticsContext, ETHAnalyticsLeafConfig } from './services/options.js';
/**
 * ETHAnalyticsLeaf — what people do in the app, and where they go.
 *
 * Two ways in, both opt-in:
 * - `track`: every call a signed-in user's app makes to the API is an event.
 *   No app update needed; it shows who is active, when, and what they do.
 * - `ingest`: the app posts the screens it shows and the buttons pressed to
 *   `POST /analytics/events`. That adds paths, time on screen and guests.
 *
 * Events are grouped into visits (30 minutes of silence ends one) and read
 * back by the back-office's Analytics page and each user's Activity panel:
 * active users, screens, actions, paths, funnels, retention. Postgres only.
 */
export default class ETHAnalyticsLeaf {
    readonly etherial_module_name = "eth_analytics_leaf";
    config: ETHAnalyticsLeafConfig;
    private collector;
    private routes;
    constructor(config?: ETHAnalyticsLeafConfig);
    /** Lifecycle: beforeRun — hand the two tables to the database before it syncs. */
    beforeRun({ database }: Etherial): void;
    /** Lifecycle: run — routes, and the API watcher mounted before any controller. */
    run({ http }: Etherial): void;
    /** Lifecycle: afterRun — every collection exists: list the raw tables and tell the back-office. */
    afterRun(): void;
    /**
     * Records events from the project's own code: a payment confirmed by a
     * webhook, a booking made by a cron. They join the user's current visit.
     */
    track(event: Omit<TrackedEvent, 'type'> & {
        type?: TrackedEvent['type'];
    }, context: AnalyticsContext): Promise<number>;
    /** Writes what is waiting now, before a deliberate shutdown say. */
    flush(): Promise<void>;
    private scheduleRetention;
    commands(): {
        command: string;
        description: string;
        action: () => Promise<{
            success: boolean;
            message: string;
        }>;
    }[];
}
export * from './services/options.js';
export { AnalyticsEvent } from './models/AnalyticsEvent.js';
export { AnalyticsSession } from './models/AnalyticsSession.js';
export type { TrackedEvent } from './services/collector.js';
