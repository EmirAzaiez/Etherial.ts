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
import { fileURLToPath } from 'url';
import { StoreDailyStat } from './models/StoreDailyStat.js';
import { StoreReview } from './models/StoreReview.js';
import { StoreStatus } from './models/StoreStatus.js';
import { STATS_COLLECTION, STORE_LABELS, missingKeys, readsPublicRating, storesOf } from './services/options.js';
import { STORE_METRICS, STORE_OPT_IN } from './services/reports.js';
import { state } from './services/state.js';
import { syncStores } from './services/sync.js';
export * from './services/options.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** How often the clock looks for a store due: each one syncs every `syncEveryHours`. */
const TICK_MS = 10 * 60 * 1000;
/**
 * ETHStoreLeaf — the app on the App Store and Google Play, in the back-office.
 *
 * Every figure comes from the stores' own reports, read with their keys:
 * downloads, re-downloads, updates and uninstalls by country, the store
 * listing (views, first downloads, where they came from), sessions, crashes,
 * the written reviews. Apple's rating alone comes from its public page, the
 * API not giving it. The back-office's Stores page reads them. Postgres only.
 */
export default class ETHStoreLeaf {
    constructor(config = {}) {
        this.etherial_module_name = 'eth_store_leaf';
        this.routes = [];
        this.config = config;
        state.config = config;
        this.routes.push({ route: path.join(__dirname, 'routes/admin'), methods: ['overview', 'reviews', 'sync'] });
    }
    /** Lifecycle: beforeRun — hand the tables to the database before it syncs. */
    beforeRun({ database }) {
        database === null || database === void 0 ? void 0 : database.addModels([StoreDailyStat, StoreReview, StoreStatus]);
    }
    /** Lifecycle: run — routes, and the clock that syncs the stores. */
    run({ http }) {
        var _a, _b, _c;
        (_a = http === null || http === void 0 ? void 0 : http.routes_leafs) === null || _a === void 0 ? void 0 : _a.push(...this.routes);
        const tick = () => __awaiter(this, void 0, void 0, function* () {
            try {
                yield syncStores();
            }
            catch (err) {
                console.error('[ETHStoreLeaf] Could not sync the stores:', (err === null || err === void 0 ? void 0 : err.message) || err);
            }
        });
        // Not at boot: the tables may not be synced yet.
        (_c = (_b = setInterval(tick, TICK_MS)).unref) === null || _c === void 0 ? void 0 : _c.call(_b);
        const summary = storesOf(this.config).map((store) => {
            const missing = missingKeys(this.config, store);
            return `${STORE_LABELS[store]} ${!missing.length ? 'connected' : readsPublicRating(this.config, store) ? 'public rating only' : 'not set up'}`;
        });
        console.log(`[ETHStoreLeaf] ${summary.length ? summary.join(', ') : 'No store yet: set apple or google'}`);
    }
    /** Lifecycle: afterRun — tell the back-office. */
    afterRun() {
        var _a;
        const adminLeaf = etherial.eth_admin_leaf;
        if (!(adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.registerCollection))
            return;
        if (!adminLeaf.getCollection(STATS_COLLECTION))
            adminLeaf.registerCollection(statsCollection());
        (_a = adminLeaf.setFeature) === null || _a === void 0 ? void 0 : _a.call(adminLeaf, 'stores', {
            collection: STATS_COLLECTION,
            timezone: this.config.timezone || 'UTC',
            // Which keys are missing, never the keys.
            stores: storesOf(this.config).map((store) => ({
                store,
                label: STORE_LABELS[store],
                public_rating: readsPublicRating(this.config, store),
                connected: missingKeys(this.config, store).length === 0,
                missing: missingKeys(this.config, store),
                metrics: STORE_METRICS[store],
                opt_in: STORE_OPT_IN[store],
            })),
        });
    }
    /** Syncs the stores now, from the project's own code. False when another server is at it. */
    sync(store) {
        return syncStores({ force: true, only: store });
    }
    commands() {
        return [
            {
                command: 'sync',
                description: 'Read the stores now: their reports, and Apple\'s public rating',
                action: () => __awaiter(this, void 0, void 0, function* () {
                    const ran = yield syncStores({ force: true });
                    if (!ran)
                        return { success: false, message: 'Another sync is running' };
                    const statuses = yield StoreStatus.findAll();
                    const lines = statuses.map((s) => { var _a; return `${s.store}: ${s.error ? `error — ${s.error}` : `ok, data through ${(_a = s.data_through) !== null && _a !== void 0 ? _a : '—'}`}${s.notice ? ` (${s.notice})` : ''}`; });
                    return { success: true, message: `Synced the stores\n${lines.join('\n')}` };
                }),
            },
            {
                command: 'purge',
                description: 'Delete every store number, review and sync status (asks nothing: for test databases)',
                action: () => __awaiter(this, void 0, void 0, function* () {
                    const count = yield StoreDailyStat.destroy({ where: {}, truncate: true });
                    yield StoreReview.destroy({ where: {}, truncate: true });
                    // The analytics requests stay asked at Apple: the next sync finds them again.
                    yield StoreStatus.destroy({ where: {}, truncate: true });
                    return { success: true, message: `Purged the stores (${count !== null && count !== void 0 ? count : 0} rows)` };
                }),
            },
        ];
    }
}
function statsCollection() {
    return {
        name: STATS_COLLECTION,
        model: StoreDailyStat,
        crud: ['list', 'show'],
        exportable: true,
        meta: {
            label: 'Store day',
            labelPlural: 'Store days',
            icon: 'Store',
            description: 'Each store, day and country: downloads, updates, uninstalls; the store listing, sessions, crashes and rating on the all-countries rows',
            group: 'System',
            order: 97,
            // Read through the Stores page; listed for exports and for the role permissions.
            hidden: true,
        },
        fields: [
            { name: 'id', type: 'integer', readonly: true, sortable: true },
            {
                name: 'store',
                type: 'select',
                label: 'Store',
                filterable: true,
                options: Object.keys(STORE_LABELS).map((s) => ({ value: s, label: STORE_LABELS[s] })),
            },
            { name: 'date', type: 'date', label: 'Day', sortable: true, filterable: true },
            { name: 'country', type: 'string', label: 'Country', filterable: true, helpText: 'Empty: every country together' },
            { name: 'downloads', type: 'integer', label: 'Downloads', sortable: true },
            { name: 'redownloads', type: 'integer', label: 'Re-downloads', sortable: true },
            { name: 'updates', type: 'integer', label: 'Updates', sortable: true },
            { name: 'uninstalls', type: 'integer', label: 'Uninstalls', sortable: true },
            { name: 'active_devices', type: 'integer', label: 'Active devices', sortable: true },
            { name: 'rating_average', type: 'number', label: 'Rating' },
            { name: 'ratings_count', type: 'integer', label: 'Ratings' },
            { name: 'impressions', type: 'integer', label: 'Impressions', sortable: true },
            { name: 'page_views', type: 'integer', label: 'Page views', sortable: true },
            { name: 'acquisitions', type: 'integer', label: 'From the page', sortable: true },
            { name: 'sessions', type: 'integer', label: 'Sessions', sortable: true },
            { name: 'session_seconds', type: 'number', label: 'Session seconds' },
            { name: 'session_devices', type: 'integer', label: 'Session devices' },
            { name: 'crashes', type: 'integer', label: 'Crashes', sortable: true },
            { name: 'anrs', type: 'integer', label: 'ANRs', sortable: true },
        ],
        views: {
            list: {
                fields: ['date', 'store', 'country', 'downloads', 'redownloads', 'updates', 'uninstalls', 'active_devices', 'rating_average'],
                sort: { field: 'date', direction: 'desc' },
                filters: ['store', 'date', 'country'],
            },
        },
    };
}
