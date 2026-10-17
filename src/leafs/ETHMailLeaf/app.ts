import etherial, { Etherial } from 'etherial'
import * as path from 'path'
import { fileURLToPath } from 'url'

import { MailCampaign } from './models/MailCampaign.js'
import { MailCampaignRecipient } from './models/MailCampaignRecipient.js'
import { MailSetting } from './models/MailSetting.js'
import { MailTemplate } from './models/MailTemplate.js'
import { MailTemplateVersion } from './models/MailTemplateVersion.js'
import { MailUnsubscribe } from './models/MailUnsubscribe.js'
import { campaignsFeature, startCampaignSweep } from './services/campaigns.js'
import { RenderedMail } from './services/render.js'
import { state } from './services/state.js'
import { CAMPAIGNS_COLLECTION, ETHMailLeafConfig, MailError, TEMPLATES_COLLECTION, localesOf } from './services/options.js'
import { SendInput, SendResult, definitions, renderMail, sendMail } from './services/templates.js'
import { isUnsubscribed } from './services/unsubscribe.js'

export * from './services/options.js'
export type { RenderedMail } from './services/render.js'
export type { SendInput, SendResult } from './services/templates.js'
export type { EditableTheme } from './services/theme.js'
export type { MailCampaignStatus } from './models/MailCampaign.js'
export type { MailRecipientStatus } from './models/MailCampaignRecipient.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * ETHMailLeaf — the emails a project sends, designed once and edited in the
 * back-office.
 *
 * The project lists its emails in code: a key, the variables the code fills
 * in, and the text in every language, as blocks (heading, text, button, code,
 * note…). The leaf turns them into an email inboxes show well, in the
 * project's colors and logo, right to left in Arabic. The back-office's Emails
 * page rewrites any of them, language by language, with a live preview and a
 * test send; its version goes out instead of the code's until it is reset.
 * Sending goes through ETHPulseLeaf, which keeps the log. Every saved
 * version is kept, and the brand around the emails is edited there too.
 *
 * With `campaigns` in the config, the back-office also writes emails of its
 * own and sends them to the project's audiences, at a date, within the SMTP
 * server's rate, with a working unsubscribe link.
 */
export default class ETHMailLeaf {
    readonly etherial_module_name = 'eth_mail_leaf'

    public config: ETHMailLeafConfig
    private routes: { route: string; methods: string[] }[] = []

    constructor(config: ETHMailLeafConfig = {}) {
        this.config = config
        state.config = config
        this.routes.push({
            route: path.join(__dirname, 'routes/admin'),
            methods: ['theme', 'previewBrand', 'saveBrand', 'resetBrand', 'list', 'show', 'versions', 'version', 'preview', 'save', 'reset', 'test'],
        })
        if (config.campaigns) {
            this.routes.push({
                route: path.join(__dirname, 'routes/campaigns'),
                methods: ['audiences', 'countAudience', 'list', 'create', 'preview', 'show', 'update', 'destroy', 'recipients', 'duplicate', 'test', 'schedule', 'unschedule', 'cancel'],
            })
            this.routes.push({ route: path.join(__dirname, 'routes/public'), methods: ['unsubscribeForm', 'unsubscribeConfirm'] })
            const rate = config.campaigns.perMinute
            if (rate !== undefined && !(Number(rate) > 0)) throw new Error('[ETHMailLeaf] campaigns.perMinute must be above 0')
        }

        const keys = (config.emails ?? []).map((e) => e.key)
        const twice = keys.filter((k, i) => keys.indexOf(k) !== i)
        if (twice.length) throw new Error(`[ETHMailLeaf] Two emails share the key "${twice[0]}"`)
        const bad = keys.find((k) => !/^[a-z0-9][a-z0-9_.-]{0,127}$/i.test(k))
        if (bad !== undefined) throw new Error(`[ETHMailLeaf] "${bad}" can't be an email key: letters, digits, _ . - only`)
    }

    /** Lifecycle: beforeRun — hand the tables to the database before it syncs. */
    beforeRun({ database }: Etherial) {
        database?.addModels([MailTemplate, MailTemplateVersion, MailSetting, MailCampaign, MailCampaignRecipient, MailUnsubscribe] as any)
    }

    /** Lifecycle: run — routes. */
    run({ http }: Etherial) {
        http?.routes_leafs?.push(...this.routes)
        const count = this.config.emails?.length ?? 0
        const { locales } = localesOf(this.config)
        console.log(
            `[ETHMailLeaf] ${count ? `${count} email${count > 1 ? 's' : ''} in ${locales.join(', ')}` : 'No email yet: list them in `emails`'}${
                this.config.campaigns ? `, campaigns on (${this.config.campaigns.perMinute ?? 60}/min)` : ''
            }`
        )
        if (!(etherial as any).eth_pulse_leaf) console.warn('[ETHMailLeaf] ETHPulseLeaf is missing: emails will render but not send')
    }

    /** Lifecycle: afterRun — the tables are synced: tell the back-office, start sending campaigns. */
    afterRun() {
        if (this.config.campaigns) startCampaignSweep()
        const adminLeaf = (etherial as any).eth_admin_leaf
        if (!adminLeaf?.registerCollection) return

        // The rows are written through the Emails page, which checks them: the generic
        // routes only read. The hooks are in place before the collection resolves them.
        const refuse = async () => {
            throw new MailError('read_only', 400, 'Change emails from the Emails page')
        }
        adminLeaf.hooks?.register?.('mail:read-only', {
            collection: TEMPLATES_COLLECTION,
            description: 'Email versions are saved from the Emails page',
            beforeCreate: refuse,
            beforeUpdate: refuse,
            beforeDelete: async () => false,
        })
        if (!adminLeaf.getCollection(TEMPLATES_COLLECTION)) adminLeaf.registerCollection(templatesCollection(this.config))

        const { locales, defaultLocale, rtlLocales } = localesOf(this.config)
        adminLeaf.setFeature?.('emails', {
            collection: TEMPLATES_COLLECTION,
            locales,
            defaultLocale,
            rtlLocales: rtlLocales.filter((l) => locales.includes(l)),
            count: definitions().length,
        })

        if (this.config.campaigns) {
            adminLeaf.hooks?.register?.('mail:campaigns-read-only', {
                collection: CAMPAIGNS_COLLECTION,
                description: 'Campaigns are written from the Email campaigns page',
                beforeCreate: async () => {
                    throw new MailError('read_only', 400, 'Write campaigns from the Email campaigns page')
                },
                beforeUpdate: async () => {
                    throw new MailError('read_only', 400, 'Write campaigns from the Email campaigns page')
                },
                beforeDelete: async () => false,
            })
            if (!adminLeaf.getCollection(CAMPAIGNS_COLLECTION)) adminLeaf.registerCollection(campaignsCollection())
            adminLeaf.setFeature?.('mailCampaigns', { collection: CAMPAIGNS_COLLECTION, ...campaignsFeature() })
        }
    }

    /**
     * Sends one of the config's emails. The language is `locale`, else the
     * user's (through the config's `locale`), else the default one. Resolves
     * with `sent: false` when the provider refuses it; rejects only for an
     * unknown key or a missing ETHPulseLeaf.
     */
    send(key: string, input: SendInput): Promise<SendResult> {
        return sendMail(key, input)
    }

    /** Whether this address unsubscribed from the campaigns. The emails `send()` sends ignore it: a person needs them. */
    isUnsubscribed(email: string): Promise<boolean> {
        return isUnsubscribed(email)
    }

    /** The email as it would go out, without sending it. */
    render(key: string, input: { data?: Record<string, unknown>; locale?: string | null; user?: any } = {}): Promise<RenderedMail> {
        return renderMail(key, input)
    }

    commands() {
        return [
            {
                command: 'list',
                description: 'List the emails, and which languages the back-office rewrote',
                action: async () => {
                    const rows = await MailTemplate.findAll({ attributes: ['key', 'locale'] }).catch(() => [] as MailTemplate[])
                    const lines = definitions().map((d) => {
                        const custom = rows.filter((r) => r.key === d.key).map((r) => r.locale)
                        return `${d.key.padEnd(32)} ${d.name}${custom.length ? `  (back-office: ${custom.join(', ')})` : ''}`
                    })
                    return { success: true, message: lines.join('\n') || 'No email in the config' }
                },
            },
            {
                command: 'test <key> <to> [locale]',
                description: 'Send an email with its example variables, to check it in a real inbox',
                action: async (_etherial: any, key: string, to: string, locale?: string) => {
                    const def = definitions().find((d) => d.key === key)
                    if (!def) return { success: false, message: `No email "${key}"` }
                    const data = Object.fromEntries(
                        Object.entries(def.variables ?? {}).map(([name, v]) => [name, v !== null && typeof v === 'object' ? v.example ?? '' : v])
                    )
                    const result = await sendMail(key, { to, data, locale }, { subjectPrefix: '[Test] ' })
                    return { success: result.sent, message: result.sent ? `Sent "${result.subject}" to ${to} (${result.locale})` : `Not sent: ${result.error}` }
                },
            },
        ]
    }
}

function templatesCollection(config: ETHMailLeafConfig) {
    const { locales } = localesOf(config)
    return {
        name: TEMPLATES_COLLECTION,
        model: MailTemplate,
        // `update` is never used by the generic routes (the hooks refuse it): it is
        // listed so the role permissions can grant editing emails.
        crud: ['list', 'show', 'update'] as ('list' | 'show' | 'update')[],
        meta: {
            label: 'Email',
            labelPlural: 'Emails',
            icon: 'Mail',
            description: 'The emails sent to people, as the back-office rewrote them',
            group: 'System',
            order: 94,
            // Read and edited through the Emails page; listed for the role permissions.
            hidden: true,
        },
        fields: [
            { name: 'id', type: 'integer' as const, readonly: true, sortable: true },
            {
                name: 'key',
                type: 'select' as const,
                label: 'Email',
                readonly: true,
                filterable: true,
                options: (config.emails ?? []).map((e) => ({ value: e.key, label: e.name })),
            },
            { name: 'locale', type: 'select' as const, label: 'Language', readonly: true, filterable: true, options: locales.map((l) => ({ value: l, label: l.toUpperCase() })) },
            { name: 'subject', type: 'string' as const, label: 'Subject', readonly: true },
            { name: 'preheader', type: 'string' as const, label: 'Preview line', readonly: true },
            { name: 'blocks', type: 'json' as const, label: 'Content', readonly: true },
            { name: 'updated_by', type: 'integer' as const, label: 'Saved by', readonly: true },
            { name: 'updated_at', type: 'datetime' as const, label: 'Saved', readonly: true, sortable: true },
        ],
        views: {
            list: { fields: ['key', 'locale', 'subject', 'updated_at'], sort: { field: 'updated_at', direction: 'desc' as const }, filters: ['key', 'locale'] },
            show: { fields: ['key', 'locale', 'subject', 'preheader', 'blocks', 'updated_by', 'updated_at'] },
        },
    }
}

function campaignsCollection() {
    return {
        name: CAMPAIGNS_COLLECTION,
        model: MailCampaign,
        // Written through the Email campaigns page: the generic routes only read. Every
        // right is listed for the role permissions: `update` also schedules and sends.
        crud: ['list', 'show', 'create', 'update', 'delete'] as ('list' | 'show' | 'create' | 'update' | 'delete')[],
        meta: {
            label: 'Email campaign',
            labelPlural: 'Email campaigns',
            icon: 'Send',
            description: 'Emails written in the back-office and sent to an audience',
            group: 'System',
            order: 95,
            hidden: true,
        },
        fields: [
            { name: 'id', type: 'integer' as const, readonly: true, sortable: true },
            { name: 'name', type: 'string' as const, label: 'Name', readonly: true },
            { name: 'status', type: 'string' as const, label: 'Status', readonly: true, filterable: true },
            { name: 'audience_label', type: 'string' as const, label: 'Audience', readonly: true },
            { name: 'scheduled_at', type: 'datetime' as const, label: 'Scheduled', readonly: true, sortable: true },
            { name: 'sent_count', type: 'integer' as const, label: 'Sent', readonly: true },
            { name: 'created_at', type: 'datetime' as const, label: 'Created', readonly: true, sortable: true },
        ],
        views: {
            list: { fields: ['name', 'status', 'audience_label', 'scheduled_at', 'sent_count'], sort: { field: 'created_at', direction: 'desc' as const } },
            show: { fields: ['name', 'status', 'audience_label', 'scheduled_at', 'sent_count', 'created_at'] },
        },
    }
}
