import type { LeafSync } from '../../../components/sync/index.js'

// ──────────────────────────────────────────────────────────────────────────
// What a project can tell the survey leaf, and the defaults it falls back to.
// The surveys themselves are written in the back-office (table survey_forms):
// the project only declares the events they can be asked after — an
// appointment done, a ticket closed — and what each one can be narrowed to.
// ──────────────────────────────────────────────────────────────────────────

/** A text in each language the app speaks: `{ en: '…', ar: '…' }`, or one text for all. */
export type Localized = string | Record<string, string>

/**
 * `nps`: "How likely are you to recommend us?", 0 to 10.
 * `csat`: "How satisfied are you?", 1 to 5.
 * A survey is of the kind of its first question, which gives its score.
 */
export type SurveyKind = 'nps' | 'csat'

/** A rating (`nps`, `csat`), one choice, several choices, or a written answer. */
export type QuestionType = SurveyKind | 'choice' | 'multiple' | 'text'

export const QUESTION_TYPES: QuestionType[] = ['nps', 'csat', 'choice', 'multiple', 'text']

export interface QuestionOption {
    /** Stable id, stored in the answers: renaming the option keeps them. */
    id: string
    label: Record<string, string>
}

/** One question of a survey, as the back-office writes it. */
export interface SurveyQuestion {
    /** Stable id, the key of its answer: `q1`. */
    id: string
    type: QuestionType
    label: Record<string, string>
    /** The first question always is: it gives the score. */
    required?: boolean
    /** `choice`, `multiple`. */
    options?: QuestionOption[]
    /** `nps`, `csat`: the words at both ends of the scale. */
    lowLabel?: Record<string, string>
    highLabel?: Record<string, string>
}

/** A narrowing value of an event: a scheduler, a ticket type. */
export interface SurveyTargetOption {
    value: string
    label: string
    /** Shown beside it, to tell two alike apart: the project. */
    hint?: string
}

/**
 * Something that happens in the project after which a survey can be asked: a
 * row of a model that changes. Read on the model's hooks, so a change made
 * from the back-office, the app or a Salesforce sync all count.
 */
export interface SurveyEvent {
    /** Stable id, stored on the surveys: `booking_completed`. */
    key: string
    /** What the back-office calls it: "A booking is completed". */
    label: string
    /** More about it, under the choice. */
    description?: string
    /** Sequelize model name: `BookingAppointment`. */
    model: string
    /** Watch new rows, changed rows, or both. Default `update`. */
    on?: 'create' | 'update' | 'both'
    /**
     * Whether this change is the event. `previous(field)` is the value before
     * the change (undefined on a new row).
     */
    when: (row: any, previous: (field: string) => any) => boolean
    /** Who is asked: the user id on the row. */
    user: (row: any) => number | null | undefined | Promise<number | null | undefined>
    /**
     * What the answer is about: "Handover visit". The back-office scores
     * answers per subject, so keep it generic (a kind of visit, a project), not
     * one per row — the date is already on every answer.
     */
    subject?: (row: any) => string | null | undefined | Promise<string | null | undefined>
    /**
     * What a survey can be narrowed to: after the bookings of some schedulers
     * only, after some ticket types only. Without it, a survey of this event
     * is asked after every one.
     */
    target?: {
        /** "Scheduler", "Ticket type". */
        label: string
        /** The row's value: the scheduler's id, the ticket's type. */
        value: (row: any) => string | number | null | undefined | Promise<string | number | null | undefined>
        /** The values the back-office offers. */
        options: () => SurveyTargetOption[] | Promise<SurveyTargetOption[]>
        /**
         * The back-office collection whose records these values are (their id):
         * `schedulers`. A record's page then shows the survey asked after it,
         * with a link to write one for it.
         */
        collection?: string
    }
}

export interface SurveyInvitationInfo {
    id: number
    survey: string
    user_id: number
    subject_label: string | null
}

/** A survey as the leaf hands it to the project (`notify`). */
export interface SurveyInfo {
    key: string
    title: string
    kind: SurveyKind
    event: string | null
}

export interface SurveyUsersConfig {
    /** Back-office collection the user ids link to. Default `users`. */
    collection?: string
    /** Sequelize model holding the users, to name them. Default `User`. */
    model?: string
    /** Joined with spaces to name someone. Default `['first_name', 'last_name']`. */
    name?: string[]
    /** Used when the name comes out empty. Default `['email', 'phone_number', 'phone']`. */
    fallback?: string[]
}

export interface ETHSurveyLeafConfig {
    events?: SurveyEvent[]
    /** The languages the questions are written in, the default one first. Default `[defaultLocale]`. */
    locales?: string[]
    /** Days during which someone asked once is not asked again, whatever the survey. Default 30. */
    cooldownDays?: number
    /** Language used when the app does not say one, and when a text lacks the asked one. Default `en`. */
    defaultLocale?: string
    /** Calendar days and weeks are cut in this time zone. Default `UTC`. */
    timezone?: string
    /** Leaves people out: staff, test accounts. */
    excludeUser?: (user: any) => boolean
    /**
     * Tells the person a question is waiting, once it opens: a push, say.
     * Without it, the app finds the question the next time it asks for one.
     */
    notify?: (invitation: SurveyInvitationInfo, survey: SurveyInfo) => Promise<void> | void
    /**
     * The hours `notify` runs, in `timezone`: `[9, 21]` tells people from 9:00
     * to 21:00, and a question opening at night is told the next morning.
     * Default any hour.
     */
    notifyHours?: [number, number]
    /**
     * A question is closed: answered, put away, or expired. Lets the project
     * take back what `notify` left (the line in the app's inbox).
     */
    closed?: (invitation: SurveyInvitationInfo, status: Exclude<SurveyStatus, 'pending'>) => Promise<void> | void
    users?: SurveyUsersConfig
    /**
     * Sends each answer to an outside system (a survey record in Salesforce…)
     * with the project's own code: once answered, then again if it changes.
     * Retries, errors and "Resend" are in the back-office's Outgoing syncs.
     */
    sync?: LeafSync
}

export const RESPONSES_COLLECTION = 'survey-responses'
/** Not `surveys`: that is the back-office's own page, where they are read. */
export const FORMS_COLLECTION = 'survey-forms'
export const APP_PREFIX = '/surveys'

export const STATUSES = ['pending', 'answered', 'dismissed', 'expired'] as const
export type SurveyStatus = (typeof STATUSES)[number]

/** At most this many questions in a survey, and options in a question: it is read on a phone. */
export const MAX_QUESTIONS = 10
export const MAX_OPTIONS = 12

export function isRating(type: unknown): type is SurveyKind {
    return type === 'nps' || type === 'csat'
}

/** The kind of a survey: the one of its first question, the rating that scores it. */
export function kindOf(questions: unknown): SurveyKind {
    const first = Array.isArray(questions) ? questions[0] : null
    return first?.type === 'csat' ? 'csat' : 'nps'
}

export function scaleOf(kind: SurveyKind): { min: number; max: number } {
    return kind === 'csat' ? { min: 1, max: 5 } : { min: 0, max: 10 }
}

export function usersOptions(config: ETHSurveyLeafConfig): Required<SurveyUsersConfig> {
    return {
        collection: config.users?.collection ?? 'users',
        model: config.users?.model ?? 'User',
        name: config.users?.name ?? ['first_name', 'last_name'],
        fallback: config.users?.fallback ?? ['email', 'phone_number', 'phone'],
    }
}

export function defaultLocaleOf(config: ETHSurveyLeafConfig): string {
    return config.defaultLocale ?? config.locales?.[0] ?? 'en'
}

/** The languages a question is written in, the default one first. */
export function localesOf(config: ETHSurveyLeafConfig): string[] {
    const fallback = defaultLocaleOf(config)
    return [fallback, ...(config.locales ?? []).filter((l) => l !== fallback)]
}

/** The text in `locale`, else in the default language, else the first one written. */
export function localize(text: Localized | undefined | null, locale: string, fallback: string): string | null {
    if (text === undefined || text === null) return null
    if (typeof text === 'string') return text.trim() || null
    const pick = (l: string) => (typeof text[l] === 'string' && text[l].trim() ? text[l].trim() : null)
    return pick(locale) ?? pick(fallback) ?? Object.keys(text).map(pick).find((t) => t) ?? null
}

/** `ar-SA`, `AR`, `ar_SA` → `ar`. */
export function languageOf(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const lang = value.split(',')[0].trim().split(/[-_;]/)[0].toLowerCase()
    return /^[a-z]{2,3}$/.test(lang) ? lang : null
}
