// ──────────────────────────────────────────────────────────────────────────
// What a project can tell the assistant leaf, and the defaults it falls back
// to. Without an Anthropic key, or with the admin leaf's `features.ai` off,
// the leaf stays registered but answers 503: the back-office then hides the
// assistant.
// ──────────────────────────────────────────────────────────────────────────

import etherial from 'etherial'

/** The hidden back-office collection that lists every question asked. */
export const REQUESTS_COLLECTION = 'assistant-requests'

export type AssistantTask = 'ask' | 'summarize' | 'draft'
export const TASKS: AssistantTask[] = ['ask', 'summarize', 'draft']

export interface ETHAssistantLeafConfig {
    /** Anthropic API key. Default `process.env.ANTHROPIC_API_KEY`. */
    apiKey?: string
    /** Default `https://api.anthropic.com`. A proxy, or a fake server in tests. */
    baseUrl?: string
    models?: {
        /** Questions on the data: reads, counts, looks up. Default `claude-sonnet-5-5`. */
        smart?: string
        /** Summaries and drafted replies: one record, no look-up. Default `claude-haiku-5-5`. */
        fast?: string
    }
    /**
     * The collections it may read, on top of the staff member's own rights.
     * A list of names, or a test. Default: every collection, but its own log.
     */
    collections?: string[] | ((name: string) => boolean)
    /**
     * Fields it never reads, per collection: `{ users: ['national_id'] }`.
     * Secure fields, passwords, tokens, JSON and media are left out anyway.
     */
    excludeFields?: Record<string, string[]>
    /** Questions one person may ask per day. Default 200; 0 for no limit. */
    dailyLimit?: number
    /** "Today", "this month" and dates by the day are read in this zone. Default `UTC`. */
    timezone?: string
    /**
     * What the project is, in a few sentences, for the assistant to read
     * before each question: who the residents are, what a booking is.
     */
    instructions?: string
    /** Look-ups it may make for one question before it must answer. Default 8. */
    maxSteps?: number
    /**
     * Who may use it. Default: whoever may list `assistant-requests` — one box
     * in a role's permissions, which also shows them what was asked.
     */
    canUse?: (user: any) => boolean | Promise<boolean>
    /** Back-office collection the user ids link to, in the log. Default `users`. */
    usersCollection?: string
}

export const DEFAULT_MODELS = { smart: 'claude-sonnet-5-5', fast: 'claude-haiku-5-5' }

export function apiKeyOf(config: ETHAssistantLeafConfig): string | undefined {
    return config.apiKey || process.env.ANTHROPIC_API_KEY || undefined
}

/** The project turned the back-office's AI on: the admin leaf's `features.ai`. */
export function aiAllowed(): boolean {
    return !!(etherial as any).eth_admin_leaf?.aiEnabled?.()
}

export function modelsOf(config: ETHAssistantLeafConfig): { smart: string; fast: string } {
    return { smart: config.models?.smart || DEFAULT_MODELS.smart, fast: config.models?.fast || DEFAULT_MODELS.fast }
}

export function timezoneOf(config: ETHAssistantLeafConfig): string {
    return config.timezone || 'UTC'
}
