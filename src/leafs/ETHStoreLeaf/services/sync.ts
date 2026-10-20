// ──────────────────────────────────────────────────────────────────────────
// Bringing the stores' numbers in, from their own reports — but for Apple's
// rating, which only its public page gives. Every sync reads the last week
// again (a day comes out late, or is revised) and, the first time or once
// `backfillDays` grew, the days before. Each part is read on its own: one
// failing leaves the others. Postgres only.
// ──────────────────────────────────────────────────────────────────────────

import etherial from 'etherial'

import { runExclusive } from '../../../components/database/lock.js'
import { StoreCursor, StoreStatus } from '../models/StoreStatus.js'
import { appleApp, appleBearer, applePublicRating, appleReviews, appleSalesDay } from './apple.js'
import { appleAnalytics } from './appleAnalytics.js'
import { DayMetrics, DayRow, METRIC_COLUMNS, ReviewRow, StoreError, errorMessage, shiftDay, todayIn } from './common.js'
import { googleApp, googleMonth } from './google.js'
import { ETHStoreLeafConfig, StoreName, backfillDays, missingKeys, readsPublicRating, storesOf, syncEveryMs } from './options.js'
import { state } from './state.js'

const LOCK = 'eth_store.sync'
/** Past this, a sync that never said it ended is taken for dead (its server stopped). */
export const SYNC_TTL_MS = 30 * 60 * 1000
const RECENT_DAYS = 7
/** Apple keeps its daily sales reports a year. */
const APPLE_DAYS = 365
/** Reports asked of App Store Connect at once. */
const APPLE_PARALLEL = 4
/** Reviews read again, back from the newest one kept: the author edits it, the developer replies. */
const REVIEWS_AGAIN_DAYS = 14

function sequelize(): any {
    return (etherial as any).database?.sequelize
}

/** The first day kept: `backfill` days back from yesterday, `limit` at most. */
export function firstDay(backfill: number, limit = Infinity): string {
    const last = shiftDay(new Date().toISOString().slice(0, 10), -1)
    return shiftDay(last, -(Math.min(backfill, limit) - 1))
}

/**
 * The days to ask for, oldest first: the last week (from the last day with a
 * report, if the server was off longer), and the days never asked for.
 */
export function daysToRead(status: { backfilled_from: string | null; data_through: string | null } | null, backfill: number, limit: number): string[] {
    const last = shiftDay(new Date().toISOString().slice(0, 10), -1)
    const first = firstDay(backfill, limit)
    let since = shiftDay(last, -(RECENT_DAYS - 1))
    if (status?.data_through && status.data_through < since) since = status.data_through
    const days: string[] = []
    for (let day = first; day <= last; day = shiftDay(day, 1)) {
        if (!status?.backfilled_from || day < status.backfilled_from || day >= since) days.push(day)
    }
    return days
}

/** One store's day of downloads, as the report gives it: the countries no longer in it go. */
export async function writeDay(store: StoreName, day: string, rows: DayRow[]): Promise<void> {
    // Google's installs report also gives the uninstalls and the active devices; Apple's sales report does not.
    const columns = ['downloads', 'redownloads', 'updates', ...(['uninstalls', 'active_devices'] as const).filter((k) => rows.some((r) => k in r))]
    const db = sequelize()
    await db.transaction(async (transaction: any) => {
        await db.query(`DELETE FROM store_daily_stats WHERE store = :store AND date = :day AND country <> ''`, { replacements: { store, day }, transaction })
        if (!rows.length) return
        const replacements: Record<string, unknown> = { store, day }
        const values = rows.map((row, i) => {
            replacements[`c${i}`] = row.country
            columns.forEach((column, j) => (replacements[`v${i}_${j}`] = (row as any)[column] ?? null))
            return `(:store, :day, :c${i}, ${columns.map((_, j) => `:v${i}_${j}`).join(', ')}, NOW(), NOW())`
        })
        // The all-countries row keeps the other reports' figures: only these are this one's.
        await db.query(
            `INSERT INTO store_daily_stats (store, date, country, ${columns.join(', ')}, created_at, updated_at)
             VALUES ${values.join(', ')}
             ON CONFLICT (store, date, country) DO UPDATE SET ${columns.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}, updated_at = NOW()`,
            { replacements, transaction }
        )
    })
}

/** A day's figures from one report, on the all-countries row: those it gives replace theirs, the rest stay. */
export async function writeMetrics(store: StoreName, day: string, metrics: DayMetrics): Promise<void> {
    const columns = METRIC_COLUMNS.filter((k) => k in metrics)
    if (!columns.length) return
    const replacements: Record<string, unknown> = { store, day }
    const values = columns.map((column) => {
        const value = metrics[column]
        if (column === 'sources') {
            replacements[column] = value == null ? null : JSON.stringify(value)
            return `CAST(:${column} AS json)`
        }
        replacements[column] = value ?? null
        return `:${column}`
    })
    await sequelize().query(
        `INSERT INTO store_daily_stats (store, date, country, ${columns.join(', ')}, created_at, updated_at)
         VALUES (:store, :day, '', ${values.join(', ')}, NOW(), NOW())
         ON CONFLICT (store, date, country) DO UPDATE SET ${columns.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}, updated_at = NOW()`,
        { replacements }
    )
}

const REVIEW_COLUMNS: (keyof ReviewRow)[] = [
    'review_id',
    'rating',
    'title',
    'body',
    'author',
    'territory',
    'language',
    'version',
    'device',
    'written_at',
    'reply',
    'replied_at',
    'url',
]

/** The reviews as the store has them now: a new one is added, one read before takes its edits and its reply. */
export async function upsertReviews(store: StoreName, reviews: ReviewRow[]): Promise<void> {
    for (let start = 0; start < reviews.length; start += 200) {
        const chunk = reviews.slice(start, start + 200)
        const replacements: Record<string, unknown> = { store }
        const values = chunk.map((review, i) => {
            REVIEW_COLUMNS.forEach((column, j) => (replacements[`r${i}_${j}`] = review[column] ?? null))
            return `(:store, ${REVIEW_COLUMNS.map((_, j) => `:r${i}_${j}`).join(', ')}, NOW(), NOW())`
        })
        const updated = REVIEW_COLUMNS.filter((c) => c !== 'review_id')
        await sequelize().query(
            `INSERT INTO store_reviews (store, ${REVIEW_COLUMNS.join(', ')}, created_at, updated_at)
             VALUES ${values.join(', ')}
             ON CONFLICT (store, review_id) DO UPDATE SET ${updated.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}, updated_at = NOW()`,
            { replacements }
        )
    }
}

async function newestReview(store: StoreName): Promise<Date | null> {
    const [rows] = await sequelize().query(`SELECT MAX(written_at) AS at FROM store_reviews WHERE store = :store`, { replacements: { store } })
    return rows[0]?.at ? new Date(rows[0].at) : null
}

/** `fn` on every item, `limit` at a time; the first error stops what has not started and is thrown. */
async function eachLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
    let next = 0
    let failed: unknown = null
    const worker = async () => {
        while (!failed && next < items.length) {
            const item = items[next++]
            try {
                await fn(item)
            } catch (err) {
                failed ??= err
            }
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
    if (failed) throw failed
}

const earliest = (a: string | null | undefined, b: string | undefined) => (!a ? b ?? null : !b ? a : a < b ? a : b)
const latest = (a: string | null, b: string) => (!a || b > a ? b : a)

type SyncResult = Pick<StoreStatus, 'app' | 'error' | 'notice' | 'data_through' | 'backfilled_from' | 'cursor'>

/** Runs one part of a sync: what goes wrong is told, and the next part runs. */
async function part<T>(errors: string[], fn: () => Promise<T>): Promise<T | undefined> {
    try {
        return await fn()
    } catch (err) {
        errors.push(errorMessage(err))
        return undefined
    }
}

function resultOf(status: StoreStatus): SyncResult {
    return {
        app: status.app,
        error: null,
        notice: null,
        data_through: status.data_through,
        backfilled_from: status.backfilled_from,
        // Copied: changed as the reports are read, saved with the rest.
        cursor: JSON.parse(JSON.stringify(status.cursor ?? {})) as StoreCursor,
    }
}

function close(result: SyncResult, errors: string[], notices: string[]): SyncResult {
    result.error = errors.length ? [...new Set(errors)].join(' · ') : null
    result.notice = notices.length ? [...new Set(notices)].join(' · ') : null
    return result
}

async function syncApple(config: ETHStoreLeafConfig, status: StoreStatus): Promise<SyncResult> {
    const c = config.apple!
    const errors: string[] = []
    const notices: string[] = []
    const result = resultOf(status)

    if (readsPublicRating(config, 'apple')) {
        await part(errors, async () => {
            const rating = await applePublicRating(c)
            if (!rating) throw new StoreError(`${c.appId || c.bundleId} is not on the App Store in the storefronts listed`)
            await writeMetrics('apple', todayIn(config.timezone || 'UTC'), { rating_average: rating.rating, ratings_count: rating.ratings_count })
        })
    }
    if (missingKeys(config, 'apple').length) return close(result, errors, notices)

    const bearer = await part(errors, async () => appleBearer(c))
    if (!bearer) return close(result, errors, notices)
    const app = await part(errors, () => appleApp(c, bearer))
    if (app) result.app = app
    const appId = c.appId || result.app?.id
    if (!appId) {
        errors.push('The app\'s App Store id is unknown: set apple.appId, or check apple.bundleId')
        return close(result, errors, notices)
    }

    const days = daysToRead(status, backfillDays(config), APPLE_DAYS)
    await part(errors, async () => {
        await eachLimit(days, APPLE_PARALLEL, async (day) => {
            const rows = await appleSalesDay(c, appId, day, bearer())
            if (!rows) return
            await writeDay('apple', day, rows)
            result.data_through = latest(result.data_through, day)
        })
        result.backfilled_from = earliest(status.backfilled_from, days[0])
    })

    await part(errors, async () => {
        const newest = await newestReview('apple')
        const since = newest ? new Date(newest.getTime() - REVIEWS_AGAIN_DAYS * 24 * 3600 * 1000) : null
        await upsertReviews('apple', await appleReviews(appId, bearer, since))
    })

    await part(errors, async () => {
        const notice = await appleAnalytics({
            appId,
            bearer,
            cursor: result.cursor!,
            since: firstDay(backfillDays(config)),
            write: (day, metrics) => writeMetrics('apple', day, metrics),
        })
        if (notice) notices.push(notice)
    })
    return close(result, errors, notices)
}

async function syncGoogle(config: ETHStoreLeafConfig, status: StoreStatus): Promise<SyncResult> {
    const c = config.google!
    const errors: string[] = []
    const notices: string[] = []
    const result = resultOf(status)

    // Not needed for the figures: told, not an error.
    const app = await part(notices, () => googleApp(c))
    if (app) result.app = app

    const days = daysToRead(status, backfillDays(config), Infinity)
    const first = days[0]
    // One file per month and per report, the whole month in it.
    const months = [...new Set(days.map((d) => d.slice(0, 7).replace('-', '')))]
    let read = true
    for (const month of months) {
        const files = await part(errors, () => googleMonth(c, month))
        if (!files) {
            read = false
            continue
        }
        await part(errors, async () => {
            // A month's file has every day of it: those before the first one kept stay out.
            for (const [day, rows] of files.installs ?? []) {
                if (day < first) continue
                await writeDay('google', day, rows)
                result.data_through = latest(result.data_through, day)
            }
            const byDay = new Map<string, DayMetrics>()
            for (const report of [files.ratings, files.crashes, files.listing, files.sources]) {
                for (const [day, metrics] of report ?? []) byDay.set(day, { ...byDay.get(day), ...metrics })
            }
            for (const [day, metrics] of byDay) if (day >= first) await writeMetrics('google', day, metrics)
            if (files.reviews) await upsertReviews('google', files.reviews)
        })
    }
    if (read) result.backfilled_from = earliest(status.backfilled_from, first)
    return close(result, errors, notices)
}

/** Whether a sync has anything to read for the store: its keys, or Apple's public rating. */
export function readsSomething(config: ETHStoreLeafConfig, store: StoreName): boolean {
    return readsPublicRating(config, store) || !missingKeys(config, store).length
}

/**
 * Syncs the stores due — their last sync older than `syncEveryHours` — or
 * all of them with `force`. One server at a time: false when another one is
 * already at it.
 */
export async function syncStores({ force = false, only }: { force?: boolean; only?: StoreName } = {}): Promise<boolean> {
    const config = state.config
    const ran = await runExclusive(LOCK, { ttlMs: SYNC_TTL_MS }, async () => {
        for (const store of storesOf(config)) {
            if (only && store !== only) continue
            if (!readsSomething(config, store)) continue
            const [status] = await StoreStatus.findOrCreate({ where: { store }, defaults: { store } as any })
            if (!force && status.synced_at && Date.now() - new Date(status.synced_at).getTime() < syncEveryMs(config)) continue

            await status.update({ sync_started_at: new Date() })
            try {
                const result = store === 'apple' ? await syncApple(config, status) : await syncGoogle(config, status)
                await status.update({ ...result, synced_at: new Date(), sync_started_at: null })
            } catch (err) {
                await status.update({ error: errorMessage(err), synced_at: new Date(), sync_started_at: null })
            }
            if (status.error) console.warn(`[ETHStoreLeaf] ${store}: ${status.error}`)
        }
        return true
    })
    return ran === true
}
