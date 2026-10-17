import { Model } from 'etherial/components/database/provider';
/**
 * One visit: from the moment someone opens the app until they leave it for
 * longer than the session timeout (30 minutes by default). Kept up to date as
 * the visit goes on, so the counts and the last screen are read without
 * walking the events.
 */
export declare class AnalyticsSession extends Model<AnalyticsSession> {
    id: string;
    user_id: number | null;
    installation_id: string | null;
    /** ios, android, web. */
    platform: string | null;
    app_version: string | null;
    os_version: string | null;
    device_model: string | null;
    locale: string | null;
    /** app when the app reported it, api when only its calls to the API were seen. */
    source: string;
    started_at: Date;
    last_seen_at: Date;
    screen_count: number;
    event_count: number;
    /** The first screen of the visit, and the last one: where they landed, where they left. */
    entry_screen: string | null;
    exit_screen: string | null;
}
