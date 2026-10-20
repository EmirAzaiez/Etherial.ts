// ──────────────────────────────────────────────────────────────────────────
// Bringing the stores' numbers in, from their own reports — but for Apple's
// rating, which only its public page gives. Every sync reads the last week
// again (a day comes out late, or is revised) and, the first time or once
// `backfillDays` grew, the days before. Each part is read on its own: one
// failing leaves the others. Postgres only.
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
import { runExclusive } from '../../../components/database/lock.js';
import { StoreStatus } from '../models/StoreStatus.js';
import { appleApp, appleBearer, applePublicRating, appleReviews, appleSalesDay } from './apple.js';
import { appleAnalytics } from './appleAnalytics.js';
import { METRIC_COLUMNS, StoreError, errorMessage, shiftDay, todayIn } from './common.js';
import { googleApp, googleMonth } from './google.js';
import { backfillDays, missingKeys, readsPublicRating, storesOf, syncEveryMs } from './options.js';
import { state } from './state.js';
const LOCK = 'eth_store.sync';
/** Past this, a sync that never said it ended is taken for dead (its server stopped). */
export const SYNC_TTL_MS = 30 * 60 * 1000;
const RECENT_DAYS = 7;
/** Apple keeps its daily sales reports a year. */
const APPLE_DAYS = 365;
/** Reports asked of App Store Connect at once. */
const APPLE_PARALLEL = 4;
/** Reviews read again, back from the newest one kept: the author edits it, the developer replies. */
const REVIEWS_AGAIN_DAYS = 14;
function sequelize() {
    var _a;
    return (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize;
}
/** The first day kept: `backfill` days back from yesterday, `limit` at most. */
export function firstDay(backfill, limit = Infinity) {
    const last = shiftDay(new Date().toISOString().slice(0, 10), -1);
    return shiftDay(last, -(Math.min(backfill, limit) - 1));
}
/**
 * The days to ask for, oldest first: the last week (from the last day with a
 * report, if the server was off longer), and the days never asked for.
 */
export function daysToRead(status, backfill, limit) {
    const last = shiftDay(new Date().toISOString().slice(0, 10), -1);
    const first = firstDay(backfill, limit);
    let since = shiftDay(last, -(RECENT_DAYS - 1));
    if ((status === null || status === void 0 ? void 0 : status.data_through) && status.data_through < since)
        since = status.data_through;
    const days = [];
    for (let day = first; day <= last; day = shiftDay(day, 1)) {
        if (!(status === null || status === void 0 ? void 0 : status.backfilled_from) || day < status.backfilled_from || day >= since)
            days.push(day);
    }
    return days;
}
/** One store's day of downloads, as the report gives it: the countries no longer in it go. */
export function writeDay(store, day, rows) {
    return __awaiter(this, void 0, void 0, function* () {
        // Google's installs report also gives the uninstalls and the active devices; Apple's sales report does not.
        const columns = ['downloads', 'redownloads', 'updates', ...['uninstalls', 'active_devices'].filter((k) => rows.some((r) => k in r))];
        const db = sequelize();
        yield db.transaction((transaction) => __awaiter(this, void 0, void 0, function* () {
            yield db.query(`DELETE FROM store_daily_stats WHERE store = :store AND date = :day AND country <> ''`, { replacements: { store, day }, transaction });
            if (!rows.length)
                return;
            const replacements = { store, day };
            const values = rows.map((row, i) => {
                replacements[`c${i}`] = row.country;
                columns.forEach((column, j) => { var _a; return (replacements[`v${i}_${j}`] = (_a = row[column]) !== null && _a !== void 0 ? _a : null); });
                return `(:store, :day, :c${i}, ${columns.map((_, j) => `:v${i}_${j}`).join(', ')}, NOW(), NOW())`;
            });
            // The all-countries row keeps the other reports' figures: only these are this one's.
            yield db.query(`INSERT INTO store_daily_stats (store, date, country, ${columns.join(', ')}, created_at, updated_at)
             VALUES ${values.join(', ')}
             ON CONFLICT (store, date, country) DO UPDATE SET ${columns.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}, updated_at = NOW()`, { replacements, transaction });
        }));
    });
}
/** A day's figures from one report, on the all-countries row: those it gives replace theirs, the rest stay. */
export function writeMetrics(store, day, metrics) {
    return __awaiter(this, void 0, void 0, function* () {
        const columns = METRIC_COLUMNS.filter((k) => k in metrics);
        if (!columns.length)
            return;
        const replacements = { store, day };
        const values = columns.map((column) => {
            const value = metrics[column];
            if (column === 'sources') {
                replacements[column] = value == null ? null : JSON.stringify(value);
                return `CAST(:${column} AS json)`;
            }
            replacements[column] = value !== null && value !== void 0 ? value : null;
            return `:${column}`;
        });
        yield sequelize().query(`INSERT INTO store_daily_stats (store, date, country, ${columns.join(', ')}, created_at, updated_at)
         VALUES (:store, :day, '', ${values.join(', ')}, NOW(), NOW())
         ON CONFLICT (store, date, country) DO UPDATE SET ${columns.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}, updated_at = NOW()`, { replacements });
    });
}
const REVIEW_COLUMNS = [
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
];
/** The reviews as the store has them now: a new one is added, one read before takes its edits and its reply. */
export function upsertReviews(store, reviews) {
    return __awaiter(this, void 0, void 0, function* () {
        for (let start = 0; start < reviews.length; start += 200) {
            const chunk = reviews.slice(start, start + 200);
            const replacements = { store };
            const values = chunk.map((review, i) => {
                REVIEW_COLUMNS.forEach((column, j) => { var _a; return (replacements[`r${i}_${j}`] = (_a = review[column]) !== null && _a !== void 0 ? _a : null); });
                return `(:store, ${REVIEW_COLUMNS.map((_, j) => `:r${i}_${j}`).join(', ')}, NOW(), NOW())`;
            });
            const updated = REVIEW_COLUMNS.filter((c) => c !== 'review_id');
            yield sequelize().query(`INSERT INTO store_reviews (store, ${REVIEW_COLUMNS.join(', ')}, created_at, updated_at)
             VALUES ${values.join(', ')}
             ON CONFLICT (store, review_id) DO UPDATE SET ${updated.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}, updated_at = NOW()`, { replacements });
        }
    });
}
function newestReview(store) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const [rows] = yield sequelize().query(`SELECT MAX(written_at) AS at FROM store_reviews WHERE store = :store`, { replacements: { store } });
        return ((_a = rows[0]) === null || _a === void 0 ? void 0 : _a.at) ? new Date(rows[0].at) : null;
    });
}
/** `fn` on every item, `limit` at a time; the first error stops what has not started and is thrown. */
function eachLimit(items, limit, fn) {
    return __awaiter(this, void 0, void 0, function* () {
        let next = 0;
        let failed = null;
        const worker = () => __awaiter(this, void 0, void 0, function* () {
            while (!failed && next < items.length) {
                const item = items[next++];
                try {
                    yield fn(item);
                }
                catch (err) {
                    failed !== null && failed !== void 0 ? failed : (failed = err);
                }
            }
        });
        yield Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
        if (failed)
            throw failed;
    });
}
const earliest = (a, b) => (!a ? b !== null && b !== void 0 ? b : null : !b ? a : a < b ? a : b);
const latest = (a, b) => (!a || b > a ? b : a);
/** Runs one part of a sync: what goes wrong is told, and the next part runs. */
function part(errors, fn) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return yield fn();
        }
        catch (err) {
            errors.push(errorMessage(err));
            return undefined;
        }
    });
}
function resultOf(status) {
    var _a;
    return {
        app: status.app,
        error: null,
        notice: null,
        data_through: status.data_through,
        backfilled_from: status.backfilled_from,
        // Copied: changed as the reports are read, saved with the rest.
        cursor: JSON.parse(JSON.stringify((_a = status.cursor) !== null && _a !== void 0 ? _a : {})),
    };
}
function close(result, errors, notices) {
    result.error = errors.length ? [...new Set(errors)].join(' · ') : null;
    result.notice = notices.length ? [...new Set(notices)].join(' · ') : null;
    return result;
}
function syncApple(config, status) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const c = config.apple;
        const errors = [];
        const notices = [];
        const result = resultOf(status);
        if (readsPublicRating(config, 'apple')) {
            yield part(errors, () => __awaiter(this, void 0, void 0, function* () {
                const rating = yield applePublicRating(c);
                if (!rating)
                    throw new StoreError(`${c.appId || c.bundleId} is not on the App Store in the storefronts listed`);
                yield writeMetrics('apple', todayIn(config.timezone || 'UTC'), { rating_average: rating.rating, ratings_count: rating.ratings_count });
            }));
        }
        if (missingKeys(config, 'apple').length)
            return close(result, errors, notices);
        const bearer = yield part(errors, () => __awaiter(this, void 0, void 0, function* () { return appleBearer(c); }));
        if (!bearer)
            return close(result, errors, notices);
        const app = yield part(errors, () => appleApp(c, bearer));
        if (app)
            result.app = app;
        const appId = c.appId || ((_a = result.app) === null || _a === void 0 ? void 0 : _a.id);
        if (!appId) {
            errors.push('The app\'s App Store id is unknown: set apple.appId, or check apple.bundleId');
            return close(result, errors, notices);
        }
        const days = daysToRead(status, backfillDays(config), APPLE_DAYS);
        yield part(errors, () => __awaiter(this, void 0, void 0, function* () {
            yield eachLimit(days, APPLE_PARALLEL, (day) => __awaiter(this, void 0, void 0, function* () {
                const rows = yield appleSalesDay(c, appId, day, bearer());
                if (!rows)
                    return;
                yield writeDay('apple', day, rows);
                result.data_through = latest(result.data_through, day);
            }));
            result.backfilled_from = earliest(status.backfilled_from, days[0]);
        }));
        yield part(errors, () => __awaiter(this, void 0, void 0, function* () {
            const newest = yield newestReview('apple');
            const since = newest ? new Date(newest.getTime() - REVIEWS_AGAIN_DAYS * 24 * 3600 * 1000) : null;
            yield upsertReviews('apple', yield appleReviews(appId, bearer, since));
        }));
        yield part(errors, () => __awaiter(this, void 0, void 0, function* () {
            const notice = yield appleAnalytics({
                appId,
                bearer,
                cursor: result.cursor,
                since: firstDay(backfillDays(config)),
                write: (day, metrics) => writeMetrics('apple', day, metrics),
            });
            if (notice)
                notices.push(notice);
        }));
        return close(result, errors, notices);
    });
}
function syncGoogle(config, status) {
    return __awaiter(this, void 0, void 0, function* () {
        const c = config.google;
        const errors = [];
        const notices = [];
        const result = resultOf(status);
        // Not needed for the figures: told, not an error.
        const app = yield part(notices, () => googleApp(c));
        if (app)
            result.app = app;
        const days = daysToRead(status, backfillDays(config), Infinity);
        const first = days[0];
        // One file per month and per report, the whole month in it.
        const months = [...new Set(days.map((d) => d.slice(0, 7).replace('-', '')))];
        let read = true;
        for (const month of months) {
            const files = yield part(errors, () => googleMonth(c, month));
            if (!files) {
                read = false;
                continue;
            }
            yield part(errors, () => __awaiter(this, void 0, void 0, function* () {
                var _a;
                // A month's file has every day of it: those before the first one kept stay out.
                for (const [day, rows] of (_a = files.installs) !== null && _a !== void 0 ? _a : []) {
                    if (day < first)
                        continue;
                    yield writeDay('google', day, rows);
                    result.data_through = latest(result.data_through, day);
                }
                const byDay = new Map();
                for (const report of [files.ratings, files.crashes, files.listing, files.sources]) {
                    for (const [day, metrics] of report !== null && report !== void 0 ? report : [])
                        byDay.set(day, Object.assign(Object.assign({}, byDay.get(day)), metrics));
                }
                for (const [day, metrics] of byDay)
                    if (day >= first)
                        yield writeMetrics('google', day, metrics);
                if (files.reviews)
                    yield upsertReviews('google', files.reviews);
            }));
        }
        if (read)
            result.backfilled_from = earliest(status.backfilled_from, first);
        return close(result, errors, notices);
    });
}
/** Whether a sync has anything to read for the store: its keys, or Apple's public rating. */
export function readsSomething(config, store) {
    return readsPublicRating(config, store) || !missingKeys(config, store).length;
}
/**
 * Syncs the stores due — their last sync older than `syncEveryHours` — or
 * all of them with `force`. One server at a time: false when another one is
 * already at it.
 */
export function syncStores() {
    return __awaiter(this, arguments, void 0, function* ({ force = false, only } = {}) {
        const config = state.config;
        const ran = yield runExclusive(LOCK, { ttlMs: SYNC_TTL_MS }, () => __awaiter(this, void 0, void 0, function* () {
            for (const store of storesOf(config)) {
                if (only && store !== only)
                    continue;
                if (!readsSomething(config, store))
                    continue;
                const [status] = yield StoreStatus.findOrCreate({ where: { store }, defaults: { store } });
                if (!force && status.synced_at && Date.now() - new Date(status.synced_at).getTime() < syncEveryMs(config))
                    continue;
                yield status.update({ sync_started_at: new Date() });
                try {
                    const result = store === 'apple' ? yield syncApple(config, status) : yield syncGoogle(config, status);
                    yield status.update(Object.assign(Object.assign({}, result), { synced_at: new Date(), sync_started_at: null }));
                }
                catch (err) {
                    yield status.update({ error: errorMessage(err), synced_at: new Date(), sync_started_at: null });
                }
                if (status.error)
                    console.warn(`[ETHStoreLeaf] ${store}: ${status.error}`);
            }
            return true;
        }));
        return ran === true;
    });
}
