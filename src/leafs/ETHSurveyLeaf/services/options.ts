// ──────────────────────────────────────────────────────────────────────────
// What a project can tell the survey leaf, and the defaults it falls back to.
// Nothing is asked of anyone until the project lists a survey and something
// invites people to it: a trigger, or its own code calling `invite()`.
// ──────────────────────────────────────────────────────────────────────────

/** A text in each language the app speaks: `{ en: '…', ar: '…' }`, or one text for all. */
export type Localized = string | Record<string, string>

/**
 * `nps`: "How likely are you to recommend us?", 0 to 10.
 * `csat`: "How satisfied are you?", 1 to 5.
 */
export type SurveyKind = 'nps' | 'csat'

export interface SurveyDefinition {
    /** Stable id, stored with every answer: `appointment`, `ticket_closed`. */
    key: string
    /** What the back-office calls it: "After an appointment". */
    title: string
    /** When it is asked, for the back-office: "Asked after an appointment is completed." */
    description?: string
    kind?: SurveyKind
    /** The one question, as the person reads it in the app. */
    question: Localized
    /** Asked under the score, optional to answer: "What is the main reason for your score?" */
    commentPrompt?: Localized
    /** Words at both ends of the scale: "Not likely" / "Very likely". */
    lowLabel?: Localized
    highLabel?: Localized
    /** Minutes between what happened and the question: let the visit end first. Default 0. */
    delayMinutes?: number
    /** Days the question stays open before it is dropped. Default 7. */
    expiresAfterDays?: number
}

/**
 * Asks a survey when a row of the project changes: an appointment marked as
 * done, a ticket closed. Read on the model's hooks, so a change made from the
 * back-office, the app or a Salesforce sync all count.
 */
export interface SurveyTrigger {
    survey: string
    /** Sequelize model name: `BookingAppointment`. */
    model: string
    /** Watch new rows, changed rows, or both. Default `update`. */
    on?: 'create' | 'update' | 'both'
    /**
     * Whether this change asks the question. `previous(field)` is the value
     * before the change (undefined on a new row).
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
}

export interface SurveyInvitationInfo {
    id: number
    survey: string
    user_id: number
    subject_label: string | null
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
    surveys?: SurveyDefinition[]
    triggers?: SurveyTrigger[]
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
    notify?: (invitation: SurveyInvitationInfo, survey: SurveyDefinition) => Promise<void> | void
    users?: SurveyUsersConfig
}

export const RESPONSES_COLLECTION = 'survey-responses'
export const APP_PREFIX = '/surveys'

export const STATUSES = ['pending', 'answered', 'dismissed', 'expired'] as const
export type SurveyStatus = (typeof STATUSES)[number]

export function kindOf(survey: SurveyDefinition): SurveyKind {
    return survey.kind === 'csat' ? 'csat' : 'nps'
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

/** The text in `locale`, else in the default language, else the first one written. */
export function localize(text: Localized | undefined, locale: string, fallback: string): string | null {
    if (text === undefined || text === null) return null
    if (typeof text === 'string') return text
    return text[locale] ?? text[fallback] ?? Object.values(text)[0] ?? null
}

/** `ar-SA`, `AR`, `ar_SA` → `ar`. */
export function languageOf(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const lang = value.split(',')[0].trim().split(/[-_;]/)[0].toLowerCase()
    return /^[a-z]{2,3}$/.test(lang) ? lang : null
}
