// ──────────────────────────────────────────────────────────────────────────
// What the back-office's Stores page reads: each store's figures over the
// period against the one before, the days, the countries, where the first
// downloads came from, and the reviews. Postgres only.
// ──────────────────────────────────────────────────────────────────────────
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
import { QueryTypes } from 'sequelize';
import { StoreStatus } from '../models/StoreStatus.js';
import { shiftDay, todayIn } from './common.js';
import { STORES, STORE_LABELS, missingKeys, readsPublicRating, storesOf } from './options.js';
import { state } from './state.js';
import { SYNC_TTL_MS } from './sync.js';
const DAY_MS = 24 * 3600 * 1000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TOP_COUNTRIES = 20;
const REVIEWS_PAGE = 20;
/** Added up over the period; the devices are a level, their daily average. */
const SUMS = ['downloads', 'redownloads', 'updates', 'uninstalls', 'impressions', 'page_views', 'acquisitions', 'sessions', 'session_seconds', 'crashes', 'anrs'];
const METRICS = [...SUMS, 'session_devices'];
/** What each store's reports give. */
export const STORE_METRICS = {
    apple: ['downloads', 'redownloads', 'updates', 'uninstalls', 'impressions', 'page_views', 'acquisitions', 'sessions', 'session_seconds', 'session_devices', 'crashes'],
    google: ['downloads', 'redownloads', 'updates', 'uninstalls', 'page_views', 'acquisitions', 'crashes', 'anrs'],
};
/** Apple's, from the people who share their data with developers only: lower than the real ones. */
export const STORE_OPT_IN = {
    apple: ['uninstalls', 'sessions', 'session_seconds', 'session_devices', 'crashes'],
    google: [],
};
/** From the downloads report: zero on a day it has nothing. The others are left out until their report comes. */
const DOWNLOADS_REPORT = {
    apple: ['downloads', 'redownloads', 'updates'],
    google: ['downloads', 'redownloads', 'updates', 'uninstalls'],
};
export class ReportError extends Error {
    constructor(status, code) {
        super(code);
        this.status = status;
        this.code = code;
    }
}
function sequelize() {
    var _a;
    return (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize;
}
export function ensurePostgres() {
    var _a, _b;
    if (((_b = (_a = sequelize()) === null || _a === void 0 ? void 0 : _a.getDialect) === null || _b === void 0 ? void 0 : _b.call(_a)) !== 'postgres')
        throw new ReportError(501, 'postgres_required');
}
function rows(sql, replacements) {
    return __awaiter(this, void 0, void 0, function* () {
        return sequelize().query(sql, { replacements, type: QueryTypes.SELECT });
    });
}
/** `?from=&to=` as calendar days; the last 30 days when not given. Two years at most. */
export function rangeOf(query) {
    const tz = state.config.timezone || 'UTC';
    const to = typeof (query === null || query === void 0 ? void 0 : query.to) === 'string' && DAY.test(query.to) ? query.to : todayIn(tz);
    let from = typeof (query === null || query === void 0 ? void 0 : query.from) === 'string' && DAY.test(query.from) ? query.from : shiftDay(to, -29);
    if (from > to)
        from = to;
    if (Date.parse(to) - Date.parse(from) > 731 * DAY_MS)
        from = shiftDay(to, -731);
    const days = Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
    return { from, to, days, tz };
}
const asNumber = (v) => (v == null ? null : Number(v));
/** A review's day, where the project lives. */
const REVIEW_DAY = `CAST(written_at AT TIME ZONE :tz AS date)`;
export function overview(query) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const config = state.config;
        const range = rangeOf(query);
        const before = { from: shiftDay(range.from, -range.days), to: shiftDay(range.from, -1) };
        const span = { from: range.from, to: range.to, pfrom: before.from, pto: before.to, tz: range.tz };
        const [totals, daily, countries, devices, ratings, ratingsBefore, sources, through, reviews, statuses] = yield Promise.all([
            rows(`SELECT store, CASE WHEN date >= CAST(:from AS date) THEN 'current' ELSE 'previous' END AS period,
                    ${SUMS.map((m) => `SUM(${m})::float AS ${m}`).join(', ')}, AVG(session_devices)::float AS session_devices
             FROM store_daily_stats
             WHERE country = '' AND date BETWEEN CAST(:pfrom AS date) AND CAST(:to AS date)
             GROUP BY 1, 2`, span),
            rows(`SELECT store, to_char(date, 'YYYY-MM-DD') AS date, ${METRICS.join(', ')}, active_devices,
                    rating_average AS rating, ratings_count AS ratings
             FROM store_daily_stats
             WHERE country = '' AND date BETWEEN CAST(:from AS date) AND CAST(:to AS date)
             ORDER BY date, store`, span),
            rows(`SELECT country, store, SUM(downloads)::int AS downloads
             FROM store_daily_stats
             WHERE country <> '' AND date BETWEEN CAST(:from AS date) AND CAST(:to AS date)
             GROUP BY 1, 2`, span),
            // A level, not a sum: the last day the period has one.
            rows(`SELECT DISTINCT ON (store) store, active_devices, to_char(date, 'YYYY-MM-DD') AS date
             FROM store_daily_stats
             WHERE country = '' AND active_devices IS NOT NULL AND date BETWEEN CAST(:from AS date) AND CAST(:to AS date)
             ORDER BY store, date DESC`, span),
            rows(`SELECT DISTINCT ON (store) store, rating_average AS rating, ratings_count AS ratings
             FROM store_daily_stats
             WHERE country = '' AND rating_average IS NOT NULL AND date <= CAST(:to AS date)
             ORDER BY store, date DESC`, span),
            rows(`SELECT DISTINCT ON (store) store, rating_average AS rating, ratings_count AS ratings
             FROM store_daily_stats
             WHERE country = '' AND rating_average IS NOT NULL AND date <= CAST(:pto AS date)
             ORDER BY store, date DESC`, span),
            rows(`SELECT store, source.key AS source, SUM(CAST(source.value AS numeric))::int AS count
             FROM store_daily_stats, json_each_text(sources) AS source
             WHERE country = '' AND sources IS NOT NULL AND date BETWEEN CAST(:from AS date) AND CAST(:to AS date)
             GROUP BY 1, 2`, span),
            // How far the store listing's report goes: it comes days after the downloads.
            rows(`SELECT store, to_char(MAX(date), 'YYYY-MM-DD') AS date
             FROM store_daily_stats
             WHERE country = '' AND page_views IS NOT NULL
             GROUP BY 1`, span),
            rows(`SELECT store, CASE WHEN ${REVIEW_DAY} >= CAST(:from AS date) THEN 'current' ELSE 'previous' END AS period,
                    rating, COUNT(*)::int AS count, COUNT(reply)::int AS replied
             FROM store_reviews
             WHERE ${REVIEW_DAY} BETWEEN CAST(:pfrom AS date) AND CAST(:to AS date)
             GROUP BY 1, 2, 3`, span),
            StoreStatus.findAll(),
        ]);
        const stores = storesOf(config).map((store) => {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const missing = missingKeys(config, store);
            const connected = missing.length === 0;
            const status = statuses.find((s) => s.store === store);
            const started = (status === null || status === void 0 ? void 0 : status.sync_started_at) ? new Date(status.sync_started_at).getTime() : 0;
            const totalsOf = (period) => {
                const row = totals.find((t) => t.store === store && t.period === period);
                return Object.fromEntries(METRICS.map((m) => {
                    if (!connected || !STORE_METRICS[store].includes(m))
                        return [m, null];
                    const value = asNumber(row === null || row === void 0 ? void 0 : row[m]);
                    return [m, value !== null && value !== void 0 ? value : (DOWNLOADS_REPORT[store].includes(m) ? 0 : null)];
                }));
            };
            const reviewsOf = (period) => {
                const of = reviews.filter((r) => r.store === store && r.period === period);
                const count = of.reduce((sum, r) => sum + r.count, 0);
                return {
                    count,
                    replied: of.reduce((sum, r) => sum + r.replied, 0),
                    average: count ? of.reduce((sum, r) => sum + r.rating * r.count, 0) / count : null,
                    // How many gave 1 star, 2, … 5.
                    stars: [1, 2, 3, 4, 5].map((stars) => { var _a, _b; return (_b = (_a = of.find((r) => r.rating === stars)) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 0; }),
                };
            };
            const rating = ratings.find((r) => r.store === store);
            const ratingBefore = ratingsBefore.find((r) => r.store === store);
            const device = devices.find((d) => d.store === store);
            const bySource = sources.filter((s) => s.store === store);
            return {
                store,
                label: STORE_LABELS[store],
                public_rating: readsPublicRating(config, store),
                connected,
                missing,
                metrics: STORE_METRICS[store],
                opt_in: STORE_OPT_IN[store],
                app: (_a = status === null || status === void 0 ? void 0 : status.app) !== null && _a !== void 0 ? _a : null,
                synced_at: (_b = status === null || status === void 0 ? void 0 : status.synced_at) !== null && _b !== void 0 ? _b : null,
                syncing: !!started && Date.now() - started < SYNC_TTL_MS,
                error: (_c = status === null || status === void 0 ? void 0 : status.error) !== null && _c !== void 0 ? _c : null,
                notice: (_d = status === null || status === void 0 ? void 0 : status.notice) !== null && _d !== void 0 ? _d : null,
                data_through: (_e = status === null || status === void 0 ? void 0 : status.data_through) !== null && _e !== void 0 ? _e : null,
                listing_through: (_g = (_f = through.find((t) => t.store === store)) === null || _f === void 0 ? void 0 : _f.date) !== null && _g !== void 0 ? _g : null,
                current: totalsOf('current'),
                previous: totalsOf('previous'),
                active_devices: asNumber(device === null || device === void 0 ? void 0 : device.active_devices),
                active_devices_on: (_h = device === null || device === void 0 ? void 0 : device.date) !== null && _h !== void 0 ? _h : null,
                rating: asNumber(rating === null || rating === void 0 ? void 0 : rating.rating),
                ratings_count: asNumber(rating === null || rating === void 0 ? void 0 : rating.ratings),
                previous_rating: asNumber(ratingBefore === null || ratingBefore === void 0 ? void 0 : ratingBefore.rating),
                previous_ratings_count: asNumber(ratingBefore === null || ratingBefore === void 0 ? void 0 : ratingBefore.ratings),
                sources: bySource.length ? Object.fromEntries(bySource.map((s) => [s.source, Number(s.count)])) : null,
                reviews: reviewsOf('current'),
                previous_reviews: reviewsOf('previous'),
            };
        });
        const byCountry = new Map();
        for (const row of countries) {
            const entry = (_a = byCountry.get(row.country)) !== null && _a !== void 0 ? _a : { country: row.country, apple: 0, google: 0, total: 0 };
            const n = Number((_b = row.downloads) !== null && _b !== void 0 ? _b : 0);
            if (row.store === 'apple' || row.store === 'google')
                entry[row.store] += n;
            entry.total += n;
            byCountry.set(row.country, entry);
        }
        const ranked = [...byCountry.values()].filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
        return {
            range,
            stores,
            daily: daily.map((d) => (Object.assign(Object.assign({ date: d.date, store: d.store }, Object.fromEntries(METRICS.map((m) => [m, asNumber(d[m])]))), { active_devices: asNumber(d.active_devices), rating: asNumber(d.rating), ratings: asNumber(d.ratings) }))),
            countries: ranked.slice(0, TOP_COUNTRIES),
            countries_total: ranked.length,
        };
    });
}
/** GET /admin/stores/reviews: the period's reviews, newest first, a page at a time; `store` and `stars` narrow them. */
export function reviewsOf(query) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const range = rangeOf(query);
        const where = [`${REVIEW_DAY} BETWEEN CAST(:from AS date) AND CAST(:to AS date)`];
        const replacements = { from: range.from, to: range.to, tz: range.tz };
        if (STORES.includes(query === null || query === void 0 ? void 0 : query.store)) {
            where.push('store = :store');
            replacements.store = query.store;
        }
        const stars = Number(query === null || query === void 0 ? void 0 : query.stars);
        if (Number.isInteger(stars) && stars >= 1 && stars <= 5) {
            where.push('rating = :stars');
            replacements.stars = stars;
        }
        if ((query === null || query === void 0 ? void 0 : query.replied) === 'yes' || (query === null || query === void 0 ? void 0 : query.replied) === 'no')
            where.push(query.replied === 'yes' ? 'reply IS NOT NULL' : 'reply IS NULL');
        const [counted] = yield rows(`SELECT COUNT(*)::int AS total FROM store_reviews WHERE ${where.join(' AND ')}`, replacements);
        const total = (_a = counted === null || counted === void 0 ? void 0 : counted.total) !== null && _a !== void 0 ? _a : 0;
        const pages = Math.max(Math.ceil(total / REVIEWS_PAGE), 1);
        const page = Math.min(Math.max(Math.floor(Number(query === null || query === void 0 ? void 0 : query.page)) || 1, 1), pages);
        const items = yield rows(`SELECT id, store, rating, title, body, author, territory, language, version, device, written_at, reply, replied_at, url
         FROM store_reviews
         WHERE ${where.join(' AND ')}
         ORDER BY written_at DESC, id DESC
         LIMIT ${REVIEWS_PAGE} OFFSET ${(page - 1) * REVIEWS_PAGE}`, replacements);
        return { items, total, page, pages };
    });
}
