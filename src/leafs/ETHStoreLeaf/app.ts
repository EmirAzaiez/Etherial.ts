import etherial, { Etherial } from 'etherial'
import * as path from 'path'
import { fileURLToPath } from 'url'

import { StoreDailyStat } from './models/StoreDailyStat.js'
import { StoreReview } from './models/StoreReview.js'
import { StoreStatus } from './models/StoreStatus.js'
import { ETHStoreLeafConfig, STATS_COLLECTION, STORE_LABELS, StoreName, missingKeys, readsPublicRating, storesOf } from './services/options.js'
import { STORE_METRICS, STORE_OPT_IN } from './services/reports.js'
import { state } from './services/state.js'
import { syncStores } from './services/sync.js'

export * from './services/options.js'
export type { StoreAppInfo } from './models/StoreStatus.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** How often the clock looks for a store due: each one syncs every `syncEveryHours`. */
const TICK_MS = 10 * 60 * 1000

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
    readonly etherial_module_name = 'eth_store_leaf'

    public config: ETHStoreLeafConfig
    private routes: { route: string; methods: string[] }[] = []

    constructor(config: ETHStoreLeafConfig = {}) {
        this.config = config
        state.config = config
        this.routes.push({ route: path.join(__dirname, 'routes/admin'), methods: ['overview', 'reviews', 'sync'] })
    }

    /** Lifecycle: beforeRun — hand the tables to the database before it syncs. */
    beforeRun({ database }: Etherial) {
        database?.addModels([StoreDailyStat, StoreReview, StoreStatus] as any)
    }

    /** Lifecycle: run — routes, and the clock that syncs the stores. */
    run({ http }: Etherial) {
        http?.routes_leafs?.push(...this.routes)
        const tick = async () => {
            try {
                await syncStores()
            } catch (err: any) {
                console.error('[ETHStoreLeaf] Could not sync the stores:', err?.message || err)
            }
        }
        // Not at boot: the tables may not be synced yet.
        setInterval(tick, TICK_MS).unref?.()

        const summary = storesOf(this.config).map((store) => {
            const missing = missingKeys(this.config, store)
            return `${STORE_LABELS[store]} ${!missing.length ? 'connected' : readsPublicRating(this.config, store) ? 'public rating only' : 'not set up'}`
        })
        console.log(`[ETHStoreLeaf] ${summary.length ? summary.join(', ') : 'No store yet: set apple or google'}`)
    }

    /** Lifecycle: afterRun — tell the back-office. */
    afterRun() {
        const adminLeaf = (etherial as any).eth_admin_leaf
        if (!adminLeaf?.registerCollection) return
        if (!adminLeaf.getCollection(STATS_COLLECTION)) adminLeaf.registerCollection(statsCollection())

        adminLeaf.setFeature?.('stores', {
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
        })
    }

    /** Syncs the stores now, from the project's own code. False when another server is at it. */
    sync(store?: StoreName): Promise<boolean> {
        return syncStores({ force: true, only: store })
    }

    commands() {
        return [
            {
                command: 'sync',
                description: 'Read the stores now: their reports, and Apple\'s public rating',
                action: async () => {
                    const ran = await syncStores({ force: true })
                    if (!ran) return { success: false, message: 'Another sync is running' }
                    const statuses = await StoreStatus.findAll()
                    const lines = statuses.map(
                        (s) => `${s.store}: ${s.error ? `error — ${s.error}` : `ok, data through ${s.data_through ?? '—'}`}${s.notice ? ` (${s.notice})` : ''}`
                    )
                    return { success: true, message: `Synced the stores\n${lines.join('\n')}` }
                },
            },
            {
                command: 'purge',
                description: 'Delete every store number, review and sync status (asks nothing: for test databases)',
                action: async () => {
                    const count = await StoreDailyStat.destroy({ where: {}, truncate: true } as any)
                    await StoreReview.destroy({ where: {}, truncate: true } as any)
                    // The analytics requests stay asked at Apple: the next sync finds them again.
                    await StoreStatus.destroy({ where: {}, truncate: true } as any)
                    return { success: true, message: `Purged the stores (${count ?? 0} rows)` }
                },
            },
        ]
    }
}

function statsCollection() {
    return {
        name: STATS_COLLECTION,
        model: StoreDailyStat,
        crud: ['list', 'show'] as ('list' | 'show')[],
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
            { name: 'id', type: 'integer' as const, readonly: true, sortable: true },
            {
                name: 'store',
                type: 'select' as const,
                label: 'Store',
                filterable: true,
                options: (Object.keys(STORE_LABELS) as StoreName[]).map((s) => ({ value: s, label: STORE_LABELS[s] })),
            },
            { name: 'date', type: 'date' as const, label: 'Day', sortable: true, filterable: true },
            { name: 'country', type: 'string' as const, label: 'Country', filterable: true, helpText: 'Empty: every country together' },
            { name: 'downloads', type: 'integer' as const, label: 'Downloads', sortable: true },
            { name: 'redownloads', type: 'integer' as const, label: 'Re-downloads', sortable: true },
            { name: 'updates', type: 'integer' as const, label: 'Updates', sortable: true },
            { name: 'uninstalls', type: 'integer' as const, label: 'Uninstalls', sortable: true },
            { name: 'active_devices', type: 'integer' as const, label: 'Active devices', sortable: true },
            { name: 'rating_average', type: 'number' as const, label: 'Rating' },
            { name: 'ratings_count', type: 'integer' as const, label: 'Ratings' },
            { name: 'impressions', type: 'integer' as const, label: 'Impressions', sortable: true },
            { name: 'page_views', type: 'integer' as const, label: 'Page views', sortable: true },
            { name: 'acquisitions', type: 'integer' as const, label: 'From the page', sortable: true },
            { name: 'sessions', type: 'integer' as const, label: 'Sessions', sortable: true },
            { name: 'session_seconds', type: 'number' as const, label: 'Session seconds' },
            { name: 'session_devices', type: 'integer' as const, label: 'Session devices' },
            { name: 'crashes', type: 'integer' as const, label: 'Crashes', sortable: true },
            { name: 'anrs', type: 'integer' as const, label: 'ANRs', sortable: true },
        ],
        views: {
            list: {
                fields: ['date', 'store', 'country', 'downloads', 'redownloads', 'updates', 'uninstalls', 'active_devices', 'rating_average'],
                sort: { field: 'date', direction: 'desc' as const },
                filters: ['store', 'date', 'country'],
            },
        },
    }
}
