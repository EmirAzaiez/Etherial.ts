import etherial, { Etherial } from 'etherial'
import * as path from 'path'
import { fileURLToPath } from 'url'

import { runExclusive } from '../../components/database/lock.js'
import { registerSync, registerSyncAdmin, startSync } from '../../components/sync/index.js'
import { SurveyForm } from './models/SurveyForm.js'
import { SurveyResponse } from './models/SurveyResponse.js'
import { registerSurveyFormsAdmin } from './admin/forms.js'
import { InviteInput, InviteResult, attachEvents, expireDue, invite, notifyDue } from './services/invitations.js'
import { state } from './services/state.js'
import {
    ETHSurveyLeafConfig,
    FORMS_COLLECTION,
    RESPONSES_COLLECTION,
    STATUSES,
    defaultLocaleOf,
    localesOf,
    usersOptions,
} from './services/options.js'

export * from './services/options.js'
export type { InviteInput, InviteResult } from './services/invitations.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * ETHSurveyLeaf — satisfaction surveys in the app, scored in the back-office.
 *
 * The surveys are written in the back-office: a rating that scores them (NPS
 * 0–10, or satisfaction 1–5), then up to nine more questions — ratings,
 * choices, written answers — and the event they are asked after. The project
 * declares those events (an appointment done, a ticket closed) and what a
 * survey can be narrowed to (a scheduler, a ticket type). The app asks for the
 * survey waiting (`GET /surveys/pending`), shows it, and posts the answers.
 * The back-office's Surveys page reads the score, the response rate, the
 * trend and what people answered. Postgres only.
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
            { route: path.join(__dirname, 'routes/admin'), methods: ['list', 'targets', 'overview', 'stats', 'comments', 'user'] }
        )
        const keys = (config.events ?? []).map((e) => e.key)
        const twice = keys.filter((k, i) => keys.indexOf(k) !== i)
        if (twice.length) throw new Error(`[ETHSurveyLeaf] Two events share the key "${twice[0]}"`)
    }

    /**
     * Lifecycle: beforeRun — hand the tables to the database before it syncs,
     * and the surveys' form to the back-office before it sets up its history.
     */
    beforeRun({ database }: Etherial) {
        database?.addModels([SurveyForm, SurveyResponse] as any)
        registerSurveyFormsAdmin((etherial as any).eth_admin_leaf, this.config)
        if (this.config.sync) {
            registerSync(RESPONSES_COLLECTION, {
                ...this.config.sync,
                model: () => SurveyResponse,
                // An answer, not a question waiting or put away.
                track: { when: (response) => response.status === 'answered' },
            })
        }
    }

    /** Lifecycle: run — routes, and the clock that opens and closes questions. */
    run({ http }: Etherial) {
        http?.routes_leafs?.push(...this.routes)
        startSync()
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

        const count = this.config.events?.length ?? 0
        console.log(`[ETHSurveyLeaf] ${count ? `${count} event${count > 1 ? 's' : ''} to ask surveys after` : 'No event: surveys are asked from the code (invite)'}`)
    }

    /** Lifecycle: afterRun — every model exists: hook the events, tell the back-office. */
    afterRun() {
        if (this.config.events?.length) attachEvents(this.config.events)

        const adminLeaf = (etherial as any).eth_admin_leaf
        if (!adminLeaf?.registerCollection) return
        registerSyncAdmin(adminLeaf)
        const users = usersOptions(this.config)
        const hasUsers = !!adminLeaf.getCollection?.(users.collection)
        if (!adminLeaf.getCollection(RESPONSES_COLLECTION)) adminLeaf.registerCollection(responsesCollection(users.collection, hasUsers))

        // The surveys themselves change from the back-office: it reads them from `GET /admin/surveys`.
        adminLeaf.setFeature?.('surveys', {
            collection: RESPONSES_COLLECTION,
            formsCollection: FORMS_COLLECTION,
            usersCollection: hasUsers ? users.collection : null,
            timezone: this.config.timezone || 'UTC',
            cooldownDays: this.config.cooldownDays ?? 30,
            defaultLocale: defaultLocaleOf(this.config),
            locales: localesOf(this.config),
            events: (this.config.events ?? []).map((e) => ({
                key: e.key,
                label: e.label,
                description: e.description ?? null,
                target: e.target ? { label: e.target.label, collection: e.target.collection ?? null } : null,
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
                description: 'Delete every survey question put to someone and its answer, the surveys staying (asks nothing: for test databases)',
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

function responsesCollection(usersCollection: string, hasUsers: boolean) {
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
            // Its key: the surveys are written in the back-office, after the boot.
            { name: 'survey', type: 'string' as const, label: 'Survey', filterable: true },
            hasUsers
                ? { name: 'user_id', type: 'relation' as const, label: 'Asked', filterable: true, relation: { collection: usersCollection, displayField: 'email' } }
                : { name: 'user_id', type: 'integer' as const, label: 'Asked', filterable: true },
            { name: 'status', type: 'select' as const, label: 'Status', filterable: true, options: STATUS_OPTIONS },
            { name: 'score', type: 'integer' as const, label: 'Score', sortable: true, filterable: true },
            { name: 'comment', type: 'text' as const, label: 'Comment', searchable: true },
            { name: 'answers', type: 'json' as const, label: 'Answers' },
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
                    { title: 'Answer', fields: ['survey', 'status', 'score', 'comment', 'answers', 'answered_at'] },
                    { title: 'Asked', fields: ['user_id', 'subject_label', 'subject_type', 'subject_id', 'available_at', 'expires_at', 'notified_at'] },
                    { title: 'From', fields: ['locale', 'platform', 'app_version'] },
                ],
            },
        },
    }
}
