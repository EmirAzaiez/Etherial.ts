import etherial, { Etherial } from 'etherial'
import * as path from 'path'
import { fileURLToPath } from 'url'

import { runExclusive } from '../../components/database/lock.js'
import { SurveyResponse } from './models/SurveyResponse.js'
import { InviteInput, InviteResult, attachTriggers, expireDue, invite, notifyDue } from './services/invitations.js'
import { state } from './services/state.js'
import { ETHSurveyLeafConfig, RESPONSES_COLLECTION, STATUSES, kindOf, localize, usersOptions } from './services/options.js'

export * from './services/options.js'
export type { InviteInput, InviteResult } from './services/invitations.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * ETHSurveyLeaf — satisfaction surveys in the app, scored in the back-office.
 *
 * A survey is one question (NPS 0–10, or satisfaction 1–5) and an optional
 * comment. People are invited by a trigger — an appointment marked as done, a
 * ticket closed — or by the project's code. The app asks for the question
 * waiting (`GET /surveys/pending`), shows it, and posts the answer. The
 * back-office's Surveys page reads the score, the response rate, the trend
 * and what people wrote. Postgres only.
 */
export default class ETHSurveyLeaf {
    readonly etherial_module_name = 'eth_survey_leaf'

    public config: ETHSurveyLeafConfig
    private routes: { route: string; methods: string[] }[] = []

    constructor(config: ETHSurveyLeafConfig = {}) {
        this.config = config
        state.config = config
        this.routes.push(
            { route: path.join(__dirname, 'routes/app'), methods: ['pending', 'answer', 'dismiss'] },
            { route: path.join(__dirname, 'routes/admin'), methods: ['overview', 'comments', 'user'] }
        )
        const keys = (config.surveys ?? []).map((s) => s.key)
        const twice = keys.filter((k, i) => keys.indexOf(k) !== i)
        if (twice.length) throw new Error(`[ETHSurveyLeaf] Two surveys share the key "${twice[0]}"`)
    }

    /** Lifecycle: beforeRun — hand the table to the database before it syncs. */
    beforeRun({ database }: Etherial) {
        database?.addModels([SurveyResponse] as any)
    }

    /** Lifecycle: run — routes, and the clock that opens and closes questions. */
    run({ http }: Etherial) {
        http?.routes_leafs?.push(...this.routes)
        const tick = async () => {
            try {
                // One server per minute: the rows are claimed one by one, so a
                // second server would only scan the same table for nothing.
                await runExclusive('eth_survey.tick', { ttlMs: 50 * 1000, release: false }, async () => {
                    await expireDue()
                    await notifyDue()
                })
            } catch (err: any) {
                console.error('[ETHSurveyLeaf] Could not open or close questions:', err?.message || err)
            }
        }
        // Not at boot: the table may not be synced yet. The first turn of the
        // interval is a minute away (a setTimeout as well ran it twice then).
        setInterval(tick, 60 * 1000).unref?.()

        const count = this.config.surveys?.length ?? 0
        console.log(`[ETHSurveyLeaf] ${count ? `${count} survey${count > 1 ? 's' : ''}, ${this.config.triggers?.length ?? 0} trigger(s)` : 'No survey yet: list them in `surveys`'}`)
    }

    /** Lifecycle: afterRun — every model exists: hook the triggers, tell the back-office. */
    afterRun() {
        if (this.config.triggers?.length) attachTriggers(this.config.triggers)

        const adminLeaf = (etherial as any).eth_admin_leaf
        if (!adminLeaf?.registerCollection) return
        const users = usersOptions(this.config)
        const hasUsers = !!adminLeaf.getCollection?.(users.collection)
        if (!adminLeaf.getCollection(RESPONSES_COLLECTION)) adminLeaf.registerCollection(responsesCollection(this.config, users.collection, hasUsers))

        const fallback = this.config.defaultLocale ?? 'en'
        adminLeaf.setFeature?.('surveys', {
            collection: RESPONSES_COLLECTION,
            usersCollection: hasUsers ? users.collection : null,
            timezone: this.config.timezone || 'UTC',
            cooldownDays: this.config.cooldownDays ?? 30,
            surveys: (this.config.surveys ?? []).map((s) => ({
                key: s.key,
                title: s.title,
                kind: kindOf(s),
                question: localize(s.question, fallback, fallback),
                description: s.description ?? null,
                delayMinutes: s.delayMinutes ?? 0,
                expiresAfterDays: s.expiresAfterDays ?? 7,
                triggers: (this.config.triggers ?? []).filter((t) => t.survey === s.key).map((t) => t.model),
            })),
        })
    }

    /** Asks someone a survey from the project's own code. */
    invite(input: InviteInput): Promise<InviteResult> {
        return invite(input)
    }

    commands() {
        return [
            {
                command: 'purge',
                description: 'Delete every survey question and answer (asks nothing: for test databases)',
                action: async () => {
                    const count = await SurveyResponse.destroy({ where: {}, truncate: true } as any)
                    return { success: true, message: `Purged surveys (${count ?? 0} rows)` }
                },
            },
        ]
    }
}

const STATUS_OPTIONS: { value: (typeof STATUSES)[number]; label: string; color: string }[] = [
    { value: 'pending', label: 'Waiting', color: 'blue' },
    { value: 'answered', label: 'Answered', color: 'green' },
    { value: 'dismissed', label: 'Not now', color: 'gray' },
    { value: 'expired', label: 'Expired', color: 'gray' },
]

function responsesCollection(config: ETHSurveyLeafConfig, usersCollection: string, hasUsers: boolean) {
    return {
        name: RESPONSES_COLLECTION,
        model: SurveyResponse,
        crud: ['list', 'show'] as ('list' | 'show')[],
        exportable: true,
        meta: {
            label: 'Survey answer',
            labelPlural: 'Survey answers',
            icon: 'MessageSquareHeart',
            description: 'Every survey question put to someone, and their answer',
            group: 'System',
            order: 96,
            // Read through the Surveys page; listed for exports and for the role permissions.
            hidden: true,
        },
        fields: [
            { name: 'id', type: 'integer' as const, readonly: true, sortable: true },
            {
                name: 'survey',
                type: 'select' as const,
                label: 'Survey',
                filterable: true,
                options: (config.surveys ?? []).map((s) => ({ value: s.key, label: s.title })),
            },
            hasUsers
                ? { name: 'user_id', type: 'relation' as const, label: 'Asked', filterable: true, relation: { collection: usersCollection, displayField: 'email' } }
                : { name: 'user_id', type: 'integer' as const, label: 'Asked', filterable: true },
            { name: 'status', type: 'select' as const, label: 'Status', filterable: true, options: STATUS_OPTIONS },
            { name: 'score', type: 'integer' as const, label: 'Score', sortable: true, filterable: true },
            { name: 'comment', type: 'text' as const, label: 'Comment', searchable: true },
            { name: 'subject_label', type: 'string' as const, label: 'About', searchable: true },
            { name: 'subject_type', type: 'string' as const, label: 'Asked after' },
            { name: 'subject_id', type: 'string' as const, label: 'Record' },
            { name: 'locale', type: 'string' as const, label: 'Language', filterable: true },
            { name: 'platform', type: 'string' as const, label: 'Platform', filterable: true },
            { name: 'app_version', type: 'string' as const, label: 'App version' },
            { name: 'available_at', type: 'datetime' as const, label: 'Asked', sortable: true, filterable: true },
            { name: 'answered_at', type: 'datetime' as const, label: 'Answered', sortable: true, filterable: true },
            { name: 'expires_at', type: 'datetime' as const, label: 'Closes' },
            { name: 'notified_at', type: 'datetime' as const, label: 'Told' },
        ],
        views: {
            list: {
                fields: ['available_at', 'survey', 'user_id', 'status', 'score', 'comment', 'subject_label'],
                sort: { field: 'available_at', direction: 'desc' as const },
                search: ['comment', 'subject_label'],
                filters: ['survey', 'status', 'user_id', 'available_at'],
            },
            show: {
                layout: 'sections' as const,
                sections: [
                    { title: 'Answer', fields: ['survey', 'status', 'score', 'comment', 'answered_at'] },
                    { title: 'Asked', fields: ['user_id', 'subject_label', 'subject_type', 'subject_id', 'available_at', 'expires_at', 'notified_at'] },
                    { title: 'From', fields: ['locale', 'platform', 'app_version'] },
                ],
            },
        },
    }
}
