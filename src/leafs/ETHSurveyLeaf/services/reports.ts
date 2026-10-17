// ──────────────────────────────────────────────────────────────────────────
// What the back-office's Surveys page reads: the score, how many answered,
// how it moves week by week, and what people wrote. Postgres only.
// ──────────────────────────────────────────────────────────────────────────

import etherial from 'etherial'
import { QueryTypes } from 'sequelize'

import { state } from './state.js'
import { SurveyDefinition, SurveyKind, kindOf, scaleOf, usersOptions } from './options.js'

const DAY_MS = 24 * 3600 * 1000
const DAY = /^\d{4}-\d{2}-\d{2}$/
const TABLE = 'survey_responses'

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

function timezone(): string {
    return state.config.timezone || 'UTC'
}

function today(tz: string): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function shift(day: string, by: number): string {
    return new Date(Date.parse(`${day}T00:00:00Z`) + by * DAY_MS).toISOString().slice(0, 10)
}

/** `?from=&to=` as calendar days; the last 90 days when not given (answers come slowly). Two years at most. */
export function rangeOf(query: any): Range {
    const tz = timezone()
    const to = typeof query?.to === 'string' && DAY.test(query.to) ? query.to : today(tz)
    let from = typeof query?.from === 'string' && DAY.test(query.from) ? query.from : shift(to, -89)
    if (from > to) from = to
    if (Date.parse(to) - Date.parse(from) > 731 * DAY_MS) from = shift(to, -731)
    const days = Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1
    return { from, to, days, tz }
}

function previousOf(range: Range): Range {
    return { ...range, from: shift(range.from, -range.days), to: shift(range.from, -1) }
}

function within(column: string, prefix = '') {
    return `${column} >= (CAST(:${prefix}from AS date)::timestamp AT TIME ZONE :tz) AND ${column} < ((CAST(:${prefix}to AS date) + 1)::timestamp AT TIME ZONE :tz)`
}

function params(range: Range, prefix = '') {
    return { [`${prefix}from`]: range.from, [`${prefix}to`]: range.to, tz: range.tz }
}

/** The surveys read together: one, or all of the same kind. */
export function surveysOf(query: any): { kind: SurveyKind; keys: string[]; surveys: SurveyDefinition[] } {
    const all = state.config.surveys ?? []
    if (!all.length) throw new ReportError(404, 'no_survey')
    const asked = typeof query?.survey === 'string' && query.survey ? all.find((s) => s.key === query.survey) : null
    if (query?.survey && !asked) throw new ReportError(404, 'unknown_survey')
    // Scores of two kinds do not add up: "all" means every survey of the first one's kind.
    const kind = asked ? kindOf(asked) : kindOf(all[0])
    const surveys = asked ? [asked] : all.filter((s) => kindOf(s) === kind)
    return { kind, keys: surveys.map((s) => s.key), surveys }
}

/** Promoters 9–10, passives 7–8, detractors 0–6 for NPS; satisfied 4–5, neutral 3, unhappy 1–2 for CSAT. */
function groups(kind: SurveyKind) {
    return kind === 'nps'
        ? { high: 'score >= 9', mid: 'score BETWEEN 7 AND 8', low: 'score <= 6' }
        : { high: 'score >= 4', mid: 'score = 3', low: 'score <= 2' }
}

/** NPS: % promoters − % detractors, −100 to 100. CSAT: % satisfied, 0 to 100. */
function scoreOf(kind: SurveyKind, t: { answered: number; high: number; low: number }): number | null {
    if (!t.answered) return null
    const value = kind === 'nps' ? ((t.high - t.low) / t.answered) * 100 : (t.high / t.answered) * 100
    return Math.round(value)
}

async function totals(kind: SurveyKind, keys: string[], range: Range, prefix = '') {
    const g = groups(kind)
    // Asked: questions that opened in the period. Answered: answers given in it.
    const [asked] = await rows(
        `SELECT count(*)::int AS asked,
                count(*) FILTER (WHERE status = 'answered')::int AS answered_of_asked,
                count(*) FILTER (WHERE status = 'dismissed')::int AS dismissed,
                count(*) FILTER (WHERE status = 'expired')::int AS expired,
                count(*) FILTER (WHERE status = 'pending')::int AS pending
           FROM ${TABLE} WHERE survey IN (:keys) AND ${within('available_at', prefix)}`,
        { keys, ...params(range, prefix) }
    )
    const [answers] = await rows(
        `SELECT count(*)::int AS answered,
                count(*) FILTER (WHERE ${g.high})::int AS high,
                count(*) FILTER (WHERE ${g.mid})::int AS mid,
                count(*) FILTER (WHERE ${g.low})::int AS low,
                count(*) FILTER (WHERE comment IS NOT NULL AND comment <> '')::int AS comments,
                COALESCE(avg(score), 0)::float AS average
           FROM ${TABLE} WHERE survey IN (:keys) AND status = 'answered' AND ${within('answered_at', prefix)}`,
        { keys, ...params(range, prefix) }
    )
    return {
        ...asked,
        ...answers,
        score: scoreOf(kind, answers),
        // Of the questions that closed, how many got an answer: still-open ones are left out.
        response_rate: asked.asked - asked.pending > 0 ? asked.answered_of_asked / (asked.asked - asked.pending) : null,
    }
}

export async function overview(query: any) {
    const range = rangeOf(query)
    const { kind, keys, surveys } = surveysOf(query)
    const scale = scaleOf(kind)
    const g = groups(kind)

    const [current, previous, distribution, trend, subjects] = await Promise.all([
        totals(kind, keys, range),
        totals(kind, keys, previousOf(range), 'p_'),
        rows(
            `SELECT score, count(*)::int AS n FROM ${TABLE}
              WHERE survey IN (:keys) AND status = 'answered' AND ${within('answered_at')}
              GROUP BY score`,
            { keys, ...params(range) }
        ),
        // Weeks start on Monday, where the project lives.
        rows(
            `SELECT to_char(date_trunc('week', answered_at AT TIME ZONE :tz), 'YYYY-MM-DD') AS week,
                    count(*)::int AS answered,
                    count(*) FILTER (WHERE ${g.high})::int AS high,
                    count(*) FILTER (WHERE ${g.low})::int AS low
               FROM ${TABLE}
              WHERE survey IN (:keys) AND status = 'answered' AND ${within('answered_at')}
              GROUP BY 1 ORDER BY 1`,
            { keys, ...params(range) }
        ),
        // What people were asked about, worst first: where to look.
        rows(
            `SELECT subject_label AS label, count(*)::int AS answered,
                    count(*) FILTER (WHERE ${g.high})::int AS high,
                    count(*) FILTER (WHERE ${g.low})::int AS low,
                    avg(score)::float AS average
               FROM ${TABLE}
              WHERE survey IN (:keys) AND status = 'answered' AND subject_label IS NOT NULL AND ${within('answered_at')}
              GROUP BY subject_label HAVING count(*) >= 3
              ORDER BY avg(score) ASC LIMIT 8`,
            { keys, ...params(range) }
        ),
    ])

    const byScore = new Map(distribution.map((d: any) => [Number(d.score), d.n]))
    return {
        range,
        kind,
        surveys: surveys.map((s) => s.key),
        scale,
        current,
        previous,
        distribution: Array.from({ length: scale.max - scale.min + 1 }, (_, i) => ({ score: scale.min + i, count: byScore.get(scale.min + i) ?? 0 })),
        trend: trend.map((w: any) => ({ week: w.week, answered: w.answered, score: scoreOf(kind, w) })),
        subjects: subjects.map((s: any) => ({ label: s.label, answered: s.answered, score: scoreOf(kind, s), average: s.average })),
    }
}

const PAGE = 30

/** `<answered_at, to the microsecond>_<id>`: where the last page stopped. */
const CURSOR = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z)_(\d+)$/

function cursorOf(value: unknown): { at: string; id: number } | null {
    const match = typeof value === 'string' ? CURSOR.exec(value) : null
    return match ? { at: match[1], id: Number(match[2]) } : null
}

/**
 * What people wrote, the latest answers first; `group` keeps the high, middle
 * or low scores, `all=1` the answers without a comment too. `limit` up to 50.
 */
export async function comments(query: any) {
    const range = rangeOf(query)
    const { kind, keys } = surveysOf(query)
    const g = groups(kind)
    const group = query?.group === 'high' || query?.group === 'mid' || query?.group === 'low' ? (query.group as 'high' | 'mid' | 'low') : null
    const before = cursorOf(query?.before)
    const withText = query?.all !== '1'
    const limit = Math.min(Math.max(Number(query?.limit) || PAGE, 1), 50)

    const list = await rows(
        `SELECT id, survey, user_id, score, comment, subject_label, locale, platform, answered_at,
                to_char(answered_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at
           FROM ${TABLE}
          WHERE survey IN (:keys) AND status = 'answered' AND ${within('answered_at')}
            ${withText ? `AND comment IS NOT NULL AND comment <> ''` : ''}
            ${group ? `AND ${g[group]}` : ''}
            ${before ? 'AND (answered_at, id) < (CAST(:beforeAt AS timestamptz), :beforeId)' : ''}
          ORDER BY answered_at DESC, id DESC LIMIT ${limit + 1}`,
        { keys, beforeAt: before?.at ?? null, beforeId: before?.id ?? null, ...params(range) }
    )
    const page = list.slice(0, limit)
    const labels = await labelUsers(page.map((r: any) => r.user_id))
    const last: any = page[page.length - 1]
    return {
        kind,
        items: page.map(({ cursor_at, ...r }: any) => ({ ...r, user_label: labels[r.user_id] ?? null })),
        nextBefore: list.length > limit ? `${last.cursor_at}_${last.id}` : null,
    }
}

/** Everything one person was asked, for their page in the back-office. */
export async function userResponses(userId: number) {
    const list = await rows(
        `SELECT id, survey, status, score, comment, subject_label, available_at, answered_at
           FROM ${TABLE} WHERE user_id = :userId ORDER BY available_at DESC LIMIT 50`,
        { userId }
    )
    return list.map((r: any) => {
        const survey = state.config.surveys?.find((s) => s.key === r.survey)
        return { ...r, kind: survey ? kindOf(survey) : 'nps', title: survey?.title ?? r.survey }
    })
}

/** Names the users behind ids, the way the project names them. */
async function labelUsers(ids: number[]): Promise<Record<number, string>> {
    const unique = Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)))
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
        console.error('[ETHSurveyLeaf] Could not name users:', err?.message || err)
        return {}
    }
}
