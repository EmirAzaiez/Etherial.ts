// ──────────────────────────────────────────────────────────────────────────
// What the back-office's Surveys page reads: the score, how many answered,
// how it moves week by week, and what people wrote. Postgres only.
// ──────────────────────────────────────────────────────────────────────────

import etherial from 'etherial'
import { QueryTypes } from 'sequelize'

import type { SurveyForm } from '../models/SurveyForm.js'
import { state } from './state.js'
import { allSurveys } from './forms.js'
import { SurveyKind, SurveyQuestion, defaultLocaleOf, isRating, kindOf, localize, scaleOf, usersOptions } from './options.js'

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

/** The surveys read together: one, or all of the same kind. Those turned off too: their answers stay. */
export async function surveysOf(query: any): Promise<{ kind: SurveyKind; keys: string[]; surveys: SurveyForm[]; one: SurveyForm | null }> {
    const all = await allSurveys()
    if (!all.length) throw new ReportError(404, 'no_survey')
    const asked = typeof query?.survey === 'string' && query.survey ? all.find((s) => s.key === query.survey) : null
    if (query?.survey && !asked) throw new ReportError(404, 'unknown_survey')
    // Scores of two kinds do not add up: "all" means every survey of the first one's kind.
    const kind = kindOf((asked ?? all[0]).questions)
    const surveys = asked ? [asked] : all.filter((s) => kindOf(s.questions) === kind)
    return { kind, keys: surveys.map((s) => s.key), surveys, one: asked ?? null }
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
    const { kind, keys, surveys, one } = await surveysOf(query)
    const scale = scaleOf(kind)
    const g = groups(kind)

    const [current, previous, distribution, trend, subjects, questions] = await Promise.all([
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
        // The other questions, read one survey at a time: two surveys do not ask the same ones.
        one ? Promise.all((one.questions ?? []).slice(1).map((q) => questionReport(one.key, q, range))) : Promise.resolve([]),
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
        questions,
    }
}

/**
 * How a question after the first was answered: the average of a rating, the
 * count of each choice, the latest written answers. Choices taken off the
 * survey since are kept, with no label.
 */
async function questionReport(key: string, q: SurveyQuestion, range: Range) {
    const fallback = defaultLocaleOf(state.config)
    const base = `FROM ${TABLE} WHERE survey = :key AND status = 'answered' AND ${within('answered_at')}`
    const replacements = { key, qid: q.id, ...params(range) }
    const head = { id: q.id, type: q.type, label: localize(q.label, fallback, fallback) }

    if (isRating(q.type)) {
        const [r] = await rows(
            `SELECT count(*)::int AS answered, avg((answers ->> :qid)::numeric)::float AS average
               ${base} AND jsonb_typeof(answers -> :qid) = 'number'`,
            replacements
        )
        return { ...head, answered: r.answered, average: r.average, scale: scaleOf(q.type) }
    }
    if (q.type === 'choice' || q.type === 'multiple') {
        const [counts, [total]] = await Promise.all([
            q.type === 'choice'
                ? rows(`SELECT answers ->> :qid AS value, count(*)::int AS n ${base} AND jsonb_typeof(answers -> :qid) = 'string' GROUP BY 1`, replacements)
                : rows(
                      `SELECT value, count(*)::int AS n
                         FROM ${TABLE}, jsonb_array_elements_text(answers -> :qid) AS value
                        WHERE survey = :key AND status = 'answered' AND jsonb_typeof(answers -> :qid) = 'array' AND ${within('answered_at')}
                        GROUP BY 1`,
                      replacements
                  ),
            rows(`SELECT count(*)::int AS answered ${base} AND (answers -> :qid) IS NOT NULL`, replacements),
        ])
        const byId = new Map(counts.map((c: any) => [String(c.value), c.n]))
        const known = (q.options ?? []).map((o) => ({ id: o.id, label: localize(o.label, fallback, fallback), count: byId.get(o.id) ?? 0 }))
        const gone = [...byId.entries()].filter(([id]) => !(q.options ?? []).some((o) => o.id === id)).map(([id, count]) => ({ id, label: null, count }))
        return { ...head, answered: total.answered, options: [...known, ...gone] }
    }
    const [[total], latest] = await Promise.all([
        rows(`SELECT count(*)::int AS answered ${base} AND jsonb_typeof(answers -> :qid) = 'string'`, replacements),
        rows(
            `SELECT id, answers ->> :qid AS text, answered_at ${base} AND jsonb_typeof(answers -> :qid) = 'string'
              ORDER BY answered_at DESC, id DESC LIMIT 5`,
            replacements
        ),
    ])
    return { ...head, answered: total.answered, texts: latest }
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
    const { kind, keys } = await surveysOf(query)
    const g = groups(kind)
    const group = query?.group === 'high' || query?.group === 'mid' || query?.group === 'low' ? (query.group as 'high' | 'mid' | 'low') : null
    const before = cursorOf(query?.before)
    const withText = query?.all !== '1'
    const limit = Math.min(Math.max(Number(query?.limit) || PAGE, 1), 50)

    const list = await rows(
        `SELECT id, survey, user_id, score, comment, answers, subject_label, locale, platform, answered_at,
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
        `SELECT id, survey, status, score, comment, answers, subject_label, available_at, answered_at
           FROM ${TABLE} WHERE user_id = :userId ORDER BY available_at DESC LIMIT 50`,
        { userId }
    )
    const surveys = new Map((await allSurveys()).map((s) => [s.key, s]))
    return list.map((r: any) => {
        const survey = surveys.get(r.survey)
        return { ...r, kind: kindOf(survey?.questions), title: survey?.title ?? r.survey }
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
