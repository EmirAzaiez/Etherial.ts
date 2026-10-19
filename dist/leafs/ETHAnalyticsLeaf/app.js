var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import etherial from 'etherial';
import * as path from 'path';
import { Op } from 'sequelize';
import { fileURLToPath } from 'url';
import { runExclusive } from '../../components/database/lock.js';
import { AnalyticsEvent } from './models/AnalyticsEvent.js';
import { AnalyticsSession } from './models/AnalyticsSession.js';
import { Collector } from './services/collector.js';
import { IdentifyCache, apiTrackingMiddleware } from './services/tracking.js';
import { state } from './services/state.js';
import { EVENTS_COLLECTION, INGEST_PATH, SESSIONS_COLLECTION, ingestOptions, timeoutMs, trackOptions, usersOptions, } from './services/options.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
    constructor(config = {}) {
        this.etherial_module_name = 'eth_analytics_leaf';
        this.routes = [];
        this.config = config;
        this.collector = new Collector(timeoutMs(config));
        state.config = config;
        state.collector = this.collector;
        state.identity = new IdentifyCache(config.identify);
        this.routes.push({
            route: path.join(__dirname, 'routes/admin'),
            methods: ['overview', 'live', 'events', 'flows', 'funnel', 'retention', 'user', 'session'],
        });
        if (ingestOptions(config)) {
            this.routes.push({ route: path.join(__dirname, 'routes/ingest'), methods: ['ingest'] });
        }
    }
    /** Lifecycle: beforeRun — hand the two tables to the database before it syncs. */
    beforeRun({ database }) {
        database === null || database === void 0 ? void 0 : database.addModels([AnalyticsEvent, AnalyticsSession]);
    }
    /** Lifecycle: run — routes, and the API watcher mounted before any controller. */
    run({ http }) {
        var _a, _b, _c, _d;
        (_a = http === null || http === void 0 ? void 0 : http.routes_leafs) === null || _a === void 0 ? void 0 : _a.push(...this.routes);
        const track = trackOptions(this.config);
        if (track && (http === null || http === void 0 ? void 0 : http.app)) {
            const adminPrefix = (_d = (_c = (_b = etherial.eth_admin_leaf) === null || _b === void 0 ? void 0 : _b.config) === null || _c === void 0 ? void 0 : _c.prefix) !== null && _d !== void 0 ? _d : '/admin';
            http.app.use(apiTrackingMiddleware(track, this.config, this.collector, state.identity, [adminPrefix, INGEST_PATH]));
        }
        this.collector.start();
        this.scheduleRetention();
        const ways = [track && 'API calls', ingestOptions(this.config) && `app events (${INGEST_PATH})`].filter(Boolean);
        console.log(`[ETHAnalyticsLeaf] Collecting ${ways.join(' and ') || 'nothing yet: turn on `track` or `ingest`'}`);
    }
    /** Lifecycle: afterRun — every collection exists: list the raw tables and tell the back-office. */
    afterRun() {
        var _a, _b, _c, _d, _e;
        const adminLeaf = etherial.eth_admin_leaf;
        if (!(adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.registerCollection))
            return;
        const users = usersOptions(this.config);
        const hasUsers = !!((_a = adminLeaf.getCollection) === null || _a === void 0 ? void 0 : _a.call(adminLeaf, users.collection));
        if (!adminLeaf.getCollection(EVENTS_COLLECTION))
            adminLeaf.registerCollection(eventsCollection(users.collection, hasUsers));
        if (!adminLeaf.getCollection(SESSIONS_COLLECTION))
            adminLeaf.registerCollection(sessionsCollection(users.collection, hasUsers));
        (_b = adminLeaf.setFeature) === null || _b === void 0 ? void 0 : _b.call(adminLeaf, 'analytics', {
            collection: EVENTS_COLLECTION,
            sessions: SESSIONS_COLLECTION,
            usersCollection: hasUsers ? users.collection : null,
            timezone: this.config.timezone || 'UTC',
            sessionTimeoutMinutes: (_c = this.config.sessionTimeoutMinutes) !== null && _c !== void 0 ? _c : 30,
            sources: { api: !!trackOptions(this.config), app: !!ingestOptions(this.config) },
            labels: (_d = this.config.labels) !== null && _d !== void 0 ? _d : {},
            funnels: (_e = this.config.funnels) !== null && _e !== void 0 ? _e : [],
        });
    }
    /**
     * Records events from the project's own code: a payment confirmed by a
     * webhook, a booking made by a cron. They join the user's current visit.
     */
    track(event, context) {
        return this.collector.track([Object.assign({ type: 'action' }, event)], context, 'api');
    }
    /** Writes what is waiting now, before a deliberate shutdown say. */
    flush() {
        return this.collector.flush();
    }
    scheduleRetention() {
        var _a, _b, _c, _d, _e;
        const days = (_a = this.config.retentionDays) !== null && _a !== void 0 ? _a : 395;
        if (!days || days <= 0)
            return;
        const DAY = 24 * 3600 * 1000;
        const purge = () => __awaiter(this, void 0, void 0, function* () {
            try {
                // Once a day across all servers: a big DELETE run by each of
                // them at once only fights over the same rows.
                yield runExclusive('eth_analytics.retention', { ttlMs: DAY - 10 * 60 * 1000, release: false }, () => __awaiter(this, void 0, void 0, function* () {
                    const cutoff = new Date(Date.now() - days * DAY);
                    yield AnalyticsEvent.destroy({ where: { created_at: { [Op.lt]: cutoff } } });
                    yield AnalyticsSession.destroy({ where: { last_seen_at: { [Op.lt]: cutoff } } });
                }));
            }
            catch (err) {
                console.error('[ETHAnalyticsLeaf] Retention:', (err === null || err === void 0 ? void 0 : err.message) || err);
            }
        });
        // Not at boot: the tables may not be synced yet.
        (_c = (_b = setTimeout(purge, 60 * 1000)).unref) === null || _c === void 0 ? void 0 : _c.call(_b);
        (_e = (_d = setInterval(purge, DAY)).unref) === null || _e === void 0 ? void 0 : _e.call(_d);
    }
    commands() {
        return [
            {
                command: 'purge',
                description: 'Delete every analytics event and visit (asks nothing: for test databases)',
                action: () => __awaiter(this, void 0, void 0, function* () {
                    const events = yield AnalyticsEvent.destroy({ where: {}, truncate: true });
                    const sessions = yield AnalyticsSession.destroy({ where: {}, truncate: true });
                    return { success: true, message: `Purged analytics (${events !== null && events !== void 0 ? events : 0} events, ${sessions !== null && sessions !== void 0 ? sessions : 0} visits)` };
                }),
            },
        ];
    }
}
const TYPES = [
    { value: 'screen', label: 'Screen', color: 'blue' },
    { value: 'action', label: 'Action', color: 'green' },
    { value: 'api', label: 'API call', color: 'gray' },
    { value: 'app', label: 'App', color: 'purple' },
];
const PLATFORMS = [
    { value: 'ios', label: 'iOS' },
    { value: 'android', label: 'Android' },
    { value: 'web', label: 'Web' },
];
function userField(usersCollection, hasUsers, label) {
    return hasUsers
        ? { name: 'user_id', type: 'relation', label, filterable: true, relation: { collection: usersCollection, displayField: 'email' } }
        : { name: 'user_id', type: 'integer', label, filterable: true };
}
function eventsCollection(usersCollection, hasUsers) {
    return {
        name: EVENTS_COLLECTION,
        model: AnalyticsEvent,
        crud: ['list', 'show'],
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
            { name: 'id', type: 'integer', readonly: true, sortable: true },
            { name: 'created_at', type: 'datetime', label: 'Date', readonly: true, sortable: true, filterable: true },
            { name: 'type', type: 'select', label: 'Type', filterable: true, options: TYPES },
            { name: 'name', type: 'string', label: 'Name', searchable: true, filterable: true },
            { name: 'screen', type: 'string', label: 'On screen', filterable: true },
            userField(usersCollection, hasUsers, 'User'),
            { name: 'session_id', type: 'string', label: 'Visit', filterable: true },
            { name: 'installation_id', type: 'string', label: 'App install', filterable: true },
            { name: 'platform', type: 'select', label: 'Platform', filterable: true, options: PLATFORMS },
            { name: 'app_version', type: 'string', label: 'App version', filterable: true },
            { name: 'duration_ms', type: 'integer', label: 'Duration (ms)', sortable: true },
            { name: 'status', type: 'integer', label: 'HTTP status', filterable: true },
            { name: 'properties', type: 'json', label: 'Details', readonly: true },
        ],
        views: {
            list: {
                fields: ['created_at', 'type', 'name', 'user_id', 'platform', 'app_version', 'duration_ms'],
                sort: { field: 'created_at', direction: 'desc' },
                search: ['name'],
                filters: ['type', 'user_id', 'platform', 'app_version', 'created_at'],
            },
            show: {
                layout: 'sections',
                sections: [
                    { title: 'Event', fields: ['type', 'name', 'screen', 'created_at', 'duration_ms', 'status', 'properties'] },
                    { title: 'Who', fields: ['user_id', 'session_id', 'installation_id', 'platform', 'app_version'] },
                ],
            },
        },
    };
}
function sessionsCollection(usersCollection, hasUsers) {
    return {
        name: SESSIONS_COLLECTION,
        model: AnalyticsSession,
        crud: ['list', 'show'],
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
            { name: 'id', type: 'string', readonly: true },
            userField(usersCollection, hasUsers, 'User'),
            { name: 'started_at', type: 'datetime', label: 'Started', sortable: true, filterable: true },
            { name: 'last_seen_at', type: 'datetime', label: 'Last seen', sortable: true },
            { name: 'source', type: 'select', label: 'Seen by', filterable: true, options: [
                    { value: 'app', label: 'The app', color: 'green' },
                    { value: 'api', label: 'API calls only', color: 'gray' },
                ] },
            { name: 'platform', type: 'select', label: 'Platform', filterable: true, options: PLATFORMS },
            { name: 'app_version', type: 'string', label: 'App version', filterable: true },
            { name: 'os_version', type: 'string', label: 'OS version' },
            { name: 'device_model', type: 'string', label: 'Device' },
            { name: 'locale', type: 'string', label: 'Language', filterable: true },
            { name: 'screen_count', type: 'integer', label: 'Screens', sortable: true },
            { name: 'event_count', type: 'integer', label: 'Events', sortable: true },
            { name: 'entry_screen', type: 'string', label: 'First screen', filterable: true },
            { name: 'exit_screen', type: 'string', label: 'Last screen', filterable: true },
            { name: 'installation_id', type: 'string', label: 'App install', filterable: true },
        ],
        views: {
            list: {
                fields: ['started_at', 'user_id', 'platform', 'app_version', 'screen_count', 'event_count', 'entry_screen', 'exit_screen'],
                sort: { field: 'started_at', direction: 'desc' },
                filters: ['user_id', 'platform', 'app_version', 'source', 'started_at'],
            },
        },
    };
}
export * from './services/options.js';
export { AnalyticsEvent } from './models/AnalyticsEvent.js';
export { AnalyticsSession } from './models/AnalyticsSession.js';
