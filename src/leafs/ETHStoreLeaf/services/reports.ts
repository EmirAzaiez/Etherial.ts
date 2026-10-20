// ──────────────────────────────────────────────────────────────────────────
// What the back-office's Stores page reads: each store's figures over the
// period against the one before, the days, the countries, where the first
// downloads came from, and the reviews. Postgres only.
// ──────────────────────────────────────────────────────────────────────────

import etherial from 'etherial'
import { QueryTypes } from 'sequelize'

import { StoreStatus } from '../models/StoreStatus.js'
import { shiftDay, todayIn } from './common.js'
import { STORES, STORE_LABELS, StoreName, missingKeys, readsPublicRating, storesOf } from './options.js'
import { state } from './state.js'
import { SYNC_TTL_MS } from './sync.js'

const DAY_MS = 24 * 3600 * 1000
const DAY = /^\d{4}-\d{2}-\d{2}$/
const TOP_COUNTRIES = 20
const REVIEWS_PAGE = 20

export type Metric =
    | 'downloads'
    | 'redownloads'
    | 'updates'
    | 'uninstalls'
    | 'impressions'
    | 'page_views'
    | 'acquisitions'
    | 'sessions'
    | 'session_seconds'
    | 'session_devices'
    | 'crashes'
    | 'anrs'

/** Added up over the period; the devices are a level, their daily average. */
const SUMS: Metric[] = ['downloads', 'redownloads', 'updates', 'uninstalls', 'impressions', 'page_views', 'acquisitions', 'sessions', 'session_seconds', 'crashes', 'anrs']
const METRICS: Metric[] = [...SUMS, 'session_devices']

/** What each store's reports give. */
export const STORE_METRICS: Record<StoreName, Metric[]> = {
    apple: ['downloads', 'redownloads', 'updates', 'uninstalls', 'impressions', 'page_views', 'acquisitions', 'sessions', 'session_seconds', 'session_devices', 'crashes'],
    google: ['downloads', 'redownloads', 'updates', 'uninstalls', 'page_views', 'acquisitions', 'crashes', 'anrs'],
}

/** Apple's, from the people who share their data with developers only: lower than the real ones. */
export const STORE_OPT_IN: Record<StoreName, Metric[]> = {
    apple: ['uninstalls', 'sessions', 'session_seconds', 'session_devices', 'crashes'],
    google: [],
}

/** From the downloads report: zero on a day it has nothing. The others are left out until their report comes. */
const DOWNLOADS_REPORT: Record<StoreName, Metric[]> = {
    apple: ['downloads', 'redownloads', 'updates'],
    google: ['downloads', 'redownloads', 'updates', 'uninstalls'],
}

export class ReportError extends Error {
    constructor(
        public status: number,
        public code: string
    ) {
        super(code)
    }
}

export interface Range {
    from: string
    to: string
    days: number
    tz: string
}

function sequelize(): any {
    return (etherial as any).database?.sequelize
}

export function ensurePostgres() {
    if (sequelize()?.getDialect?.() !== 'postgres') throw new ReportError(501, 'postgres_required')
}

async function rows<T = any>(sql: string, replacements: Record<string, unknown>): Promise<T[]> {
    return sequelize().query(sql, { replacements, type: QueryTypes.SELECT })
}

/** `?from=&to=` as calendar days; the last 30 days when not given. Two years at most. */
export function rangeOf(query: any): Range {
    const tz = state.config.timezone || 'UTC'
    const to = typeof query?.to === 'string' && DAY.test(query.to) ? query.to : todayIn(tz)
    let from = typeof query?.from === 'string' && DAY.test(query.from) ? query.from : shiftDay(to, -29)
    if (from > to) from = to
    if (Date.parse(to) - Date.parse(from) > 731 * DAY_MS) from = shiftDay(to, -731)
    const days = Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1
    return { from, to, days, tz }
}

const asNumber = (v: unknown) => (v == null ? null : Number(v))

/** A review's day, where the project lives. */
const REVIEW_DAY = `CAST(written_at AT TIME ZONE :tz AS date)`

export async function overview(query: any) {
    const config = state.config
    const range = rangeOf(query)
    const before = { from: shiftDay(range.from, -range.days), to: shiftDay(range.from, -1) }
    const span = { from: range.from, to: range.to, pfrom: before.from, pto: before.to, tz: range.tz }

    const [totals, daily, countries, devices, ratings, ratingsBefore, sources, through, reviews, statuses] = await Promise.all([
        rows(
            `SELECT store, CASE WHEN date >= CAST(:from AS date) THEN 'current' ELSE 'previous' END AS period,
                    ${SUMS.map((m) => `SUM(${m})::float AS ${m}`).join(', ')}, AVG(session_devices)::float AS session_devices
             FROM store_daily_stats
             WHERE country = '' AND date BETWEEN CAST(:pfrom AS date) AND CAST(:to AS date)
             GROUP BY 1, 2`,
            span
        ),
        rows(
            `SELECT store, to_char(date, 'YYYY-MM-DD') AS date, ${METRICS.join(', ')}, active_devices,
                    rating_average AS rating, ratings_count AS ratings
             FROM store_daily_stats
             WHERE country = '' AND date BETWEEN CAST(:from AS date) AND CAST(:to AS date)
             ORDER BY date, store`,
            span
        ),
        rows(
            `SELECT country, store, SUM(downloads)::int AS downloads
             FROM store_daily_stats
             WHERE country <> '' AND date BETWEEN CAST(:from AS date) AND CAST(:to AS date)
             GROUP BY 1, 2`,
            span
        ),
        // A level, not a sum: the last day the period has one.
        rows(
            `SELECT DISTINCT ON (store) store, active_devices, to_char(date, 'YYYY-MM-DD') AS date
             FROM store_daily_stats
             WHERE country = '' AND active_devices IS NOT NULL AND date BETWEEN CAST(:from AS date) AND CAST(:to AS date)
             ORDER BY store, date DESC`,
            span
        ),
        rows(
            `SELECT DISTINCT ON (store) store, rating_average AS rating, ratings_count AS ratings
             FROM store_daily_stats
             WHERE country = '' AND rating_average IS NOT NULL AND date <= CAST(:to AS date)
             ORDER BY store, date DESC`,
            span
        ),
        rows(
            `SELECT DISTINCT ON (store) store, rating_average AS rating, ratings_count AS ratings
             FROM store_daily_stats
             WHERE country = '' AND rating_average IS NOT NULL AND date <= CAST(:pto AS date)
             ORDER BY store, date DESC`,
            span
        ),
        rows(
            `SELECT store, source.key AS source, SUM(CAST(source.value AS numeric))::int AS count
             FROM store_daily_stats, json_each_text(sources) AS source
             WHERE country = '' AND sources IS NOT NULL AND date BETWEEN CAST(:from AS date) AND CAST(:to AS date)
             GROUP BY 1, 2`,
            span
        ),
        // How far the store listing's report goes: it comes days after the downloads.
        rows(
            `SELECT store, to_char(MAX(date), 'YYYY-MM-DD') AS date
             FROM store_daily_stats
             WHERE country = '' AND page_views IS NOT NULL
             GROUP BY 1`,
            span
        ),
        rows(
            `SELECT store, CASE WHEN ${REVIEW_DAY} >= CAST(:from AS date) THEN 'current' ELSE 'previous' END AS period,
                    rating, COUNT(*)::int AS count, COUNT(reply)::int AS replied
             FROM store_reviews
             WHERE ${REVIEW_DAY} BETWEEN CAST(:pfrom AS date) AND CAST(:to AS date)
             GROUP BY 1, 2, 3`,
            span
        ),
        StoreStatus.findAll(),
    ])

    const stores = storesOf(config).map((store) => {
        const missing = missingKeys(config, store)
        const connected = missing.length === 0
        const status = statuses.find((s) => s.store === store)
        const started = status?.sync_started_at ? new Date(status.sync_started_at).getTime() : 0
        const totalsOf = (period: 'current' | 'previous') => {
            const row = totals.find((t) => t.store === store && t.period === period)
            return Object.fromEntries(
                METRICS.map((m) => {
                    if (!connected || !STORE_METRICS[store].includes(m)) return [m, null]
                    const value = asNumber(row?.[m])
                    return [m, value ?? (DOWNLOADS_REPORT[store].includes(m) ? 0 : null)]
                })
            ) as Record<Metric, number | null>
        }
        const reviewsOf = (period: 'current' | 'previous') => {
            const of = reviews.filter((r) => r.store === store && r.period === period)
            const count = of.reduce((sum, r) => sum + r.count, 0)
            return {
                count,
                replied: of.reduce((sum, r) => sum + r.replied, 0),
                average: count ? of.reduce((sum, r) => sum + r.rating * r.count, 0) / count : null,
                // How many gave 1 star, 2, … 5.
                stars: [1, 2, 3, 4, 5].map((stars) => of.find((r) => r.rating === stars)?.count ?? 0),
            }
        }
        const rating = ratings.find((r) => r.store === store)
        const ratingBefore = ratingsBefore.find((r) => r.store === store)
        const device = devices.find((d) => d.store === store)
        const bySource = sources.filter((s) => s.store === store)
        return {
            store,
            label: STORE_LABELS[store],
            public_rating: readsPublicRating(config, store),
            connected,
            missing,
            metrics: STORE_METRICS[store],
            opt_in: STORE_OPT_IN[store],
            app: status?.app ?? null,
            synced_at: status?.synced_at ?? null,
            syncing: !!started && Date.now() - started < SYNC_TTL_MS,
            error: status?.error ?? null,
            notice: status?.notice ?? null,
            data_through: status?.data_through ?? null,
            listing_through: through.find((t) => t.store === store)?.date ?? null,
            current: totalsOf('current'),
            previous: totalsOf('previous'),
            active_devices: asNumber(device?.active_devices),
            active_devices_on: device?.date ?? null,
            rating: asNumber(rating?.rating),
            ratings_count: asNumber(rating?.ratings),
            previous_rating: asNumber(ratingBefore?.rating),
            previous_ratings_count: asNumber(ratingBefore?.ratings),
            sources: bySource.length ? Object.fromEntries(bySource.map((s) => [s.source, Number(s.count)])) : null,
            reviews: reviewsOf('current'),
            previous_reviews: reviewsOf('previous'),
        }
    })

    const byCountry = new Map<string, { country: string; apple: number; google: number; total: number }>()
    for (const row of countries) {
        const entry = byCountry.get(row.country) ?? { country: row.country, apple: 0, google: 0, total: 0 }
        const n = Number(row.downloads ?? 0)
        if (row.store === 'apple' || row.store === 'google') entry[row.store as StoreName] += n
        entry.total += n
        byCountry.set(row.country, entry)
    }
    const ranked = [...byCountry.values()].filter((c) => c.total > 0).sort((a, b) => b.total - a.total)

    return {
        range,
        stores,
        daily: daily.map((d) => ({
            date: d.date,
            store: d.store,
            ...Object.fromEntries(METRICS.map((m) => [m, asNumber(d[m])])),
            active_devices: asNumber(d.active_devices),
            rating: asNumber(d.rating),
            ratings: asNumber(d.ratings),
        })),
        countries: ranked.slice(0, TOP_COUNTRIES),
        countries_total: ranked.length,
    }
}

/** GET /admin/stores/reviews: the period's reviews, newest first, a page at a time; `store` and `stars` narrow them. */
export async function reviewsOf(query: any) {
    const range = rangeOf(query)
    const where = [`${REVIEW_DAY} BETWEEN CAST(:from AS date) AND CAST(:to AS date)`]
    const replacements: Record<string, unknown> = { from: range.from, to: range.to, tz: range.tz }
    if (STORES.includes(query?.store)) {
        where.push('store = :store')
        replacements.store = query.store
    }
    const stars = Number(query?.stars)
    if (Number.isInteger(stars) && stars >= 1 && stars <= 5) {
        where.push('rating = :stars')
        replacements.stars = stars
    }
    if (query?.replied === 'yes' || query?.replied === 'no') where.push(query.replied === 'yes' ? 'reply IS NOT NULL' : 'reply IS NULL')

    const [counted] = await rows(`SELECT COUNT(*)::int AS total FROM store_reviews WHERE ${where.join(' AND ')}`, replacements)
    const total = counted?.total ?? 0
    const pages = Math.max(Math.ceil(total / REVIEWS_PAGE), 1)
    const page = Math.min(Math.max(Math.floor(Number(query?.page)) || 1, 1), pages)
    const items = await rows(
        `SELECT id, store, rating, title, body, author, territory, language, version, device, written_at, reply, replied_at, url
         FROM store_reviews
         WHERE ${where.join(' AND ')}
         ORDER BY written_at DESC, id DESC
         LIMIT ${REVIEWS_PAGE} OFFSET ${(page - 1) * REVIEWS_PAGE}`,
        replacements
    )
    return { items, total, page, pages }
}
