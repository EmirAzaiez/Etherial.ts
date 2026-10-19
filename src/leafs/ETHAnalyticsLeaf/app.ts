import etherial, { Etherial } from 'etherial'
import * as path from 'path'
import { Op } from 'sequelize'
import { fileURLToPath } from 'url'

import { runExclusive } from '../../components/database/lock.js'
import { AnalyticsEvent } from './models/AnalyticsEvent.js'
import { AnalyticsSession } from './models/AnalyticsSession.js'
import { Collector, TrackedEvent } from './services/collector.js'
import { IdentifyCache, apiTrackingMiddleware } from './services/tracking.js'
import { state } from './services/state.js'
import {
    AnalyticsContext,
    ETHAnalyticsLeafConfig,
    EVENTS_COLLECTION,
    INGEST_PATH,
    SESSIONS_COLLECTION,
    ingestOptions,
    timeoutMs,
    trackOptions,
    usersOptions,
} from './services/options.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
    readonly etherial_module_name = 'eth_analytics_leaf'

    public config: ETHAnalyticsLeafConfig
    private collector: Collector
    private routes: { route: string; methods: string[] }[] = []

    constructor(config: ETHAnalyticsLeafConfig = {}) {
        this.config = config
        this.collector = new Collector(timeoutMs(config))
        state.config = config
        state.collector = this.collector
        state.identity = new IdentifyCache(config.identify)

        this.routes.push({
            route: path.join(__dirname, 'routes/admin'),
            methods: ['overview', 'live', 'events', 'flows', 'funnel', 'retention', 'user', 'session'],
        })
        if (ingestOptions(config)) {
            this.routes.push({ route: path.join(__dirname, 'routes/ingest'), methods: ['ingest'] })
        }
    }

    /** Lifecycle: beforeRun — hand the two tables to the database before it syncs. */
    beforeRun({ database }: Etherial) {
        database?.addModels([AnalyticsEvent, AnalyticsSession] as any)
    }

    /** Lifecycle: run — routes, and the API watcher mounted before any controller. */
    run({ http }: Etherial) {
        http?.routes_leafs?.push(...this.routes)

        const track = trackOptions(this.config)
        if (track && http?.app) {
            const adminPrefix = (etherial as any).eth_admin_leaf?.config?.prefix ?? '/admin'
            http.app.use(apiTrackingMiddleware(track, this.config, this.collector, state.identity!, [adminPrefix, INGEST_PATH]))
        }
        this.collector.start()
        this.scheduleRetention()

        const ways = [track && 'API calls', ingestOptions(this.config) && `app events (${INGEST_PATH})`].filter(Boolean)
        console.log(`[ETHAnalyticsLeaf] Collecting ${ways.join(' and ') || 'nothing yet: turn on `track` or `ingest`'}`)
    }

    /** Lifecycle: afterRun — every collection exists: list the raw tables and tell the back-office. */
    afterRun() {
        const adminLeaf = (etherial as any).eth_admin_leaf
        if (!adminLeaf?.registerCollection) return

        const users = usersOptions(this.config)
        const hasUsers = !!adminLeaf.getCollection?.(users.collection)
        if (!adminLeaf.getCollection(EVENTS_COLLECTION)) adminLeaf.registerCollection(eventsCollection(users.collection, hasUsers))
        if (!adminLeaf.getCollection(SESSIONS_COLLECTION)) adminLeaf.registerCollection(sessionsCollection(users.collection, hasUsers))

        adminLeaf.setFeature?.('analytics', {
            collection: EVENTS_COLLECTION,
            sessions: SESSIONS_COLLECTION,
            usersCollection: hasUsers ? users.collection : null,
            timezone: this.config.timezone || 'UTC',
            sessionTimeoutMinutes: this.config.sessionTimeoutMinutes ?? 30,
            sources: { api: !!trackOptions(this.config), app: !!ingestOptions(this.config) },
            labels: this.config.labels ?? {},
            funnels: this.config.funnels ?? [],
        })
    }

    /**
     * Records events from the project's own code: a payment confirmed by a
     * webhook, a booking made by a cron. They join the user's current visit.
     */
    track(event: Omit<TrackedEvent, 'type'> & { type?: TrackedEvent['type'] }, context: AnalyticsContext): Promise<number> {
        return this.collector.track([{ type: 'action', ...event }], context, 'api')
    }

    /** Writes what is waiting now, before a deliberate shutdown say. */
    flush(): Promise<void> {
        return this.collector.flush()
    }

    private scheduleRetention() {
        const days = this.config.retentionDays ?? 395
        if (!days || days <= 0) return
        const DAY = 24 * 3600 * 1000
        const purge = async () => {
            try {
                // Once a day across all servers: a big DELETE run by each of
                // them at once only fights over the same rows.
                await runExclusive('eth_analytics.retention', { ttlMs: DAY - 10 * 60 * 1000, release: false }, async () => {
                    const cutoff = new Date(Date.now() - days * DAY)
                    await AnalyticsEvent.destroy({ where: { created_at: { [Op.lt]: cutoff } } as any })
                    await AnalyticsSession.destroy({ where: { last_seen_at: { [Op.lt]: cutoff } } as any })
                })
            } catch (err: any) {
                console.error('[ETHAnalyticsLeaf] Retention:', err?.message || err)
            }
        }
        // Not at boot: the tables may not be synced yet.
        setTimeout(purge, 60 * 1000).unref?.()
        setInterval(purge, DAY).unref?.()
    }

    commands() {
        return [
            {
                command: 'purge',
                description: 'Delete every analytics event and visit (asks nothing: for test databases)',
                action: async () => {
                    const events = await AnalyticsEvent.destroy({ where: {}, truncate: true } as any)
                    const sessions = await AnalyticsSession.destroy({ where: {}, truncate: true } as any)
                    return { success: true, message: `Purged analytics (${events ?? 0} events, ${sessions ?? 0} visits)` }
                },
            },
        ]
    }
}

const TYPES = [
    { value: 'screen', label: 'Screen', color: 'blue' },
    { value: 'action', label: 'Action', color: 'green' },
    { value: 'api', label: 'API call', color: 'gray' },
    { value: 'app', label: 'App', color: 'purple' },
]

const PLATFORMS = [
    { value: 'ios', label: 'iOS' },
    { value: 'android', label: 'Android' },
    { value: 'web', label: 'Web' },
]

function userField(usersCollection: string, hasUsers: boolean, label: string) {
    return hasUsers
        ? { name: 'user_id', type: 'relation' as const, label, filterable: true, relation: { collection: usersCollection, displayField: 'email' } }
        : { name: 'user_id', type: 'integer' as const, label, filterable: true }
}

function eventsCollection(usersCollection: string, hasUsers: boolean) {
    return {
        name: EVENTS_COLLECTION,
        model: AnalyticsEvent,
        crud: ['list', 'show'] as ('list' | 'show')[],
        exportable: true,
        meta: {
            label: 'Analytics event',
            labelPlural: 'Analytics events',
            icon: 'Activity',
            description: 'Every screen, action and API call recorded for Analytics',
            group: 'System',
            order: 97,
            // Read through the Analytics page; listed for exports and for the role permissions.
            hidden: true,
        },
        fields: [
            { name: 'id', type: 'integer' as const, readonly: true, sortable: true },
            { name: 'created_at', type: 'datetime' as const, label: 'Date', readonly: true, sortable: true, filterable: true },
            { name: 'type', type: 'select' as const, label: 'Type', filterable: true, options: TYPES },
            { name: 'name', type: 'string' as const, label: 'Name', searchable: true, filterable: true },
            { name: 'screen', type: 'string' as const, label: 'On screen', filterable: true },
            userField(usersCollection, hasUsers, 'User'),
            { name: 'session_id', type: 'string' as const, label: 'Visit', filterable: true },
            { name: 'installation_id', type: 'string' as const, label: 'App install', filterable: true },
            { name: 'platform', type: 'select' as const, label: 'Platform', filterable: true, options: PLATFORMS },
            { name: 'app_version', type: 'string' as const, label: 'App version', filterable: true },
            { name: 'duration_ms', type: 'integer' as const, label: 'Duration (ms)', sortable: true },
            { name: 'status', type: 'integer' as const, label: 'HTTP status', filterable: true },
            { name: 'properties', type: 'json' as const, label: 'Details', readonly: true },
        ],
        views: {
            list: {
                fields: ['created_at', 'type', 'name', 'user_id', 'platform', 'app_version', 'duration_ms'],
                sort: { field: 'created_at', direction: 'desc' as const },
                search: ['name'],
                filters: ['type', 'user_id', 'platform', 'app_version', 'created_at'],
            },
            show: {
                layout: 'sections' as const,
                sections: [
                    { title: 'Event', fields: ['type', 'name', 'screen', 'created_at', 'duration_ms', 'status', 'properties'] },
                    { title: 'Who', fields: ['user_id', 'session_id', 'installation_id', 'platform', 'app_version'] },
                ],
            },
        },
    }
}

function sessionsCollection(usersCollection: string, hasUsers: boolean) {
    return {
        name: SESSIONS_COLLECTION,
        model: AnalyticsSession,
        crud: ['list', 'show'] as ('list' | 'show')[],
        exportable: true,
        meta: {
            label: 'Visit',
            labelPlural: 'Analytics visits',
            icon: 'Route',
            description: 'Each visit to the app, from opening it to leaving',
            group: 'System',
            order: 98,
            hidden: true,
        },
        fields: [
            { name: 'id', type: 'string' as const, readonly: true },
            userField(usersCollection, hasUsers, 'User'),
            { name: 'started_at', type: 'datetime' as const, label: 'Started', sortable: true, filterable: true },
            { name: 'last_seen_at', type: 'datetime' as const, label: 'Last seen', sortable: true },
            { name: 'source', type: 'select' as const, label: 'Seen by', filterable: true, options: [
                { value: 'app', label: 'The app', color: 'green' },
                { value: 'api', label: 'API calls only', color: 'gray' },
            ] },
            { name: 'platform', type: 'select' as const, label: 'Platform', filterable: true, options: PLATFORMS },
            { name: 'app_version', type: 'string' as const, label: 'App version', filterable: true },
            { name: 'os_version', type: 'string' as const, label: 'OS version' },
            { name: 'device_model', type: 'string' as const, label: 'Device' },
            { name: 'locale', type: 'string' as const, label: 'Language', filterable: true },
            { name: 'screen_count', type: 'integer' as const, label: 'Screens', sortable: true },
            { name: 'event_count', type: 'integer' as const, label: 'Events', sortable: true },
            { name: 'entry_screen', type: 'string' as const, label: 'First screen', filterable: true },
            { name: 'exit_screen', type: 'string' as const, label: 'Last screen', filterable: true },
            { name: 'installation_id', type: 'string' as const, label: 'App install', filterable: true },
        ],
        views: {
            list: {
                fields: ['started_at', 'user_id', 'platform', 'app_version', 'screen_count', 'event_count', 'entry_screen', 'exit_screen'],
                sort: { field: 'started_at', direction: 'desc' as const },
                filters: ['user_id', 'platform', 'app_version', 'source', 'started_at'],
            },
        },
    }
}

export * from './services/options.js'
export { AnalyticsEvent } from './models/AnalyticsEvent.js'
export { AnalyticsSession } from './models/AnalyticsSession.js'
export type { TrackedEvent } from './services/collector.js'
