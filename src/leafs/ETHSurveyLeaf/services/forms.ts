// ──────────────────────────────────────────────────────────────────────────
// The surveys written in the back-office: reading them, checking what is
// saved, picking the one an event asks, and reading the answers the app sends.
// ──────────────────────────────────────────────────────────────────────────

import { randomBytes } from 'crypto'
import { Op } from 'sequelize'

import { SurveyForm } from '../models/SurveyForm.js'
import { SurveyResponse } from '../models/SurveyResponse.js'
import { state } from './state.js'
import {
    MAX_OPTIONS,
    MAX_QUESTIONS,
    QUESTION_TYPES,
    QuestionOption,
    SurveyEvent,
    SurveyInfo,
    SurveyQuestion,
    SurveyTargetOption,
    defaultLocaleOf,
    isRating,
    kindOf,
    localesOf,
    localize,
    scaleOf,
} from './options.js'

const ID = /^[A-Za-z0-9_-]{1,32}$/
const MAX_DELAY_MINUTES = 30 * 24 * 60
const MAX_OPEN_DAYS = 90
const MAX_TARGETS = 500

export function eventOf(key: unknown): SurveyEvent | undefined {
    return typeof key === 'string' ? state.config.events?.find((e) => e.key === key) : undefined
}

export function surveyByKey(key: string): Promise<SurveyForm | null> {
    return SurveyForm.findOne({ where: { key } })
}

export function allSurveys(): Promise<SurveyForm[]> {
    return SurveyForm.findAll({ order: [['id', 'ASC']] })
}

export async function activeKeys(): Promise<string[]> {
    const forms = await SurveyForm.findAll({ where: { active: true }, attributes: ['key'] })
    return forms.map((f) => f.key)
}

export function infoOf(form: SurveyForm): SurveyInfo {
    return { key: form.key, title: form.title, kind: kindOf(form.questions), event: form.event }
}

/** What the back-office reads of a survey: the Surveys page, its tabs, its forms. */
export function adminInfoOf(form: SurveyForm) {
    const fallback = defaultLocaleOf(state.config)
    const event = eventOf(form.event)
    return {
        id: form.id,
        key: form.key,
        title: form.title,
        description: form.description ?? null,
        active: !!form.active,
        kind: kindOf(form.questions),
        question: localize(form.questions?.[0]?.label, fallback, fallback),
        event: form.event ?? null,
        eventLabel: event?.label ?? null,
        targetLabel: event?.target?.label ?? null,
        targets: form.targets ?? [],
        questions: form.questions ?? [],
        delayMinutes: form.delay_minutes,
        expiresAfterDays: form.expires_after_days,
    }
}

/**
 * The survey asked after this event, for this value of it (a scheduler, a
 * ticket type): the one narrowed to it, else the one asked after every one.
 * Saving checks that no two active surveys of an event overlap.
 */
export async function surveyFor(event: string, target: string | null): Promise<SurveyForm | null> {
    const forms = await SurveyForm.findAll({ where: { event, active: true }, order: [['id', 'ASC']] })
    const narrowed = target === null ? undefined : forms.find((f) => (f.targets ?? []).some((t) => String(t.value) === target))
    return narrowed ?? forms.find((f) => !(f.targets ?? []).length) ?? null
}

// ── Saving from the back-office ───────────────────────────────────────────

/** Its message is shown in the back-office's form, as the admin leaf does with a hook's errors. */
export class SurveyFormError extends Error {}

function languageName(locale: string): string {
    try {
        return new Intl.DisplayNames(['en'], { type: 'language' }).of(locale) ?? locale
    } catch {
        return locale
    }
}

function parsed(value: unknown): unknown {
    if (typeof value !== 'string') return value
    try {
        return JSON.parse(value)
    } catch {
        return null
    }
}

/** A text in the survey's languages, empty ones left out. */
function texts(value: unknown, max: number): Record<string, string> {
    const locales = localesOf(state.config)
    const out: Record<string, string> = {}
    if (typeof value === 'string') {
        if (value.trim()) out[locales[0]] = value.trim().slice(0, max)
        return out
    }
    if (!value || typeof value !== 'object') return out
    for (const locale of locales) {
        const text = (value as Record<string, unknown>)[locale]
        if (typeof text === 'string' && text.trim()) out[locale] = text.trim().slice(0, max)
    }
    return out
}

/**
 * The id kept when it is a fine one not used yet, a new one otherwise. New
 * ones are random, never `q3` again: a question taken off keeps its answers,
 * and the one added after it must not inherit them.
 */
function idFor(wanted: unknown, prefix: string, taken: Set<string>): string {
    if (typeof wanted === 'string' && ID.test(wanted) && !taken.has(wanted)) {
        taken.add(wanted)
        return wanted
    }
    let id: string
    do id = `${prefix}${randomBytes(4).toString('hex')}`
    while (taken.has(id))
    taken.add(id)
    return id
}

function optionsOf(value: unknown, n: number): QuestionOption[] {
    const fallback = defaultLocaleOf(state.config)
    const list = Array.isArray(value) ? value : []
    const taken = new Set<string>()
    const out: QuestionOption[] = []
    list.forEach((option: any) => {
        const label = texts(option?.label, 200)
        // An empty line left at the end of the list is not a choice.
        if (!Object.keys(label).length) return
        if (!label[fallback]) throw new SurveyFormError(`Question ${n}, choice ${out.length + 1} needs its text in ${languageName(fallback)}.`)
        out.push({ id: idFor(option?.id, 'o', taken), label })
    })
    if (out.length < 2) throw new SurveyFormError(`Question ${n} needs at least two choices.`)
    if (out.length > MAX_OPTIONS) throw new SurveyFormError(`Question ${n} has ${MAX_OPTIONS} choices at most.`)
    return out
}

export function normalizeQuestions(value: unknown): SurveyQuestion[] {
    const list = parsed(value)
    if (!Array.isArray(list) || !list.length) throw new SurveyFormError('Add at least one question.')
    if (list.length > MAX_QUESTIONS) throw new SurveyFormError(`A survey has ${MAX_QUESTIONS} questions at most: it is answered on a phone.`)
    const fallback = defaultLocaleOf(state.config)
    const taken = new Set<string>()
    return list.map((q: any, i: number) => {
        const n = i + 1
        if (!QUESTION_TYPES.includes(q?.type)) throw new SurveyFormError(`Question ${n}: choose what kind of answer it takes.`)
        if (i === 0 && !isRating(q.type)) {
            throw new SurveyFormError('The first question gives the survey its score: make it a 0–10 or a 1–5 rating.')
        }
        const label = texts(q.label, 500)
        if (!label[fallback]) throw new SurveyFormError(`Question ${n} needs its text in ${languageName(fallback)}.`)
        const out: SurveyQuestion = { id: idFor(q.id, 'q', taken), type: q.type, label, required: i === 0 || !!q.required }
        if (isRating(q.type)) {
            const low = texts(q.lowLabel, 60)
            const high = texts(q.highLabel, 60)
            if (Object.keys(low).length) out.lowLabel = low
            if (Object.keys(high).length) out.highLabel = high
        }
        if (q.type === 'choice' || q.type === 'multiple') out.options = optionsOf(q.options, n)
        return out
    })
}

function normalizeEvent(value: unknown): string | null {
    const events = state.config.events ?? []
    // A project without events asks its surveys from its own code (`invite()`).
    if (!events.length) return null
    const event = eventOf(value)
    if (!event) throw new SurveyFormError('Choose after what the survey is asked.')
    return event.key
}

function normalizeTargets(value: unknown, event: SurveyEvent | undefined): SurveyTargetOption[] {
    const list = parsed(value)
    if (!event?.target || !Array.isArray(list)) return []
    const seen = new Set<string>()
    const out: SurveyTargetOption[] = []
    for (const item of list) {
        const raw = item && typeof item === 'object' ? (item as any).value : item
        if (raw === undefined || raw === null || raw === '') continue
        const v = String(raw).slice(0, 255)
        if (seen.has(v)) continue
        seen.add(v)
        const label = item && typeof item === 'object' && typeof (item as any).label === 'string' && (item as any).label.trim() ? (item as any).label.trim().slice(0, 255) : v
        out.push({ value: v, label })
    }
    if (out.length > MAX_TARGETS) throw new SurveyFormError(`Choose ${MAX_TARGETS} values at most, or none to ask after every one.`)
    return out
}

/**
 * The names the values have now: a link from a record's page gives only its
 * id, and a scheduler may have been renamed. A value no longer offered keeps
 * the name it had.
 */
async function withCurrentLabels(targets: SurveyTargetOption[], event: SurveyEvent | undefined): Promise<SurveyTargetOption[]> {
    if (!targets.length || !event?.target) return targets
    let options: SurveyTargetOption[]
    try {
        options = await event.target.options()
    } catch {
        return targets
    }
    const names = new Map(options.map((o) => [String(o.value), o.label]))
    return targets.map((t) => ({ ...t, label: names.get(t.value) || t.label }))
}

function whole(value: unknown, fallback: number, min: number, max: number, name: string): number {
    if (value === undefined || value === null || value === '') return fallback
    const n = Number(value)
    if (!Number.isInteger(n) || n < min || n > max) throw new SurveyFormError(`${name} is a whole number from ${min} to ${max}.`)
    return n
}

function yes(value: unknown, fallback: boolean): boolean {
    if (value === undefined || value === null || value === '') return fallback
    return value === true || value === 'true' || value === 1 || value === '1'
}

/** One active survey per event and value: two would race on the same booking. */
async function checkOverlap(id: number | null, event: string | null, targets: SurveyTargetOption[], active: boolean) {
    const ev = eventOf(event)
    if (!active || !ev) return
    const others = await SurveyForm.findAll({
        where: { event: ev.key, active: true, ...(id ? { id: { [Op.ne]: id } } : {}) } as any,
        order: [['id', 'ASC']],
    })
    if (!targets.length) {
        const everyOne = others.find((o) => !(o.targets ?? []).length)
        if (!everyOne) return
        throw new SurveyFormError(
            ev.target
                ? `"${everyOne.title}" is already asked each time "${ev.label}". Narrow this survey to some ${ev.target.label.toLowerCase()} values, or turn "${everyOne.title}" off first.`
                : `"${everyOne.title}" is already asked each time "${ev.label}": turn it off first.`
        )
    }
    for (const target of targets) {
        const other = others.find((o) => (o.targets ?? []).some((t) => String(t.value) === target.value))
        if (other) throw new SurveyFormError(`${target.label} is already in "${other.title}": one survey is asked each time. Take it off one of them.`)
    }
}

/** Answers already given keep their meaning: the score's scale, and what each question took. */
async function checkAnswered(record: SurveyForm, questions: SurveyQuestion[]) {
    const answered = await SurveyResponse.count({ where: { survey: record.key, status: 'answered' } })
    if (!answered) return
    const before = record.questions ?? []
    const was = kindOf(before)
    if (kindOf(questions) !== was) {
        const scale = (k: 'nps' | 'csat') => (k === 'nps' ? '0–10' : '1–5')
        throw new SurveyFormError(
            `This survey already has ${answered} answer${answered > 1 ? 's' : ''} on a ${scale(was)} scale: its first question stays a ${scale(was)} rating. Create a new survey for a ${scale(kindOf(questions))} one.`
        )
    }
    const fallback = defaultLocaleOf(state.config)
    for (const q of questions) {
        const old = before.find((b) => b.id === q.id)
        if (old && old.type !== q.type) {
            throw new SurveyFormError(
                `"${localize(q.label, fallback, fallback)}" already has answers: the kind of answer it takes can't change. Add a new question instead.`
            )
        }
    }
}

/** `After a handover` → `after_a_handover`, free in both tables. */
async function freshKey(title: string): Promise<string> {
    const base =
        title
            .normalize('NFKD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 48) || 'survey'
    const like = { [Op.like]: `${base}%` }
    const [forms, responses] = await Promise.all([
        SurveyForm.findAll({ where: { key: like } as any, attributes: ['key'] }),
        SurveyResponse.findAll({ where: { survey: like } as any, attributes: ['survey'], group: ['survey'] }),
    ])
    const used = new Set([...forms.map((f) => f.key), ...responses.map((r) => r.survey)])
    if (!used.has(base)) return base
    let n = 2
    while (used.has(`${base}_${n}`)) n++
    return `${base}_${n}`
}

/** Everything the form saves, checked, from what it sends over what was there. */
async function prepared(record: SurveyForm | null, data: Record<string, any>) {
    const was: Record<string, any> = record ? record.get({ plain: true }) : {}
    const pick = (name: string) => (name in data ? data[name] : was[name])

    const title = typeof pick('title') === 'string' ? pick('title').trim().slice(0, 255) : ''
    if (!title) throw new SurveyFormError('Give the survey a title.')
    const event = normalizeEvent(pick('event'))
    const targets = await withCurrentLabels(normalizeTargets(pick('targets'), eventOf(event)), eventOf(event))
    const questions = normalizeQuestions(pick('questions'))
    const active = yes(pick('active'), true)
    const delay = whole(pick('delay_minutes'), 60, 0, MAX_DELAY_MINUTES, 'The delay, in minutes,')
    const open = whole(pick('expires_after_days'), 7, 1, MAX_OPEN_DAYS, 'The days it stays open')

    await checkOverlap(record?.id ?? null, event, targets, active)
    if (record) await checkAnswered(record, questions)

    const description = typeof pick('description') === 'string' && pick('description').trim() ? pick('description').trim() : null
    return { title, description, event, targets, questions, active, delay_minutes: delay, expires_after_days: open }
}

export async function prepareCreate(data: Record<string, any>) {
    const fields = await prepared(null, data)
    return { ...data, ...fields, key: await freshKey(fields.title) }
}

export async function prepareUpdate(record: SurveyForm, data: Record<string, any>) {
    // Set once: every answer points to it.
    delete data.key
    return { ...data, ...(await prepared(record, data)) }
}

export async function checkDelete(record: SurveyForm) {
    const asked = await SurveyResponse.count({ where: { survey: record.key } })
    if (asked) {
        throw new SurveyFormError(`"${record.title}" was asked ${asked} time${asked > 1 ? 's' : ''}: its answers stay with it. Turn it off instead.`)
    }
}

// ── The app ───────────────────────────────────────────────────────────────

/** The questions as the person reads them, in their language. */
export function questionsFor(form: SurveyForm, locale: string) {
    const fallback = defaultLocaleOf(state.config)
    return (form.questions ?? []).map((q) => ({
        id: q.id,
        type: q.type,
        label: localize(q.label, locale, fallback),
        required: !!q.required,
        ...(isRating(q.type)
            ? { scale: scaleOf(q.type), low_label: localize(q.lowLabel, locale, fallback), high_label: localize(q.highLabel, locale, fallback) }
            : {}),
        ...(q.options ? { options: q.options.map((o) => ({ id: o.id, label: localize(o.label, locale, fallback) })) } : {}),
    }))
}

function clip(value: unknown, max: number): string | null {
    if (value === undefined || value === null) return null
    const s = String(value).trim()
    return s ? s.slice(0, max) : null
}

export type ReadAnswers =
    | { ok: true; answers: Record<string, unknown>; score: number; comment: string | null }
    | { ok: false; error: string }

/**
 * `{ answers: { q1: 9, q2: 'o1', q3: ['o1', 'o3'], q4: 'text' } }`. The app
 * before several questions sends `{ score, comment }`: the score answers the
 * first question, the comment the first written one, and the questions it
 * never showed are not asked of it.
 */
export function readAnswers(form: SurveyForm, body: any): ReadAnswers {
    const questions = form.questions ?? []
    const first = questions[0]
    if (!first) return { ok: false, error: 'no_question' }
    const legacy = !(body?.answers && typeof body.answers === 'object' && !Array.isArray(body.answers))
    const given: Record<string, unknown> = legacy ? {} : body.answers
    const firstText = questions.find((q) => q.type === 'text')
    if (legacy) {
        given[first.id] = body?.score
        if (firstText) given[firstText.id] = body?.comment
    }

    const answers: Record<string, unknown> = {}
    for (const q of questions) {
        const raw = given[q.id]
        const empty = raw === undefined || raw === null || (typeof raw === 'string' && !raw.trim()) || (Array.isArray(raw) && !raw.length)
        if (empty) {
            if (q.required && (!legacy || q === first)) return { ok: false, error: `${q.id} is required` }
            continue
        }
        if (isRating(q.type)) {
            const { min, max } = scaleOf(q.type)
            const n = Number(raw)
            if (!Number.isInteger(n) || n < min || n > max) return { ok: false, error: `${q.id} must be a whole number from ${min} to ${max}` }
            answers[q.id] = n
        } else if (q.type === 'choice') {
            const id = String(raw)
            if (!(q.options ?? []).some((o) => o.id === id)) return { ok: false, error: `${q.id} is not one of its choices` }
            answers[q.id] = id
        } else if (q.type === 'multiple') {
            const ids = Array.from(new Set((Array.isArray(raw) ? raw : [raw]).map(String)))
            if (ids.some((id) => !(q.options ?? []).some((o) => o.id === id))) return { ok: false, error: `${q.id} is not one of its choices` }
            answers[q.id] = ids
        } else {
            answers[q.id] = clip(raw, 2000)
        }
    }
    const written = questions.find((q) => q.type === 'text' && typeof answers[q.id] === 'string')
    return {
        ok: true,
        answers,
        score: answers[first.id] as number,
        // Kept with the score for the Surveys page; an old app's comment too, with no written question to hold it.
        comment: written ? (answers[written.id] as string) : legacy && !firstText ? clip(body?.comment, 2000) : null,
    }
}
