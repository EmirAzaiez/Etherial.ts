// ──────────────────────────────────────────────────────────────────────────
// The numbers the back-office shows, straight from the two tables.
//
// Postgres only: visits and paths lean on window functions, percentiles and
// time zones. Calendar days are cut in the configured time zone, and every
// date bound stays on the indexed column so a year of events reads quickly.
// ──────────────────────────────────────────────────────────────────────────

import etherial from 'etherial'
import { QueryTypes } from 'sequelize'

import { state } from './state.js'
import { usersOptions } from './options.js'

const EVENTS = 'analytics_events'
const SESSIONS = 'analytics_sessions'
const DAY_MS = 24 * 3600 * 1000
/** Separates the steps of a path inside one SQL string. */
const SEP = '\u001f'

export interface Range {
    from: string
    to: string
    days: number
    tz: string
}

export class ReportError extends Error {
    constructor(public status: number, public code: string) {
        super(code)
    }
}

function sequelize(): any {
    return (etherial as any).database?.sequelize
}

export function ensurePostgres() {
    const dialect = sequelize()?.getDialect?.()
    if (dialect !== 'postgres') throw new ReportError(501, 'postgres_required')
}

async function rows<T = any>(sql: string, replacements: Record<string, unknown>): Promise<T[]> {
    return sequelize().query(sql, { replacements, type: QueryTypes.SELECT })
}

export function timezone(): string {
    return state.config.timezone || 'UTC'
}

/** Today's date where the project lives, `YYYY-MM-DD`. */
function today(tz: string): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function shift(day: string, by: number): string {
    return new Date(Date.parse(`${day}T00:00:00Z`) + by * DAY_MS).toISOString().slice(0, 10)
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** `?from=&to=` as calendar days; the last 30 days when not given. A year at most. */
export function rangeOf(query: any): Range {
    const tz = timezone()
    const to = typeof query?.to === 'string' && DAY.test(query.to) ? query.to : today(tz)
    let from = typeof query?.from === 'string' && DAY.test(query.from) ? query.from : shift(to, -29)
    if (from > to) from = to
    if (Date.parse(to) - Date.parse(from) > 366 * DAY_MS) from = shift(to, -366)
    const days = Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1
    return { from, to, days, tz }
}

/** The same number of days, just before. */
export function previousOf(range: Range): Range {
    return { ...range, from: shift(range.from, -range.days), to: shift(range.from, -1) }
}

/** `column` within the range's days, written so the index on it is used. */
function within(column: string, prefix = '') {
    return `${column} >= (CAST(:${prefix}from AS date)::timestamp AT TIME ZONE :tz) AND ${column} < ((CAST(:${prefix}to AS date) + 1)::timestamp AT TIME ZONE :tz)`
}

function params(range: Range, prefix = '') {
    return { [`${prefix}from`]: range.from, [`${prefix}to`]: range.to, tz: range.tz }
}

function everyDay(range: Range): string[] {
    return Array.from({ length: range.days }, (_, i) => shift(range.from, i))
}

const person = `COALESCE('u' || user_id::text, 'i' || installation_id)`

// ── People ───────────────────────────────────────────────────────────────

export interface PersonLabel {
    id: number
    label: string
}

/** Names the users behind ids, the way the project names them. */
export async function labelUsers(ids: (number | null | undefined)[]): Promise<Record<number, string>> {
    const unique = Array.from(new Set(ids.filter((id): id is number => typeof id === 'number' && id > 0)))
    if (!unique.length) return {}
    const options = usersOptions(state.config)
    const Model = sequelize()?.models?.[options.model]
    if (!Model) return {}
    const attributes = Object.keys(Model.rawAttributes ?? {})
    const wanted = [...options.name, ...options.fallback].filter((f) => attributes.includes(f))
    try {
        const found = await Model.findAll({ where: { id: unique }, attributes: ['id', ...wanted], paranoid: false, raw: true })
        const labels: Record<number, string> = {}
        for (const user of found as any[]) {
            const name = options.name.map((f) => user[f]).filter((v) => v !== null && v !== undefined && String(v).trim()).join(' ').trim()
            const fallback = options.fallback.map((f) => user[f]).find((v) => v !== null && v !== undefined && String(v).trim())
            labels[user.id] = name || (fallback ? String(fallback) : `#${user.id}`)
        }
        return labels
    } catch (err: any) {
        console.error('[ETHAnalyticsLeaf] Could not name users:', err?.message || err)
        return {}
    }
}

// ── Overview ─────────────────────────────────────────────────────────────

async function totals(range: Range, prefix = '') {
    const [kpis] = await rows(
        `SELECT count(*)::int AS sessions,
                count(DISTINCT user_id)::int AS users,
                count(DISTINCT installation_id) FILTER (WHERE user_id IS NULL)::int AS guests,
                COALESCE(avg(EXTRACT(EPOCH FROM (last_seen_at - started_at))), 0)::float AS avg_duration,
                COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (last_seen_at - started_at))), 0)::float AS median_duration,
                COALESCE(avg(screen_count) FILTER (WHERE source = 'app'), 0)::float AS screens_per_session,
                -- Left after one screen; for visits only seen through API calls, after one call.
                count(*) FILTER (WHERE (source = 'app' AND screen_count <= 1) OR (source <> 'app' AND event_count <= 1))::int AS bounces
           FROM ${SESSIONS} WHERE ${within('started_at', prefix)}`,
        params(range, prefix)
    )
    const [fresh] = await rows(
        `SELECT count(*)::int AS n FROM (
             SELECT user_id, min(started_at) AS first_seen FROM ${SESSIONS} WHERE user_id IS NOT NULL GROUP BY user_id
         ) t WHERE ${within('first_seen', prefix)}`,
        params(range, prefix)
    )
    const [actions] = await rows(
        `SELECT count(*) FILTER (WHERE type = 'screen')::int AS screens,
                count(*) FILTER (WHERE type IN ('action', 'api'))::int AS actions
           FROM ${EVENTS} WHERE ${within('created_at', prefix)}`,
        params(range, prefix)
    )
    return { ...kpis, new_users: fresh.n, screens: actions.screens, actions: actions.actions }
}

export async function overview(range: Range) {
    const p = params(range)
    const [current, previous] = await Promise.all([totals(range), totals(previousOf(range), 'p')])

    const [series, eventSeries, active, daily, platforms, versions, locales, heat, top, appTracking] = await Promise.all([
        rows(
            `SELECT to_char(started_at AT TIME ZONE :tz, 'YYYY-MM-DD') AS day,
                    count(*)::int AS sessions,
                    count(DISTINCT user_id)::int AS users,
                    count(DISTINCT installation_id) FILTER (WHERE user_id IS NULL)::int AS guests
               FROM ${SESSIONS} WHERE ${within('started_at')} GROUP BY 1`,
            p
        ),
        rows(
            `SELECT to_char(created_at AT TIME ZONE :tz, 'YYYY-MM-DD') AS day,
                    count(*) FILTER (WHERE type = 'screen')::int AS screens,
                    count(*) FILTER (WHERE type IN ('action', 'api'))::int AS actions
               FROM ${EVENTS} WHERE ${within('created_at')} GROUP BY 1`,
            p
        ),
        // Active users as of the last day of the range: that day, its week, its month.
        rows(
            `SELECT count(DISTINCT user_id) FILTER (WHERE started_at >= (CAST(:to AS date)::timestamp AT TIME ZONE :tz))::int AS dau,
                    count(DISTINCT user_id) FILTER (WHERE started_at >= ((CAST(:to AS date) - 6)::timestamp AT TIME ZONE :tz))::int AS wau,
                    count(DISTINCT user_id)::int AS mau
               FROM ${SESSIONS}
              WHERE started_at >= ((CAST(:to AS date) - 29)::timestamp AT TIME ZONE :tz)
                AND started_at < ((CAST(:to AS date) + 1)::timestamp AT TIME ZONE :tz)`,
            p
        ),
        rows(
            `SELECT COALESCE(sum(n), 0)::int AS total FROM (
                 SELECT count(DISTINCT user_id) AS n FROM ${SESSIONS}
                  WHERE started_at >= ((CAST(:to AS date) - 29)::timestamp AT TIME ZONE :tz)
                    AND started_at < ((CAST(:to AS date) + 1)::timestamp AT TIME ZONE :tz)
                  GROUP BY to_char(started_at AT TIME ZONE :tz, 'YYYY-MM-DD')
             ) t`,
            p
        ),
        split('platform', range),
        split('app_version', range, 8),
        split('locale', range, 8),
        rows(
            `SELECT EXTRACT(ISODOW FROM started_at AT TIME ZONE :tz)::int AS dow,
                    EXTRACT(HOUR FROM started_at AT TIME ZONE :tz)::int AS hour,
                    count(*)::int AS n
               FROM ${SESSIONS} WHERE ${within('started_at')} GROUP BY 1, 2`,
            p
        ),
        rows(
            `SELECT type, name, count(*)::int AS count, count(DISTINCT ${person})::int AS people
               FROM ${EVENTS} WHERE ${within('created_at')} AND type IN ('screen', 'action', 'api')
              GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 200`,
            p
        ),
        rows(`SELECT EXISTS (SELECT 1 FROM ${EVENTS} WHERE type = 'screen') AS yes`, {}),
    ])

    const byDay = new Map<string, any>()
    for (const r of series) byDay.set(r.day, { ...r })
    for (const r of eventSeries) byDay.set(r.day, { ...(byDay.get(r.day) ?? {}), ...r })
    const timeseries = everyDay(range).map((day) => ({
        day,
        users: byDay.get(day)?.users ?? 0,
        guests: byDay.get(day)?.guests ?? 0,
        sessions: byDay.get(day)?.sessions ?? 0,
        screens: byDay.get(day)?.screens ?? 0,
        actions: byDay.get(day)?.actions ?? 0,
    }))

    const { dau, wau, mau } = active[0]
    const topOf = (types: string[]) => top.filter((r: any) => types.includes(r.type)).slice(0, 8)

    return {
        range,
        appTracking: !!appTracking[0]?.yes,
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
    }
}

async function split(column: 'platform' | 'app_version' | 'locale', range: Range, limit = 20) {
    return rows(
        `SELECT ${column} AS key, count(*)::int AS sessions, count(DISTINCT ${person})::int AS people
           FROM ${SESSIONS} WHERE ${within('started_at')}
          GROUP BY 1 ORDER BY 2 DESC LIMIT ${limit}`,
        params(range)
    )
}

// ── Live ─────────────────────────────────────────────────────────────────

export async function live(minutes = 5) {
    const found = await rows(
        `SELECT id, user_id, installation_id, platform, app_version, exit_screen, started_at, last_seen_at, event_count, source
           FROM ${SESSIONS} WHERE last_seen_at >= now() - make_interval(mins => :minutes)
          ORDER BY last_seen_at DESC LIMIT 50`,
        { minutes }
    )
    // What is still in memory is a few seconds fresher than the table.
    const fresh = new Map((state.collector?.liveVisits(minutes * 60 * 1000) ?? []).map((v) => [v.id, v]))
    const sessions = found.map((s: any) => {
        const mem = fresh.get(s.id)
        return mem ? { ...s, exit_screen: mem.exit_screen ?? s.exit_screen, last_seen_at: mem.last_seen_at } : s
    })
    const labels = await labelUsers(sessions.map((s: any) => s.user_id))
    return { minutes, count: sessions.length, sessions: sessions.map((s: any) => ({ ...s, user_label: labels[s.user_id] ?? null })) }
}

// ── Screens and actions ─────────────────────────────────────────────────

export async function events(type: string, range: Range) {
    const p = { ...params(range), type }
    const list = await rows(
        `SELECT name,
                count(*)::int AS count,
                count(DISTINCT ${person})::int AS people,
                count(DISTINCT session_id)::int AS sessions,
                avg(duration_ms)::float AS avg_ms,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms)::float AS median_ms,
                count(*) FILTER (WHERE status >= 400)::int AS errors
           FROM ${EVENTS} WHERE type = :type AND ${within('created_at')}
          GROUP BY name ORDER BY count DESC LIMIT 300`,
        p
    )
    const previous = previousOf(range)
    const before = await rows(
        `SELECT name, count(*)::int AS count FROM ${EVENTS} WHERE type = :type AND ${within('created_at', 'p')} GROUP BY name`,
        { ...params(previous, 'p'), type }
    )
    const names = list.slice(0, 60).map((r: any) => r.name)
    const daily = names.length
        ? await rows(
              `SELECT name, to_char(created_at AT TIME ZONE :tz, 'YYYY-MM-DD') AS day, count(*)::int AS n
                 FROM ${EVENTS} WHERE type = :type AND name IN (:names) AND ${within('created_at')} GROUP BY 1, 2`,
              { ...p, names }
          )
        : []
    let entries: any[] = []
    let exits: any[] = []
    if (type === 'screen') {
        ;[entries, exits] = await Promise.all([
            rows(`SELECT entry_screen AS name, count(*)::int AS n FROM ${SESSIONS} WHERE ${within('started_at')} AND entry_screen IS NOT NULL GROUP BY 1`, p),
            rows(`SELECT exit_screen AS name, count(*)::int AS n FROM ${SESSIONS} WHERE ${within('started_at')} AND exit_screen IS NOT NULL GROUP BY 1`, p),
        ])
    }

    const days = everyDay(range)
    const seriesOf = new Map<string, Map<string, number>>()
    for (const r of daily) {
        if (!seriesOf.has(r.name)) seriesOf.set(r.name, new Map())
        seriesOf.get(r.name)!.set(r.day, r.n)
    }
    const prev = new Map(before.map((r: any) => [r.name, r.count]))
    const entryOf = new Map(entries.map((r: any) => [r.name, r.n]))
    const exitOf = new Map(exits.map((r: any) => [r.name, r.n]))

    return {
        range,
        type,
        items: list.map((r: any) => ({
            ...r,
            previous: prev.get(r.name) ?? 0,
            entries: entryOf.get(r.name) ?? null,
            exits: exitOf.get(r.name) ?? null,
            series: seriesOf.has(r.name) ? days.map((d) => seriesOf.get(r.name)!.get(d) ?? 0) : null,
        })),
    }
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
    )`
}

export async function flows(type: 'screen' | 'api' | 'action', range: Range, name?: string) {
    const p = { ...params(range), sep: SEP, flowType: type }
    if (name) {
        const around = await rows(
            `WITH ${steps()}
             SELECT 'from' AS dir, prev AS other, count(*)::int AS n FROM seq WHERE name = :name GROUP BY prev
             UNION ALL
             SELECT 'to' AS dir, next AS other, count(*)::int AS n FROM seq WHERE name = :name GROUP BY next`,
            { ...p, name }
        )
        const side = (dir: string) =>
            around
                .filter((r: any) => r.dir === dir)
                .sort((a: any, b: any) => b.n - a.n)
                .map((r: any) => ({ name: r.other, count: r.n }))
        const from = side('from')
        return { range, type, name, total: from.reduce((s: number, r: any) => s + r.count, 0), from, to: side('to') }
    }

    const [transitions, paths] = await Promise.all([
        rows(
            `WITH ${steps()}
             SELECT prev AS "from", name AS "to", count(*)::int AS n FROM seq WHERE prev IS NOT NULL
              GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 40`,
            p
        ),
        rows(
            `WITH ${steps()}, paths AS (
                 SELECT session_id, string_agg(name, :sep ORDER BY rn) AS path FROM seq WHERE rn <= 4 GROUP BY session_id
             )
             SELECT path, count(*)::int AS n FROM paths GROUP BY path ORDER BY n DESC LIMIT 15`,
            p
        ),
    ])
    return {
        range,
        type,
        transitions: transitions.map((r: any) => ({ from: r.from, to: r.to, count: r.n })),
        paths: paths.map((r: any) => ({ steps: String(r.path).split(SEP), count: r.n })),
    }
}

// ── Funnels ──────────────────────────────────────────────────────────────

const STEP = /^(screen|action|api|app):.{1,160}$/

export function parseSteps(value: unknown): string[] {
    const list = (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [])
        .map((s) => String(s).trim())
        .filter((s) => STEP.test(s))
    return list.slice(0, 8)
}

/**
 * How many went through each step in order: in the same visit, or at any
 * time in the range for `scope = person`. Each step also says how long it
 * took, on average, from the one before.
 */
export async function funnel(stepList: string[], range: Range, scope: 'session' | 'person') {
    if (stepList.length < 2) throw new ReportError(400, 'two_steps_needed')
    const key = scope === 'person' ? person : 'session_id'
    const p: Record<string, unknown> = { ...params(range), steps: stepList }
    stepList.forEach((s, i) => (p[`s${i}`] = s))

    const ctes = [
        `e AS (SELECT ${key} AS k, type || ':' || name AS step, created_at FROM ${EVENTS}
                WHERE ${within('created_at')} AND type || ':' || name IN (:steps) AND ${key} IS NOT NULL)`,
        `f0 AS (SELECT k, min(created_at) AS t FROM e WHERE step = :s0 GROUP BY k)`,
        ...stepList.slice(1).map(
            (_, j) =>
                `f${j + 1} AS (SELECT e.k, min(e.created_at) AS t FROM e JOIN f${j} ON f${j}.k = e.k AND e.created_at >= f${j}.t
                                WHERE e.step = :s${j + 1} GROUP BY e.k)`
        ),
    ]
    const selects = [
        `SELECT 0 AS i, count(*)::int AS n, NULL::float AS secs FROM f0`,
        ...stepList.slice(1).map(
            (_, j) =>
                `SELECT ${j + 1} AS i, count(*)::int AS n, avg(EXTRACT(EPOCH FROM (f${j + 1}.t - f${j}.t)))::float AS secs
                   FROM f${j + 1} JOIN f${j} ON f${j}.k = f${j + 1}.k`
        ),
    ]
    const result = await rows(`WITH ${ctes.join(',\n')}\n${selects.join('\nUNION ALL\n')} ORDER BY i`, p)
    return {
        range,
        scope,
        steps: stepList.map((step, i) => {
            const r = result.find((x: any) => x.i === i)
            return { step, count: r?.n ?? 0, avg_seconds: r?.secs ?? null }
        }),
    }
}

// ── Retention ────────────────────────────────────────────────────────────

/**
 * Weekly cohorts: the people first seen in a week, and the share of them back
 * in each week after. Signed-in users by default; `who = all` adds guests by
 * their install.
 */
export async function retention(weeks: number, who: 'users' | 'all') {
    const tz = timezone()
    const key = who === 'all' ? person : 'user_id::text'
    const filter = who === 'all' ? '(user_id IS NOT NULL OR installation_id IS NOT NULL)' : 'user_id IS NOT NULL'
    const result = await rows(
        `WITH a AS (
             SELECT ${key} AS k, date_trunc('week', started_at AT TIME ZONE :tz)::date AS w
               FROM ${SESSIONS} WHERE ${filter} GROUP BY 1, 2
         ),
         f AS (SELECT k, min(w) AS c FROM a GROUP BY k)
         SELECT to_char(f.c, 'YYYY-MM-DD') AS cohort, ((a.w - f.c) / 7)::int AS n, count(*)::int AS people
           FROM a JOIN f ON f.k = a.k
          WHERE f.c >= date_trunc('week', now() AT TIME ZONE :tz)::date - (:weeks - 1) * 7
          GROUP BY 1, 2 ORDER BY 1, 2`,
        { tz, weeks }
    )
    const cohorts = new Map<string, number[]>()
    for (const r of result) {
        if (!cohorts.has(r.cohort)) cohorts.set(r.cohort, [])
        cohorts.get(r.cohort)![r.n] = r.people
    }
    return {
        weeks,
        who,
        cohorts: Array.from(cohorts.entries()).map(([week, counts]) => ({
            week,
            size: counts[0] ?? 0,
            weeks: Array.from({ length: counts.length }, (_, i) => counts[i] ?? 0),
        })),
    }
}

// ── One person ───────────────────────────────────────────────────────────

const SESSION_COLUMNS = `id, user_id, installation_id, platform, app_version, os_version, device_model, locale, source,
    started_at, last_seen_at, EXTRACT(EPOCH FROM (last_seen_at - started_at))::float AS duration,
    screen_count, event_count, entry_screen, exit_screen`

export async function userActivity(userId: number, before?: Date) {
    const tz = timezone()
    const p = { id: userId, tz }
    const [[summary], days, top, sessions] = await Promise.all([
        rows(
            `SELECT count(*)::int AS sessions,
                    count(*) FILTER (WHERE started_at >= now() - interval '30 days')::int AS sessions_30d,
                    min(started_at) AS first_seen,
                    max(last_seen_at) AS last_seen,
                    COALESCE(sum(EXTRACT(EPOCH FROM (last_seen_at - started_at))), 0)::float AS total_seconds,
                    (array_agg(platform ORDER BY last_seen_at DESC) FILTER (WHERE platform IS NOT NULL))[1] AS platform,
                    (array_agg(app_version ORDER BY last_seen_at DESC) FILTER (WHERE app_version IS NOT NULL))[1] AS app_version,
                    (array_agg(os_version ORDER BY last_seen_at DESC) FILTER (WHERE os_version IS NOT NULL))[1] AS os_version,
                    (array_agg(device_model ORDER BY last_seen_at DESC) FILTER (WHERE device_model IS NOT NULL))[1] AS device_model,
                    (array_agg(locale ORDER BY last_seen_at DESC) FILTER (WHERE locale IS NOT NULL))[1] AS locale
               FROM ${SESSIONS} WHERE user_id = :id`,
            p
        ),
        rows(
            `SELECT to_char(started_at AT TIME ZONE :tz, 'YYYY-MM-DD') AS day, count(*)::int AS n
               FROM ${SESSIONS} WHERE user_id = :id AND started_at >= now() - interval '91 days' GROUP BY 1`,
            p
        ),
        rows(
            `SELECT type, name, count(*)::int AS count, max(created_at) AS last_at
               FROM ${EVENTS} WHERE user_id = :id AND created_at >= now() - interval '90 days'
                AND type IN ('screen', 'action', 'api')
              GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 60`,
            p
        ),
        sessionsOf(userId, before),
    ])
    return {
        summary,
        days,
        topScreens: top.filter((r: any) => r.type === 'screen').slice(0, 8),
        topActions: top.filter((r: any) => r.type !== 'screen').slice(0, 8),
        ...sessions,
    }
}

async function sessionsOf(userId: number, before?: Date) {
    const limit = 20
    const list = await rows(
        `SELECT ${SESSION_COLUMNS} FROM ${SESSIONS}
          WHERE user_id = :id ${before ? 'AND started_at < :before' : ''}
          ORDER BY started_at DESC LIMIT ${limit}`,
        { id: userId, before }
    )
    return {
        sessions: list,
        nextBefore: list.length === limit ? new Date(list[list.length - 1].started_at).toISOString() : null,
    }
}

export async function session(id: string) {
    const [found] = await rows(`SELECT ${SESSION_COLUMNS} FROM ${SESSIONS} WHERE id = :id`, { id })
    if (!found) throw new ReportError(404, 'not_found')
    const list = await rows(
        `SELECT id, type, name, screen, properties, duration_ms, status, created_at AS at
           FROM ${EVENTS} WHERE session_id = :id ORDER BY created_at, id LIMIT 500`,
        { id }
    )
    const labels = await labelUsers([found.user_id])
    return { session: { ...found, user_label: labels[found.user_id] ?? null }, events: list, truncated: list.length === 500 }
}
