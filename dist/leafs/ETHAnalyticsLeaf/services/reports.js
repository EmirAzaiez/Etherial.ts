// ──────────────────────────────────────────────────────────────────────────
// The numbers the back-office shows, straight from the two tables.
//
// Postgres only: visits and paths lean on window functions, percentiles and
// time zones. Calendar days are cut in the configured time zone, and every
// date bound stays on the indexed column so a year of events reads quickly.
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
import { state } from './state.js';
import { usersOptions } from './options.js';
const EVENTS = 'analytics_events';
const SESSIONS = 'analytics_sessions';
const DAY_MS = 24 * 3600 * 1000;
/** Separates the steps of a path inside one SQL string. */
const SEP = '\u001f';
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
    const dialect = (_b = (_a = sequelize()) === null || _a === void 0 ? void 0 : _a.getDialect) === null || _b === void 0 ? void 0 : _b.call(_a);
    if (dialect !== 'postgres')
        throw new ReportError(501, 'postgres_required');
}
function rows(sql, replacements) {
    return __awaiter(this, void 0, void 0, function* () {
        return sequelize().query(sql, { replacements, type: QueryTypes.SELECT });
    });
}
export function timezone() {
    return state.config.timezone || 'UTC';
}
/** Today's date where the project lives, `YYYY-MM-DD`. */
function today(tz) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function shift(day, by) {
    return new Date(Date.parse(`${day}T00:00:00Z`) + by * DAY_MS).toISOString().slice(0, 10);
}
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** `?from=&to=` as calendar days; the last 30 days when not given. A year at most. */
export function rangeOf(query) {
    const tz = timezone();
    const to = typeof (query === null || query === void 0 ? void 0 : query.to) === 'string' && DAY.test(query.to) ? query.to : today(tz);
    let from = typeof (query === null || query === void 0 ? void 0 : query.from) === 'string' && DAY.test(query.from) ? query.from : shift(to, -29);
    if (from > to)
        from = to;
    if (Date.parse(to) - Date.parse(from) > 366 * DAY_MS)
        from = shift(to, -366);
    const days = Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
    return { from, to, days, tz };
}
/** The same number of days, just before. */
export function previousOf(range) {
    return Object.assign(Object.assign({}, range), { from: shift(range.from, -range.days), to: shift(range.from, -1) });
}
/** `column` within the range's days, written so the index on it is used. */
function within(column, prefix = '') {
    return `${column} >= (CAST(:${prefix}from AS date)::timestamp AT TIME ZONE :tz) AND ${column} < ((CAST(:${prefix}to AS date) + 1)::timestamp AT TIME ZONE :tz)`;
}
function params(range, prefix = '') {
    return { [`${prefix}from`]: range.from, [`${prefix}to`]: range.to, tz: range.tz };
}
function everyDay(range) {
    return Array.from({ length: range.days }, (_, i) => shift(range.from, i));
}
const person = `COALESCE('u' || user_id::text, 'i' || installation_id)`;
/** Names the users behind ids, the way the project names them. */
export function labelUsers(ids) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const unique = Array.from(new Set(ids.filter((id) => typeof id === 'number' && id > 0)));
        if (!unique.length)
            return {};
        const options = usersOptions(state.config);
        const Model = (_b = (_a = sequelize()) === null || _a === void 0 ? void 0 : _a.models) === null || _b === void 0 ? void 0 : _b[options.model];
        if (!Model)
            return {};
        const attributes = Object.keys((_c = Model.rawAttributes) !== null && _c !== void 0 ? _c : {});
        const wanted = [...options.name, ...options.fallback].filter((f) => attributes.includes(f));
        try {
            const found = yield Model.findAll({ where: { id: unique }, attributes: ['id', ...wanted], paranoid: false, raw: true });
            const labels = {};
            for (const user of found) {
                const name = options.name.map((f) => user[f]).filter((v) => v !== null && v !== undefined && String(v).trim()).join(' ').trim();
                const fallback = options.fallback.map((f) => user[f]).find((v) => v !== null && v !== undefined && String(v).trim());
                labels[user.id] = name || (fallback ? String(fallback) : `#${user.id}`);
            }
            return labels;
        }
        catch (err) {
            console.error('[ETHAnalyticsLeaf] Could not name users:', (err === null || err === void 0 ? void 0 : err.message) || err);
            return {};
        }
    });
}
// ── Overview ─────────────────────────────────────────────────────────────
function totals(range_1) {
    return __awaiter(this, arguments, void 0, function* (range, prefix = '') {
        const [kpis] = yield rows(`SELECT count(*)::int AS sessions,
                count(DISTINCT user_id)::int AS users,
                count(DISTINCT installation_id) FILTER (WHERE user_id IS NULL)::int AS guests,
                COALESCE(avg(EXTRACT(EPOCH FROM (last_seen_at - started_at))), 0)::float AS avg_duration,
                COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (last_seen_at - started_at))), 0)::float AS median_duration,
                COALESCE(avg(screen_count) FILTER (WHERE source = 'app'), 0)::float AS screens_per_session,
                -- Left after one screen; for visits only seen through API calls, after one call.
                count(*) FILTER (WHERE (source = 'app' AND screen_count <= 1) OR (source <> 'app' AND event_count <= 1))::int AS bounces
           FROM ${SESSIONS} WHERE ${within('started_at', prefix)}`, params(range, prefix));
        const [fresh] = yield rows(`SELECT count(*)::int AS n FROM (
             SELECT user_id, min(started_at) AS first_seen FROM ${SESSIONS} WHERE user_id IS NOT NULL GROUP BY user_id
         ) t WHERE ${within('first_seen', prefix)}`, params(range, prefix));
        const [actions] = yield rows(`SELECT count(*) FILTER (WHERE type = 'screen')::int AS screens,
                count(*) FILTER (WHERE type IN ('action', 'api'))::int AS actions
           FROM ${EVENTS} WHERE ${within('created_at', prefix)}`, params(range, prefix));
        return Object.assign(Object.assign({}, kpis), { new_users: fresh.n, screens: actions.screens, actions: actions.actions });
    });
}
export function overview(range) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const p = params(range);
        const [current, previous] = yield Promise.all([totals(range), totals(previousOf(range), 'p')]);
        const [series, eventSeries, active, daily, platforms, versions, locales, heat, top, appTracking] = yield Promise.all([
            rows(`SELECT to_char(started_at AT TIME ZONE :tz, 'YYYY-MM-DD') AS day,
                    count(*)::int AS sessions,
                    count(DISTINCT user_id)::int AS users,
                    count(DISTINCT installation_id) FILTER (WHERE user_id IS NULL)::int AS guests
               FROM ${SESSIONS} WHERE ${within('started_at')} GROUP BY 1`, p),
            rows(`SELECT to_char(created_at AT TIME ZONE :tz, 'YYYY-MM-DD') AS day,
                    count(*) FILTER (WHERE type = 'screen')::int AS screens,
                    count(*) FILTER (WHERE type IN ('action', 'api'))::int AS actions
               FROM ${EVENTS} WHERE ${within('created_at')} GROUP BY 1`, p),
            // Active users as of the last day of the range: that day, its week, its month.
            rows(`SELECT count(DISTINCT user_id) FILTER (WHERE started_at >= (CAST(:to AS date)::timestamp AT TIME ZONE :tz))::int AS dau,
                    count(DISTINCT user_id) FILTER (WHERE started_at >= ((CAST(:to AS date) - 6)::timestamp AT TIME ZONE :tz))::int AS wau,
                    count(DISTINCT user_id)::int AS mau
               FROM ${SESSIONS}
              WHERE started_at >= ((CAST(:to AS date) - 29)::timestamp AT TIME ZONE :tz)
                AND started_at < ((CAST(:to AS date) + 1)::timestamp AT TIME ZONE :tz)`, p),
            rows(`SELECT COALESCE(sum(n), 0)::int AS total FROM (
                 SELECT count(DISTINCT user_id) AS n FROM ${SESSIONS}
                  WHERE started_at >= ((CAST(:to AS date) - 29)::timestamp AT TIME ZONE :tz)
                    AND started_at < ((CAST(:to AS date) + 1)::timestamp AT TIME ZONE :tz)
                  GROUP BY to_char(started_at AT TIME ZONE :tz, 'YYYY-MM-DD')
             ) t`, p),
            split('platform', range),
            split('app_version', range, 8),
            split('locale', range, 8),
            rows(`SELECT EXTRACT(ISODOW FROM started_at AT TIME ZONE :tz)::int AS dow,
                    EXTRACT(HOUR FROM started_at AT TIME ZONE :tz)::int AS hour,
                    count(*)::int AS n
               FROM ${SESSIONS} WHERE ${within('started_at')} GROUP BY 1, 2`, p),
            rows(`SELECT type, name, count(*)::int AS count, count(DISTINCT ${person})::int AS people
               FROM ${EVENTS} WHERE ${within('created_at')} AND type IN ('screen', 'action', 'api')
              GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 200`, p),
            rows(`SELECT EXISTS (SELECT 1 FROM ${EVENTS} WHERE type = 'screen') AS yes`, {}),
        ]);
        const byDay = new Map();
        for (const r of series)
            byDay.set(r.day, Object.assign({}, r));
        for (const r of eventSeries)
            byDay.set(r.day, Object.assign(Object.assign({}, ((_a = byDay.get(r.day)) !== null && _a !== void 0 ? _a : {})), r));
        const timeseries = everyDay(range).map((day) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            return ({
                day,
                users: (_b = (_a = byDay.get(day)) === null || _a === void 0 ? void 0 : _a.users) !== null && _b !== void 0 ? _b : 0,
                guests: (_d = (_c = byDay.get(day)) === null || _c === void 0 ? void 0 : _c.guests) !== null && _d !== void 0 ? _d : 0,
                sessions: (_f = (_e = byDay.get(day)) === null || _e === void 0 ? void 0 : _e.sessions) !== null && _f !== void 0 ? _f : 0,
                screens: (_h = (_g = byDay.get(day)) === null || _g === void 0 ? void 0 : _g.screens) !== null && _h !== void 0 ? _h : 0,
                actions: (_k = (_j = byDay.get(day)) === null || _j === void 0 ? void 0 : _j.actions) !== null && _k !== void 0 ? _k : 0,
            });
        });
        const { dau, wau, mau } = active[0];
        const topOf = (types) => top.filter((r) => types.includes(r.type)).slice(0, 8);
        return {
            range,
            appTracking: !!((_b = appTracking[0]) === null || _b === void 0 ? void 0 : _b.yes),
            current,
            previous,
            active: { dau, wau, mau, stickiness: mau ? daily[0].total / 30 / mau : 0 },
            timeseries,
            platforms,
            versions,
            locales,
            heatmap: heat,
            topScreens: topOf(['screen']),
            topActions: topOf(['action', 'api']),
        };
    });
}
function split(column_1, range_1) {
    return __awaiter(this, arguments, void 0, function* (column, range, limit = 20) {
        return rows(`SELECT ${column} AS key, count(*)::int AS sessions, count(DISTINCT ${person})::int AS people
           FROM ${SESSIONS} WHERE ${within('started_at')}
          GROUP BY 1 ORDER BY 2 DESC LIMIT ${limit}`, params(range));
    });
}
// ── Live ─────────────────────────────────────────────────────────────────
export function live() {
    return __awaiter(this, arguments, void 0, function* (minutes = 5) {
        var _a, _b;
        const found = yield rows(`SELECT id, user_id, installation_id, platform, app_version, exit_screen, started_at, last_seen_at, event_count, source
           FROM ${SESSIONS} WHERE last_seen_at >= now() - make_interval(mins => :minutes)
          ORDER BY last_seen_at DESC LIMIT 50`, { minutes });
        // What is still in memory is a few seconds fresher than the table.
        const fresh = new Map(((_b = (_a = state.collector) === null || _a === void 0 ? void 0 : _a.liveVisits(minutes * 60 * 1000)) !== null && _b !== void 0 ? _b : []).map((v) => [v.id, v]));
        const sessions = found.map((s) => {
            var _a;
            const mem = fresh.get(s.id);
            return mem ? Object.assign(Object.assign({}, s), { exit_screen: (_a = mem.exit_screen) !== null && _a !== void 0 ? _a : s.exit_screen, last_seen_at: mem.last_seen_at }) : s;
        });
        const labels = yield labelUsers(sessions.map((s) => s.user_id));
        return { minutes, count: sessions.length, sessions: sessions.map((s) => { var _a; return (Object.assign(Object.assign({}, s), { user_label: (_a = labels[s.user_id]) !== null && _a !== void 0 ? _a : null })); }) };
    });
}
// ── Screens and actions ─────────────────────────────────────────────────
export function events(type, range) {
    return __awaiter(this, void 0, void 0, function* () {
        const p = Object.assign(Object.assign({}, params(range)), { type });
        const list = yield rows(`SELECT name,
                count(*)::int AS count,
                count(DISTINCT ${person})::int AS people,
                count(DISTINCT session_id)::int AS sessions,
                avg(duration_ms)::float AS avg_ms,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms)::float AS median_ms,
                count(*) FILTER (WHERE status >= 400)::int AS errors
           FROM ${EVENTS} WHERE type = :type AND ${within('created_at')}
          GROUP BY name ORDER BY count DESC LIMIT 300`, p);
        const previous = previousOf(range);
        const before = yield rows(`SELECT name, count(*)::int AS count FROM ${EVENTS} WHERE type = :type AND ${within('created_at', 'p')} GROUP BY name`, Object.assign(Object.assign({}, params(previous, 'p')), { type }));
        const names = list.slice(0, 60).map((r) => r.name);
        const daily = names.length
            ? yield rows(`SELECT name, to_char(created_at AT TIME ZONE :tz, 'YYYY-MM-DD') AS day, count(*)::int AS n
                 FROM ${EVENTS} WHERE type = :type AND name IN (:names) AND ${within('created_at')} GROUP BY 1, 2`, Object.assign(Object.assign({}, p), { names }))
            : [];
        let entries = [];
        let exits = [];
        if (type === 'screen') {
            ;
            [entries, exits] = yield Promise.all([
                rows(`SELECT entry_screen AS name, count(*)::int AS n FROM ${SESSIONS} WHERE ${within('started_at')} AND entry_screen IS NOT NULL GROUP BY 1`, p),
                rows(`SELECT exit_screen AS name, count(*)::int AS n FROM ${SESSIONS} WHERE ${within('started_at')} AND exit_screen IS NOT NULL GROUP BY 1`, p),
            ]);
        }
        const days = everyDay(range);
        const seriesOf = new Map();
        for (const r of daily) {
            if (!seriesOf.has(r.name))
                seriesOf.set(r.name, new Map());
            seriesOf.get(r.name).set(r.day, r.n);
        }
        const prev = new Map(before.map((r) => [r.name, r.count]));
        const entryOf = new Map(entries.map((r) => [r.name, r.n]));
        const exitOf = new Map(exits.map((r) => [r.name, r.n]));
        return {
            range,
            type,
            items: list.map((r) => {
                var _a, _b, _c;
                return (Object.assign(Object.assign({}, r), { previous: (_a = prev.get(r.name)) !== null && _a !== void 0 ? _a : 0, entries: (_b = entryOf.get(r.name)) !== null && _b !== void 0 ? _b : null, exits: (_c = exitOf.get(r.name)) !== null && _c !== void 0 ? _c : null, series: seriesOf.has(r.name) ? days.map((d) => { var _a; return (_a = seriesOf.get(r.name).get(d)) !== null && _a !== void 0 ? _a : 0; }) : null }));
            }),
        };
    });
}
// ── Paths ────────────────────────────────────────────────────────────────
/** The steps of each visit in order, a step repeated back to back counted once. */
function steps() {
    return `raw AS (
        SELECT session_id, id, created_at, name,
               LAG(name) OVER (PARTITION BY session_id ORDER BY created_at, id) AS repeated
          FROM ${EVENTS} WHERE type = :flowType AND ${within('created_at')}
    ),
    seq AS (
        SELECT session_id, name,
               LAG(name) OVER w AS prev,
               LEAD(name) OVER w AS next,
               row_number() OVER w AS rn
          FROM raw WHERE repeated IS DISTINCT FROM name
        WINDOW w AS (PARTITION BY session_id ORDER BY created_at, id)
    )`;
}
export function flows(type, range, name) {
    return __awaiter(this, void 0, void 0, function* () {
        const p = Object.assign(Object.assign({}, params(range)), { sep: SEP, flowType: type });
        if (name) {
            const around = yield rows(`WITH ${steps()}
             SELECT 'from' AS dir, prev AS other, count(*)::int AS n FROM seq WHERE name = :name GROUP BY prev
             UNION ALL
             SELECT 'to' AS dir, next AS other, count(*)::int AS n FROM seq WHERE name = :name GROUP BY next`, Object.assign(Object.assign({}, p), { name }));
            const side = (dir) => around
                .filter((r) => r.dir === dir)
                .sort((a, b) => b.n - a.n)
                .map((r) => ({ name: r.other, count: r.n }));
            const from = side('from');
            return { range, type, name, total: from.reduce((s, r) => s + r.count, 0), from, to: side('to') };
        }
        const [transitions, paths] = yield Promise.all([
            rows(`WITH ${steps()}
             SELECT prev AS "from", name AS "to", count(*)::int AS n FROM seq WHERE prev IS NOT NULL
              GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 40`, p),
            rows(`WITH ${steps()}, paths AS (
                 SELECT session_id, string_agg(name, :sep ORDER BY rn) AS path FROM seq WHERE rn <= 4 GROUP BY session_id
             )
             SELECT path, count(*)::int AS n FROM paths GROUP BY path ORDER BY n DESC LIMIT 15`, p),
        ]);
        return {
            range,
            type,
            transitions: transitions.map((r) => ({ from: r.from, to: r.to, count: r.n })),
            paths: paths.map((r) => ({ steps: String(r.path).split(SEP), count: r.n })),
        };
    });
}
// ── Funnels ──────────────────────────────────────────────────────────────
const STEP = /^(screen|action|api|app):.{1,160}$/;
export function parseSteps(value) {
    const list = (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [])
        .map((s) => String(s).trim())
        .filter((s) => STEP.test(s));
    return list.slice(0, 8);
}
/**
 * How many went through each step in order: in the same visit, or at any
 * time in the range for `scope = person`. Each step also says how long it
 * took, on average, from the one before.
 */
export function funnel(stepList, range, scope) {
    return __awaiter(this, void 0, void 0, function* () {
        if (stepList.length < 2)
            throw new ReportError(400, 'two_steps_needed');
        const key = scope === 'person' ? person : 'session_id';
        const p = Object.assign(Object.assign({}, params(range)), { steps: stepList });
        stepList.forEach((s, i) => (p[`s${i}`] = s));
        const ctes = [
            `e AS (SELECT ${key} AS k, type || ':' || name AS step, created_at FROM ${EVENTS}
                WHERE ${within('created_at')} AND type || ':' || name IN (:steps) AND ${key} IS NOT NULL)`,
            `f0 AS (SELECT k, min(created_at) AS t FROM e WHERE step = :s0 GROUP BY k)`,
            ...stepList.slice(1).map((_, j) => `f${j + 1} AS (SELECT e.k, min(e.created_at) AS t FROM e JOIN f${j} ON f${j}.k = e.k AND e.created_at >= f${j}.t
                                WHERE e.step = :s${j + 1} GROUP BY e.k)`),
        ];
        const selects = [
            `SELECT 0 AS i, count(*)::int AS n, NULL::float AS secs FROM f0`,
            ...stepList.slice(1).map((_, j) => `SELECT ${j + 1} AS i, count(*)::int AS n, avg(EXTRACT(EPOCH FROM (f${j + 1}.t - f${j}.t)))::float AS secs
                   FROM f${j + 1} JOIN f${j} ON f${j}.k = f${j + 1}.k`),
        ];
        const result = yield rows(`WITH ${ctes.join(',\n')}\n${selects.join('\nUNION ALL\n')} ORDER BY i`, p);
        return {
            range,
            scope,
            steps: stepList.map((step, i) => {
                var _a, _b;
                const r = result.find((x) => x.i === i);
                return { step, count: (_a = r === null || r === void 0 ? void 0 : r.n) !== null && _a !== void 0 ? _a : 0, avg_seconds: (_b = r === null || r === void 0 ? void 0 : r.secs) !== null && _b !== void 0 ? _b : null };
            }),
        };
    });
}
// ── Retention ────────────────────────────────────────────────────────────
/**
 * Weekly cohorts: the people first seen in a week, and the share of them back
 * in each week after. Signed-in users by default; `who = all` adds guests by
 * their install.
 */
export function retention(weeks, who) {
    return __awaiter(this, void 0, void 0, function* () {
        const tz = timezone();
        const key = who === 'all' ? person : 'user_id::text';
        const filter = who === 'all' ? '(user_id IS NOT NULL OR installation_id IS NOT NULL)' : 'user_id IS NOT NULL';
        const result = yield rows(`WITH a AS (
             SELECT ${key} AS k, date_trunc('week', started_at AT TIME ZONE :tz)::date AS w
               FROM ${SESSIONS} WHERE ${filter} GROUP BY 1, 2
         ),
         f AS (SELECT k, min(w) AS c FROM a GROUP BY k)
         SELECT to_char(f.c, 'YYYY-MM-DD') AS cohort, ((a.w - f.c) / 7)::int AS n, count(*)::int AS people
           FROM a JOIN f ON f.k = a.k
          WHERE f.c >= date_trunc('week', now() AT TIME ZONE :tz)::date - (:weeks - 1) * 7
          GROUP BY 1, 2 ORDER BY 1, 2`, { tz, weeks });
        const cohorts = new Map();
        for (const r of result) {
            if (!cohorts.has(r.cohort))
                cohorts.set(r.cohort, []);
            cohorts.get(r.cohort)[r.n] = r.people;
        }
        return {
            weeks,
            who,
            cohorts: Array.from(cohorts.entries()).map(([week, counts]) => {
                var _a;
                return ({
                    week,
                    size: (_a = counts[0]) !== null && _a !== void 0 ? _a : 0,
                    weeks: Array.from({ length: counts.length }, (_, i) => { var _a; return (_a = counts[i]) !== null && _a !== void 0 ? _a : 0; }),
                });
            }),
        };
    });
}
// ── One person ───────────────────────────────────────────────────────────
const SESSION_COLUMNS = `id, user_id, installation_id, platform, app_version, os_version, device_model, locale, source,
    started_at, last_seen_at, EXTRACT(EPOCH FROM (last_seen_at - started_at))::float AS duration,
    screen_count, event_count, entry_screen, exit_screen`;
export function userActivity(userId, before) {
    return __awaiter(this, void 0, void 0, function* () {
        const tz = timezone();
        const p = { id: userId, tz };
        const [[summary], days, top, sessions] = yield Promise.all([
            rows(`SELECT count(*)::int AS sessions,
                    count(*) FILTER (WHERE started_at >= now() - interval '30 days')::int AS sessions_30d,
                    min(started_at) AS first_seen,
                    max(last_seen_at) AS last_seen,
                    COALESCE(sum(EXTRACT(EPOCH FROM (last_seen_at - started_at))), 0)::float AS total_seconds,
                    (array_agg(platform ORDER BY last_seen_at DESC) FILTER (WHERE platform IS NOT NULL))[1] AS platform,
                    (array_agg(app_version ORDER BY last_seen_at DESC) FILTER (WHERE app_version IS NOT NULL))[1] AS app_version,
                    (array_agg(os_version ORDER BY last_seen_at DESC) FILTER (WHERE os_version IS NOT NULL))[1] AS os_version,
                    (array_agg(device_model ORDER BY last_seen_at DESC) FILTER (WHERE device_model IS NOT NULL))[1] AS device_model,
                    (array_agg(locale ORDER BY last_seen_at DESC) FILTER (WHERE locale IS NOT NULL))[1] AS locale
               FROM ${SESSIONS} WHERE user_id = :id`, p),
            rows(`SELECT to_char(started_at AT TIME ZONE :tz, 'YYYY-MM-DD') AS day, count(*)::int AS n
               FROM ${SESSIONS} WHERE user_id = :id AND started_at >= now() - interval '91 days' GROUP BY 1`, p),
            rows(`SELECT type, name, count(*)::int AS count, max(created_at) AS last_at
               FROM ${EVENTS} WHERE user_id = :id AND created_at >= now() - interval '90 days'
                AND type IN ('screen', 'action', 'api')
              GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 60`, p),
            sessionsOf(userId, before),
        ]);
        return Object.assign({ summary,
            days, topScreens: top.filter((r) => r.type === 'screen').slice(0, 8), topActions: top.filter((r) => r.type !== 'screen').slice(0, 8) }, sessions);
    });
}
function sessionsOf(userId, before) {
    return __awaiter(this, void 0, void 0, function* () {
        const limit = 20;
        const list = yield rows(`SELECT ${SESSION_COLUMNS} FROM ${SESSIONS}
          WHERE user_id = :id ${before ? 'AND started_at < :before' : ''}
          ORDER BY started_at DESC LIMIT ${limit}`, { id: userId, before });
        return {
            sessions: list,
            nextBefore: list.length === limit ? new Date(list[list.length - 1].started_at).toISOString() : null,
        };
    });
}
export function session(id) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const [found] = yield rows(`SELECT ${SESSION_COLUMNS} FROM ${SESSIONS} WHERE id = :id`, { id });
        if (!found)
            throw new ReportError(404, 'not_found');
        const list = yield rows(`SELECT id, type, name, screen, properties, duration_ms, status, created_at AS at
           FROM ${EVENTS} WHERE session_id = :id ORDER BY created_at, id LIMIT 500`, { id });
        const labels = yield labelUsers([found.user_id]);
        return { session: Object.assign(Object.assign({}, found), { user_label: (_a = labels[found.user_id]) !== null && _a !== void 0 ? _a : null }), events: list, truncated: list.length === 500 };
    });
}
