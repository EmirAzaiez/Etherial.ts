export type EventType = 'screen' | 'action' | 'api' | 'app';
export declare const EVENT_TYPES: EventType[];
/** What is known about the person and the app behind an event. */
export interface AnalyticsContext {
    user_id?: number | null;
    installation_id?: string | null;
    platform?: string | null;
    app_version?: string | null;
    os_version?: string | null;
    device_model?: string | null;
    locale?: string | null;
}
export interface TrackApiConfig {
    /** Only these routes (`/users/me/tickets`, `/users/me/*`, a RegExp). Default: every route. */
    include?: (string | RegExp)[];
    /** Never these routes. The admin prefix and the leaf's own route are always left out. */
    exclude?: (string | RegExp)[];
    /** Only these HTTP methods. Default: all but OPTIONS and HEAD. */
    methods?: string[];
    /** Also count calls made without a signed-in user (needs an installation id header). Default false. */
    guests?: boolean;
}
export interface AnalyticsFunnel {
    name: string;
    /** `type:name` each, in order: `screen:Appointments`, `api:POST /users/me/tickets`. */
    steps: string[];
}
export interface AnalyticsUsersConfig {
    /** Back-office collection the user ids link to. Default `users`. */
    collection?: string;
    /** Sequelize model holding the users, to name them. Default `User`. */
    model?: string;
    /** Joined with spaces to name someone. Default `['first_name', 'last_name']`. */
    name?: string[];
    /** Used when the name comes out empty. Default `['email', 'phone_number', 'phone']`. */
    fallback?: string[];
}
export interface ETHAnalyticsLeafConfig {
    /** `POST /analytics/events`: the apps send what users see and do. Default off. */
    ingest?: boolean | {
        maxBatch?: number;
    };
    /**
     * Count every call a signed-in user's app makes to the API, as `api` events.
     * Works with no app update: a project gets visits, active users and what
     * people do as soon as it deploys. Default off.
     */
    track?: boolean | TrackApiConfig;
    /** Minutes of silence that end a visit. Default 30. */
    sessionTimeoutMinutes?: number;
    /** Days of events kept. Default 395 (13 months); 0 keeps everything. */
    retentionDays?: number;
    /** Calendar days are cut in this time zone. Default `UTC`. */
    timezone?: string;
    /** Fills in what an API call does not say: the user's last device, platform, version. */
    identify?: (user: any, req: any) => Promise<AnalyticsContext | null> | AnalyticsContext | null;
    /** Leaves people out of the numbers: staff testing the app, say. */
    excludeUser?: (user: any) => boolean;
    users?: AnalyticsUsersConfig;
    /** Words for the raw names, shown in the back-office. */
    labels?: {
        screens?: Record<string, string>;
        actions?: Record<string, string>;
        api?: Record<string, string>;
    };
    /** Funnels offered ready-made in the back-office. */
    funnels?: AnalyticsFunnel[];
}
export declare const EVENTS_COLLECTION = "analytics-events";
export declare const SESSIONS_COLLECTION = "analytics-sessions";
export declare const INGEST_PATH = "/analytics/events";
export declare function ingestOptions(config: ETHAnalyticsLeafConfig): {
    maxBatch: number;
} | null;
export declare function trackOptions(config: ETHAnalyticsLeafConfig): TrackApiConfig | null;
export declare function usersOptions(config: ETHAnalyticsLeafConfig): Required<AnalyticsUsersConfig>;
export declare function timeoutMs(config: ETHAnalyticsLeafConfig): number;
/** ios, android, web — whatever the app or a device table calls it. */
export declare function normalizePlatform(value: unknown): string | null;
export declare function clip(value: unknown, max: number): string | null;
