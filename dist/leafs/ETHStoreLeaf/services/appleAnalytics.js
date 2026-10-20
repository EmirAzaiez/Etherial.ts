// ──────────────────────────────────────────────────────────────────────────
// App Store Connect's analytics reports. They are asked for once, with an
// Admin key, and Apple then writes them every day: the leaf asks for the
// daily ones (ONGOING) and for the history (ONE_TIME_SNAPSHOT). A report
// comes in instances, one per day Apple processed it, each in gzipped TSV
// segments; a later instance replaces what an earlier one said of the same
// day. Read are the Standard reports: the Detailed ones add noise and leave
// out the small counts.
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
import { API, appleList, appleRefusal } from './apple.js';
import { StoreError, addTo, cell, dayOf, gunzipped, parseTable, request, shiftDay } from './common.js';
/** The report of each kind, by its name: Apple has not always named them the same. */
const REPORT_NAMES = {
    engagement: (n) => n.includes('discovery and engagement'),
    downloads: (n) => n.startsWith('app store downloads') || n.startsWith('app downloads'),
    installs: (n) => n.includes('install') && n.includes('delet'),
    sessions: (n) => n.startsWith('app sessions'),
    crashes: (n) => n.startsWith('app crashes'),
};
export const REPORT_KINDS = Object.keys(REPORT_NAMES);
/** Instances read in one sync, per report: the history comes over several, under Apple's hourly limit. */
const INSTANCES_PER_SYNC = 120;
/** The pages someone can download the app from: what the funnel counts. */
const DOWNLOAD_PAGES = /^(product page|store sheet|in-app event)$/i;
/** The kind of a report from its name, or null. Standard first, then the plain one; never the Detailed. */
export function reportKind(name) {
    const n = name.trim().toLowerCase();
    const kind = REPORT_KINDS.find((k) => REPORT_NAMES[k](n));
    if (!kind || n.includes('detailed'))
        return null;
    return { kind, rank: n.includes('standard') ? 0 : n.includes('expanded') ? 2 : 1 };
}
export function appleSource(type) {
    const t = (type !== null && type !== void 0 ? type : '').trim().toLowerCase();
    if (t.includes('search'))
        return 'search';
    if (t.includes('browse'))
        return 'browse';
    if (t.startsWith('app referr'))
        return 'app';
    if (t.startsWith('web referr'))
        return 'web';
    return 'other';
}
function blankOf(kind) {
    if (kind === 'engagement')
        return { impressions: 0, page_views: 0 };
    if (kind === 'downloads')
        return { acquisitions: 0, sources: {} };
    if (kind === 'installs')
        return { uninstalls: 0 };
    if (kind === 'sessions')
        return { sessions: 0, session_seconds: 0, session_devices: 0 };
    return { crashes: 0 };
}
function addRow(kind, day, row) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const counts = (_a = cell(row, 'Counts')) !== null && _a !== void 0 ? _a : 0;
    const page = ((_b = row['Page Type']) !== null && _b !== void 0 ? _b : '').trim();
    if (kind === 'engagement') {
        const event = ((_c = row['Event']) !== null && _c !== void 0 ? _c : '').trim().toLowerCase();
        if (event === 'impression')
            day.impressions += counts;
        else if (event === 'page view' && DOWNLOAD_PAGES.test(page))
            day.page_views += counts;
    }
    else if (kind === 'downloads') {
        if (!/^first/i.test(((_d = row['Download Type']) !== null && _d !== void 0 ? _d : '').trim()))
            return;
        addTo(day.sources, appleSource(row['Source Type']), counts);
        if (DOWNLOAD_PAGES.test(page))
            day.acquisitions += counts;
    }
    else if (kind === 'installs') {
        if (/^delet/i.test(((_e = row['Event']) !== null && _e !== void 0 ? _e : '').trim()))
            day.uninstalls += counts;
    }
    else if (kind === 'sessions') {
        day.sessions += (_f = cell(row, 'Sessions')) !== null && _f !== void 0 ? _f : 0;
        day.session_seconds += (_g = cell(row, 'Total Session Duration')) !== null && _g !== void 0 ? _g : 0;
        // One row per device type, version, country…: their devices add up.
        day.session_devices += (_h = cell(row, 'Unique Devices')) !== null && _h !== void 0 ? _h : 0;
    }
    else {
        day.crashes += (_j = cell(row, 'Crashes')) !== null && _j !== void 0 ? _j : 0;
    }
}
/** A report's rows, day by day, kept to the app. */
export function analyticsDays(kind, rows, appId) {
    var _a;
    const days = new Map();
    for (const row of rows) {
        const id = ((_a = row['App Apple Identifier']) !== null && _a !== void 0 ? _a : '').trim();
        if (id && id !== appId)
            continue;
        const date = dayOf(row['Date']);
        if (!date)
            continue;
        let day = days.get(date);
        if (!day)
            days.set(date, (day = blankOf(kind)));
        addRow(kind, day, row);
    }
    return days;
}
function askReports(appId, accessType, bearer) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const res = yield request(`${API}/analyticsReportRequests`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${bearer()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: { type: 'analyticsReportRequests', attributes: { accessType }, relationships: { app: { data: { type: 'apps', id: appId } } } },
            }),
        });
        // Already asked: the list has it.
        if (res.status === 409)
            return null;
        if (!res.ok)
            throw yield appleRefusal(res, 'the analytics reports');
        const body = yield res.json();
        return (_b = (_a = body === null || body === void 0 ? void 0 : body.data) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null;
    });
}
/**
 * The two requests the leaf reads, asked for when missing. Apple stops a
 * daily request nobody reads for a while: it is asked for again.
 */
function requestsOf(appId, bearer) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const { data } = yield appleList(`/apps/${encodeURIComponent(appId)}/analyticsReportRequests?limit=200`, bearer, 'the analytics reports', 5);
        let asked = false;
        let ongoing = (_b = (_a = data.find((r) => { var _a, _b; return ((_a = r.attributes) === null || _a === void 0 ? void 0 : _a.accessType) === 'ONGOING' && !((_b = r.attributes) === null || _b === void 0 ? void 0 : _b.stoppedDueToInactivity); })) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null;
        if (!ongoing) {
            for (const stopped of data.filter((r) => { var _a; return ((_a = r.attributes) === null || _a === void 0 ? void 0 : _a.accessType) === 'ONGOING'; })) {
                const res = yield request(`${API}/analyticsReportRequests/${stopped.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${bearer()}` } });
                if (!res.ok && res.status !== 404)
                    throw yield appleRefusal(res, 'the analytics reports');
            }
            ongoing = yield askReports(appId, 'ONGOING', bearer);
            asked = true;
        }
        let snapshot = (_d = (_c = data.find((r) => { var _a; return ((_a = r.attributes) === null || _a === void 0 ? void 0 : _a.accessType) === 'ONE_TIME_SNAPSHOT'; })) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : null;
        if (!snapshot) {
            snapshot = yield askReports(appId, 'ONE_TIME_SNAPSHOT', bearer);
            asked = true;
        }
        return { ongoing, snapshot, asked };
    });
}
/** A request's reports, the best one of each kind. */
function reportsOf(requestId, bearer) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const { data } = yield appleList(`/analyticsReportRequests/${requestId}/reports?limit=200`, bearer, 'the analytics reports', 5);
        const best = new Map();
        for (const report of data) {
            const found = reportKind((_b = (_a = report.attributes) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : '');
            if (!found)
                continue;
            const kept = best.get(found.kind);
            if (!kept || found.rank < kept.rank)
                best.set(found.kind, { id: report.id, rank: found.rank });
        }
        return new Map([...best].map(([kind, { id }]) => [kind, id]));
    });
}
/** Every row of an instance, its segments together. */
function instanceRows(instanceId, bearer) {
    return __awaiter(this, void 0, void 0, function* () {
        const { data } = yield appleList(`/analyticsReportInstances/${instanceId}/segments?limit=200`, bearer, 'the analytics reports', 5);
        const files = yield Promise.all(data.map((segment) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Signed for a while: no key.
            const res = yield request((_a = segment.attributes) === null || _a === void 0 ? void 0 : _a.url, {}, 120 * 1000);
            if (!res.ok)
                throw new StoreError(`Apple's analytics file could not be downloaded (${res.status})`);
            return parseTable(gunzipped(Buffer.from(yield res.arrayBuffer())).toString('utf8'), '\t');
        })));
        return files.flat();
    });
}
/**
 * Reads the instances not read yet, the history first: its days only up to
 * the first one the daily request gave. Returns what the admins should know
 * (reports still being prepared, history still coming), or null.
 */
export function appleAnalytics(run) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        const { appId, bearer, cursor, since } = run;
        const requests = yield requestsOf(appId, bearer);
        cursor.ongoing = (_a = requests.ongoing) !== null && _a !== void 0 ? _a : undefined;
        cursor.snapshot = (_b = requests.snapshot) !== null && _b !== void 0 ? _b : undefined;
        (_c = cursor.read) !== null && _c !== void 0 ? _c : (cursor.read = {});
        (_d = cursor.covered) !== null && _d !== void 0 ? _d : (cursor.covered = {});
        // Read further back than before: the history again, for the days it skipped.
        if (cursor.since && since < cursor.since) {
            for (const key of Object.keys(cursor.read))
                if (key.startsWith('snapshot:'))
                    delete cursor.read[key];
        }
        cursor.since = since;
        let found = 0;
        let more = false;
        for (const [which, requestId] of [['snapshot', requests.snapshot], ['ongoing', requests.ongoing]]) {
            if (!requestId)
                continue;
            const reports = yield reportsOf(requestId, bearer);
            for (const [kind, reportId] of reports) {
                const key = `${which}:${kind}`;
                const { data } = yield appleList(`/analyticsReports/${reportId}/instances?filter[granularity]=DAILY&limit=200`, bearer, 'the analytics reports', 10);
                found += data.length;
                // Instances processed long before the first day kept say nothing of it.
                const oldest = shiftDay(since, -7);
                const byDate = new Map();
                for (const instance of data) {
                    const date = (_e = instance.attributes) === null || _e === void 0 ? void 0 : _e.processingDate;
                    if (!date || date < oldest || (cursor.read[key] && date <= cursor.read[key]))
                        continue;
                    byDate.set(date, [...((_f = byDate.get(date)) !== null && _f !== void 0 ? _f : []), instance.id]);
                }
                let budget = INSTANCES_PER_SYNC;
                for (const date of [...byDate.keys()].sort()) {
                    if (budget <= 0) {
                        more = true;
                        break;
                    }
                    const ids = byDate.get(date);
                    budget -= ids.length;
                    const rows = (yield Promise.all(ids.map((id) => instanceRows(id, bearer)))).flat();
                    for (const [day, metrics] of [...analyticsDays(kind, rows, appId)].sort(([a], [b]) => (a < b ? -1 : 1))) {
                        if (day < since)
                            continue;
                        if (which === 'snapshot') {
                            if (cursor.covered[kind] && day >= cursor.covered[kind])
                                continue;
                        }
                        else if (!cursor.covered[kind] || day < cursor.covered[kind]) {
                            cursor.covered[kind] = day;
                        }
                        yield run.write(day, metrics);
                    }
                    cursor.read[key] = date;
                }
            }
        }
        if (requests.asked && !found)
            return 'Apple was asked for its analytics reports: the first ones come in a day or two.';
        if (!found)
            return 'Apple is preparing its analytics reports: the first ones come a day or two after they were asked for.';
        if (more)
            return 'Apple\'s history is still being read: the next syncs go on.';
        return null;
    });
}
