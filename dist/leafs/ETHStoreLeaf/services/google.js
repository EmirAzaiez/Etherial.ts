// ──────────────────────────────────────────────────────────────────────────
// Google Play, with a service account invited in Play Console: the reports
// Play Console writes every day to the developer's Cloud Storage bucket —
// one CSV per month and per report (installs, ratings, crashes, store
// listing, reviews) — and the app's name and version from the Play
// Developer Reporting API, when it is turned on.
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
import jwt from 'jsonwebtoken';
import { StoreError, addTo, cell, dayOf, numberOf, parseTable, request, textOf } from './common.js';
import { pem } from './options.js';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const SCOPES = ['https://www.googleapis.com/auth/devstorage.read_only', 'https://www.googleapis.com/auth/playdeveloperreporting'].join(' ');
const REPORTING = 'https://playdeveloperreporting.googleapis.com/v1beta1';
/** Access tokens by account (a service account's email, a person's refresh token), until they expire. */
const cached = new Map();
/** A credential from the config: the object, its JSON, or that JSON in base64. */
function jsonOf(value, notJson) {
    if (typeof value !== 'string')
        return value;
    const text = value.trim();
    try {
        return JSON.parse(text.startsWith('{') ? text : Buffer.from(text, 'base64').toString('utf8'));
    }
    catch (_a) {
        throw new StoreError(notJson);
    }
}
export function serviceAccountOf(c) {
    const account = jsonOf(c.serviceAccount, 'The Google service account is not a JSON key (the file downloaded from Google Cloud)');
    if (!(account === null || account === void 0 ? void 0 : account.client_email) || !(account === null || account === void 0 ? void 0 : account.private_key))
        throw new StoreError('The Google service account has no client_email or private_key');
    return account;
}
export function reportsAccountOf(c) {
    const account = jsonOf(c.reportsAccount, 'The Google account for the reports is not JSON (the file gcloud auth application-default login writes)');
    if (!(account === null || account === void 0 ? void 0 : account.client_id) || !(account === null || account === void 0 ? void 0 : account.client_secret) || !(account === null || account === void 0 ? void 0 : account.refresh_token)) {
        throw new StoreError('The Google account for the reports has no client_id, client_secret or refresh_token');
    }
    return account;
}
function keep(key, body) {
    cached.set(key, { token: body.access_token, until: Date.now() + (Number(body.expires_in) || 3600) * 1000 - 60 * 1000 });
    return body.access_token;
}
function fresh(key) {
    const hit = cached.get(key);
    return hit && hit.until > Date.now() ? hit.token : null;
}
/** A token for the person's account, from its refresh token. */
function userToken(account) {
    return __awaiter(this, void 0, void 0, function* () {
        const hit = fresh(account.refresh_token);
        if (hit)
            return hit;
        const res = yield request(TOKEN_URI, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: account.client_id,
                client_secret: account.client_secret,
                refresh_token: account.refresh_token,
            }),
        });
        const body = yield res.json().catch(() => ({}));
        if (!res.ok || !body.access_token) {
            throw new StoreError(`Google refused the account for the reports (${res.status}): ${body.error_description || body.error || 'no token'}. Sign it in again with gcloud auth application-default login`);
        }
        return keep(account.refresh_token, body);
    });
}
function googleToken(account) {
    return __awaiter(this, void 0, void 0, function* () {
        const hit = fresh(account.client_email);
        if (hit)
            return hit;
        const now = Math.floor(Date.now() / 1000);
        let assertion;
        try {
            assertion = jwt.sign({ iss: account.client_email, scope: SCOPES, aud: TOKEN_URI, iat: now, exp: now + 3600 }, pem(account.private_key), {
                algorithm: 'RS256',
            });
        }
        catch (err) {
            throw new StoreError(`The Google service account's key could not sign: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
        }
        const res = yield request(account.token_uri || TOKEN_URI, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
        });
        const body = yield res.json().catch(() => ({}));
        if (!res.ok || !body.access_token) {
            throw new StoreError(`Google refused the service account (${res.status}): ${body.error_description || body.error || 'no token'}`);
        }
        return keep(account.client_email, body);
    });
}
/** `gs://pubsite_prod_rev_0123/stats` → `pubsite_prod_rev_0123`. */
export function bucketOf(c) {
    var _a;
    return ((_a = c.bucket) !== null && _a !== void 0 ? _a : '').trim().replace(/^gs:\/\//, '').split('/')[0];
}
/** Play Console writes its reports in UTF-16 with a byte-order mark; older ones in UTF-8. */
export function decode(buffer) {
    if (buffer[0] === 0xff && buffer[1] === 0xfe)
        return buffer.subarray(2).toString('utf16le');
    if (buffer[0] === 0xfe && buffer[1] === 0xff) {
        const swapped = Buffer.from(buffer.subarray(2, buffer.length - (buffer.length % 2)));
        return swapped.swap16().toString('utf16le');
    }
    return buffer.toString('utf8').replace(/^﻿/, '');
}
/** One file of the bucket, or null when it is not there: a month not started yet. */
function readObject(c, name) {
    return __awaiter(this, void 0, void 0, function* () {
        const token = c.reportsAccount ? yield userToken(reportsAccountOf(c)) : yield googleToken(serviceAccountOf(c));
        const bucket = bucketOf(c);
        const res = yield request(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(name)}?alt=media`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 404)
            return null;
        if (res.status === 401 || res.status === 403) {
            const who = c.reportsAccount ? 'The account for the reports' : 'The service account';
            throw new StoreError(`${who} may not read ${bucket}: invite it in Play Console › Users and permissions with "View app information and download bulk reports" (it can take a day to apply)`);
        }
        if (!res.ok)
            throw new StoreError(`Google Cloud Storage answered ${res.status} for ${name}`);
        return decode(Buffer.from(yield res.arrayBuffer()));
    });
}
/**
 * A row of the installs report as the leaf counts it. Downloads are the
 * people installing it for the first time; re-downloads the other installs
 * (again, or on one more device); uninstalls the people who removed it
 * from all their devices.
 */
export function installsRow(row, country) {
    var _a;
    const users = (_a = cell(row, 'Daily User Installs')) !== null && _a !== void 0 ? _a : 0;
    const installs = cell(row, 'Daily Device Installs', 'Install events');
    return {
        country,
        downloads: users,
        redownloads: installs == null ? null : Math.max(installs - users, 0),
        updates: cell(row, 'Daily Device Upgrades', 'Update events'),
        uninstalls: cell(row, 'Daily User Uninstalls', 'Daily Device Uninstalls'),
        active_devices: cell(row, 'Installs on active devices', 'Active Device Installs'),
    };
}
/** The days of the two installs files of a month, every country together first. */
export function parseInstalls(overview, byCountry) {
    var _a;
    const days = new Map();
    const add = (row, country) => {
        const day = dayOf(row['Date']);
        if (!day)
            return;
        if (!days.has(day))
            days.set(day, []);
        days.get(day).push(installsRow(row, country));
    };
    for (const row of parseTable(overview))
        add(row, '');
    for (const row of parseTable(byCountry !== null && byCountry !== void 0 ? byCountry : '')) {
        const country = ((_a = row['Country']) !== null && _a !== void 0 ? _a : '').trim().toUpperCase();
        if (/^[A-Z]{2}$/.test(country))
            add(row, country);
    }
    return days;
}
/** The figures of a month's file, day by day: `pick` reads a row; the rows of one day add up. */
function byDay(csv, pick, blank) {
    const days = new Map();
    for (const row of parseTable(csv)) {
        const date = dayOf(row['Date']);
        if (!date)
            continue;
        let day = days.get(date);
        if (!day)
            days.set(date, (day = blank()));
        pick(row, day);
    }
    return days;
}
/** The ratings file: the average of every rating given up to that day. `NA` on a day nobody had rated yet. */
export function parseRatings(csv) {
    return byDay(csv, (row, day) => {
        day.rating_average = numberOf(row['Total Average Rating']);
    }, () => ({ rating_average: null }));
}
export function parseCrashes(csv) {
    return byDay(csv, (row, day) => {
        var _a, _b, _c, _d;
        day.crashes = ((_a = day.crashes) !== null && _a !== void 0 ? _a : 0) + ((_b = cell(row, 'Daily Crashes')) !== null && _b !== void 0 ? _b : 0);
        day.anrs = ((_c = day.anrs) !== null && _c !== void 0 ? _c : 0) + ((_d = cell(row, 'Daily ANRs')) !== null && _d !== void 0 ? _d : 0);
    }, () => ({ crashes: 0, anrs: 0 }));
}
/** The store listing by country: its visitors and the first installs from it, every country together. */
export function parseListing(csv) {
    return byDay(csv, (row, day) => {
        var _a, _b;
        day.page_views += (_a = cell(row, 'Store listing visitors')) !== null && _a !== void 0 ? _a : 0;
        day.acquisitions += (_b = cell(row, 'Store listing acquisitions')) !== null && _b !== void 0 ? _b : 0;
    }, () => ({ page_views: 0, acquisitions: 0 }));
}
export function googleSource(type) {
    const t = (type !== null && type !== void 0 ? type : '').trim().toLowerCase();
    if (t.includes('search'))
        return 'search';
    if (t.includes('explore') || t.includes('browse'))
        return 'browse';
    if (/\bads?\b/.test(t))
        return 'ads';
    if (t.includes('referr') || t.includes('third'))
        return 'referral';
    return 'other';
}
/** The store listing by traffic source: the first installs, by where they came from. */
export function parseSources(csv) {
    return byDay(csv, (row, day) => {
        var _a;
        addTo(day.sources, googleSource(row['Traffic source']), (_a = cell(row, 'Store listing acquisitions')) !== null && _a !== void 0 ? _a : 0);
    }, () => ({ sources: {} }));
}
function unescaped(id) {
    try {
        return decodeURIComponent(id);
    }
    catch (_a) {
        return id;
    }
}
const millis = (value) => {
    const n = numberOf(value);
    return n == null || n <= 0 ? null : new Date(n);
};
/** A month's reviews: those with words only (a star alone is a rating), the last version of each. */
export function parseReviews(csv) {
    var _a, _b, _c, _d, _e, _f, _g;
    const reviews = new Map();
    for (const row of parseTable(csv)) {
        const title = textOf(row['Review Title']);
        const body = textOf(row['Review Text']);
        const rating = numberOf(row['Star Rating']);
        const written = (_a = millis(row['Review Submit Millis Since Epoch'])) !== null && _a !== void 0 ? _a : (row['Review Submit Date and Time'] ? new Date(row['Review Submit Date and Time']) : null);
        if ((!title && !body) || !rating || rating < 1 || rating > 5 || !written || Number.isNaN(written.getTime()))
            continue;
        const link = textOf(row['Review Link']);
        const language = textOf(row['Reviewer Language']);
        const device = textOf(row['Device']);
        const id = (_c = (_b = link === null || link === void 0 ? void 0 : link.match(/reviewid=([^&#\s]+)/i)) === null || _b === void 0 ? void 0 : _b[1]) !== null && _c !== void 0 ? _c : `${written.getTime()}:${device !== null && device !== void 0 ? device : ''}:${language !== null && language !== void 0 ? language : ''}`;
        const updated = (_e = (_d = millis(row['Review Last Update Millis Since Epoch'])) === null || _d === void 0 ? void 0 : _d.getTime()) !== null && _e !== void 0 ? _e : written.getTime();
        if (((_g = (_f = reviews.get(id)) === null || _f === void 0 ? void 0 : _f.updated) !== null && _g !== void 0 ? _g : -1) > updated)
            continue;
        const reply = textOf(row['Developer Reply Text']);
        reviews.set(id, {
            updated,
            row: {
                review_id: unescaped(id),
                rating: Math.round(rating),
                title,
                body,
                author: null,
                territory: null,
                language,
                version: textOf(row['App Version Name']),
                device,
                written_at: written,
                reply,
                replied_at: reply ? millis(row['Developer Reply Millis Since Epoch']) : null,
                url: link,
            },
        });
    }
    return [...reviews.values()].map((r) => r.row);
}
export function googleMonth(c, month) {
    return __awaiter(this, void 0, void 0, function* () {
        const pkg = c.packageName;
        const read = (name) => readObject(c, name);
        const [installs, installsByCountry, ratings, crashes, listing, sources, reviews] = yield Promise.all([
            read(`stats/installs/installs_${pkg}_${month}_overview.csv`),
            read(`stats/installs/installs_${pkg}_${month}_country.csv`),
            read(`stats/ratings/ratings_${pkg}_${month}_overview.csv`),
            read(`stats/crashes/crashes_${pkg}_${month}_overview.csv`),
            read(`stats/store_performance/store_performance_${pkg}_${month}_country.csv`),
            read(`stats/store_performance/store_performance_${pkg}_${month}_traffic_source.csv`),
            read(`reviews/reviews_${pkg}_${month}.csv`),
        ]);
        return {
            installs: installs == null ? null : parseInstalls(installs, installsByCountry),
            ratings: ratings == null ? null : parseRatings(ratings),
            crashes: crashes == null ? null : parseCrashes(crashes),
            listing: listing == null ? null : parseListing(listing),
            sources: sources == null ? null : parseSources(sources),
            reviews: reviews == null ? null : parseReviews(reviews),
        };
    });
}
function reportingGet(c, path) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const token = yield googleToken(serviceAccountOf(c));
        const res = yield request(`${REPORTING}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
        const body = yield res.json().catch(() => null);
        if (!res.ok) {
            const message = ((_a = body === null || body === void 0 ? void 0 : body.error) === null || _a === void 0 ? void 0 : _a.message) || res.statusText;
            if (res.status === 403 && /has not been used|is disabled/i.test(message)) {
                throw new StoreError('The app\'s name and version need the Google Play Developer Reporting API, turned on in the service account\'s Google Cloud project');
            }
            throw new StoreError(`The Play Developer Reporting API answered ${res.status}: ${message}`);
        }
        return body;
    });
}
/** The app's name (as set in Play Console) and the release now on the production track. */
export function googleApp(c) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        const pkg = c.packageName;
        let name = null;
        let pageToken = '';
        for (let page = 0; page < 10; page++) {
            const body = yield reportingGet(c, `apps:search?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`);
            const app = ((_a = body === null || body === void 0 ? void 0 : body.apps) !== null && _a !== void 0 ? _a : []).find((a) => a.packageName === pkg);
            if (app) {
                name = (_b = app.displayName) !== null && _b !== void 0 ? _b : null;
                break;
            }
            if (!(pageToken = body === null || body === void 0 ? void 0 : body.nextPageToken))
                break;
        }
        if (name == null)
            throw new StoreError(`The service account does not see ${pkg} in Play Console`);
        const options = yield reportingGet(c, `apps/${encodeURIComponent(pkg)}:fetchReleaseFilterOptions`);
        const production = ((_c = options === null || options === void 0 ? void 0 : options.tracks) !== null && _c !== void 0 ? _c : []).find((t) => /production/i.test(`${t.type} ${t.displayName}`));
        return {
            id: pkg,
            name,
            icon: null,
            url: `https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg)}`,
            version: (_f = (_e = (_d = production === null || production === void 0 ? void 0 : production.servingReleases) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.displayName) !== null && _f !== void 0 ? _f : null,
        };
    });
}
