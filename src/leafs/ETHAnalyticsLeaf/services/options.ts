// ──────────────────────────────────────────────────────────────────────────
// What a project can tell the analytics leaf, and the defaults it falls back
// to. Everything is opt-in: with no `track` and no `ingest`, the leaf only
// owns its two tables and answers the back-office.
// ──────────────────────────────────────────────────────────────────────────

export type EventType = 'screen' | 'action' | 'api' | 'app'

export const EVENT_TYPES: EventType[] = ['screen', 'action', 'api', 'app']

/** What is known about the person and the app behind an event. */
export interface AnalyticsContext {
    user_id?: number | null
    installation_id?: string | null
    platform?: string | null
    app_version?: string | null
    os_version?: string | null
    device_model?: string | null
    locale?: string | null
}

export interface TrackApiConfig {
    /** Only these routes (`/users/me/tickets`, `/users/me/*`, a RegExp). Default: every route. */
    include?: (string | RegExp)[]
    /** Never these routes. The admin prefix and the leaf's own route are always left out. */
    exclude?: (string | RegExp)[]
    /** Only these HTTP methods. Default: all but OPTIONS and HEAD. */
    methods?: string[]
    /** Also count calls made without a signed-in user (needs an installation id header). Default false. */
    guests?: boolean
}

export interface AnalyticsFunnel {
    name: string
    /** `type:name` each, in order: `screen:Appointments`, `api:POST /users/me/tickets`. */
    steps: string[]
}

export interface AnalyticsUsersConfig {
    /** Back-office collection the user ids link to. Default `users`. */
    collection?: string
    /** Sequelize model holding the users, to name them. Default `User`. */
    model?: string
    /** Joined with spaces to name someone. Default `['first_name', 'last_name']`. */
    name?: string[]
    /** Used when the name comes out empty. Default `['email', 'phone_number', 'phone']`. */
    fallback?: string[]
}

export interface ETHAnalyticsLeafConfig {
    /** `POST /analytics/events`: the apps send what users see and do. Default off. */
    ingest?: boolean | { maxBatch?: number }
    /**
     * Count every call a signed-in user's app makes to the API, as `api` events.
     * Works with no app update: a project gets visits, active users and what
     * people do as soon as it deploys. Default off.
     */
    track?: boolean | TrackApiConfig
    /** Minutes of silence that end a visit. Default 30. */
    sessionTimeoutMinutes?: number
    /** Days of events kept. Default 395 (13 months); 0 keeps everything. */
    retentionDays?: number
    /** Calendar days are cut in this time zone. Default `UTC`. */
    timezone?: string
    /** Fills in what an API call does not say: the user's last device, platform, version. */
    identify?: (user: any, req: any) => Promise<AnalyticsContext | null> | AnalyticsContext | null
    /** Leaves people out of the numbers: staff testing the app, say. */
    excludeUser?: (user: any) => boolean
    users?: AnalyticsUsersConfig
    /** Words for the raw names, shown in the back-office. */
    labels?: {
        screens?: Record<string, string>
        actions?: Record<string, string>
        api?: Record<string, string>
    }
    /** Funnels offered ready-made in the back-office. */
    funnels?: AnalyticsFunnel[]
}

export const EVENTS_COLLECTION = 'analytics-events'
export const SESSIONS_COLLECTION = 'analytics-sessions'
export const INGEST_PATH = '/analytics/events'

export function ingestOptions(config: ETHAnalyticsLeafConfig): { maxBatch: number } | null {
    if (!config.ingest) return null
    const custom = config.ingest === true ? {} : config.ingest
    return { maxBatch: Math.min(Math.max(custom.maxBatch ?? 100, 1), 500) }
}

export function trackOptions(config: ETHAnalyticsLeafConfig): TrackApiConfig | null {
    if (!config.track) return null
    return config.track === true ? {} : config.track
}

export function usersOptions(config: ETHAnalyticsLeafConfig): Required<AnalyticsUsersConfig> {
    return {
        collection: config.users?.collection ?? 'users',
        model: config.users?.model ?? 'User',
        name: config.users?.name ?? ['first_name', 'last_name'],
        fallback: config.users?.fallback ?? ['email', 'phone_number', 'phone'],
    }
}

export function timeoutMs(config: ETHAnalyticsLeafConfig): number {
    const minutes = config.sessionTimeoutMinutes ?? 30
    return Math.max(1, minutes) * 60 * 1000
}

/** ios, android, web — whatever the app or a device table calls it. */
export function normalizePlatform(value: unknown): string | null {
    if (value === undefined || value === null || value === '') return null
    const v = String(value).toLowerCase().trim()
    if (v === '3' || v.startsWith('ios') || v === 'iphone' || v === 'ipad') return 'ios'
    if (v === '2' || v.startsWith('android')) return 'android'
    if (v === '1' || v === 'web') return 'web'
    return v.slice(0, 16)
}

export function clip(value: unknown, max: number): string | null {
    if (value === undefined || value === null) return null
    const s = String(value).trim()
    return s ? s.slice(0, max) : null
}
