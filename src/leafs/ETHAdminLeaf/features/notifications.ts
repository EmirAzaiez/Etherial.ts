// ──────────────────────────────────────────────────────────────────────────
// Back-office notifications.
//
// Anything on the server can tell staff something happened: a note mentions
// them, a flow step decides a manager should look, a campaign finished. Each
// recipient gets a row of their own (the bell in the header reads them), and
// an email right away when the sender asks for one, or in a daily digest of
// what they have not read.
//
// Recipients are named the way the sender thinks of them: these users, people
// with this role, whoever may edit orders, every admin. They are resolved now,
// through the access helpers, so someone who lost access to a collection is
// not told about its records. The person who caused it is never notified.
//
// Emails need the back-office's address (`appUrl`) for their links, and a
// transport: the mail leaf's `admin_notification` email when the project lists
// it, else ETHPulseLeaf's transactional template. Without either, the bell
// still works and nothing is sent.
// ──────────────────────────────────────────────────────────────────────────

import etherial from 'etherial'
import { Op } from 'sequelize'
import { runExclusive } from '../../../components/database/lock.js'
import type { MailDefinition } from '../../ETHMailLeaf/services/options.js'
import { AdminNotification } from '../models/AdminNotification.js'
import { rolesConfig } from './access.js'

export interface NotificationEmailConfig {
    /** `daily` emails each person what they have not read nor been emailed about. Default `off`. */
    digest?: 'off' | 'daily'
    /** Server-local hour the digest leaves at, 0-23. Default 8. */
    digestHour?: number
    /** The mail leaf email used when the project lists it. Default `admin_notification`. */
    template?: string
}

export interface NotificationsConfig {
    /** The back-office's address, e.g. `https://admin.example.com`. Email links point there; without it, no email is sent. */
    appUrl?: string
    /** Emails, sent right away when the sender asks (mentions do). `false` turns every email off. Default on. */
    email?: boolean | NotificationEmailConfig
    /** Drop notifications older than this many days, checked daily. Default 90. */
    retentionDays?: number
    /** Sequelize model the user ids belong to. Default `User`. */
    userModel?: string
}

export interface NotifyInput {
    to: {
        userIds?: number[]
        adminRoleIds?: number[]
        permission?: { collection: string; permission: 'view' | 'create' | 'update' | 'delete' | 'actions' }
        all?: boolean
    }
    /** mention, flow, campaign, or any name a project gives its own. */
    type: string
    title: string
    body?: string
    /** A back-office path, e.g. `/orders/12`. */
    link?: string
    collection?: string
    recordId?: string | number
    /** Who caused it: never notified, and named in the bell. */
    actorId?: number | null
    data?: Record<string, unknown>
    /** Email it right away too. */
    email?: boolean
}

export const NOTIFICATION_EMAIL = 'admin_notification'

const DAY = 24 * 3600 * 1000
const DIGEST_LINES = 10
const DIGEST_ROWS = 5000

let config: NotificationsConfig | null = null
const warned = new Set<string>()

export function notificationsOptions(value: boolean | NotificationsConfig | undefined): NotificationsConfig | null {
    if (!value) return null
    return value === true ? {} : value
}

/** Called by the leaf when `features.notifications` is on: until then `notifyAdmins` does nothing. */
export function configureNotifications(value: NotificationsConfig | null): void {
    config = value
}

export function notificationsEnabled(): boolean {
    return config !== null
}

function warnOnce(key: string, message: string) {
    if (warned.has(key)) return
    warned.add(key)
    console.warn(`[ETHAdminLeaf] ${message}`)
}

// ── Users ─────────────────────────────────────────────────────────────────

function adminLeaf(): any {
    return (etherial as any).eth_admin_leaf ?? null
}

function valueOf(user: any, key: string): any {
    return typeof user?.get === 'function' ? user.get(key) : user?.[key]
}

export function userIdOf(user: any): number | null {
    const id = Number(valueOf(user, 'id'))
    return Number.isInteger(id) ? id : null
}

/** "Sara Ali", else the email: how a person is named in the bell, a note, a mention. */
export function adminUserLabel(user: any): string {
    if (!user) return ''
    const name = [valueOf(user, 'firstname') ?? valueOf(user, 'first_name'), valueOf(user, 'lastname') ?? valueOf(user, 'last_name')]
        .filter(Boolean)
        .join(' ')
    return String(name || valueOf(user, 'name') || valueOf(user, 'email') || valueOf(user, 'username') || `#${valueOf(user, 'id')}`)
}

function userModel(name?: string): any {
    const models = (etherial as any).database?.sequelize?.models ?? {}
    return models[name ?? config?.userModel ?? 'User'] ?? null
}

/** The users behind these ids, by id. Missing ones are simply absent. */
export async function loadUsers(ids: number[], modelName?: string): Promise<Map<number, any>> {
    const found = new Map<number, any>()
    const unique = Array.from(new Set(ids.filter((id) => Number.isInteger(id))))
    const User = userModel(modelName)
    if (!unique.length || !User) return found
    const users = await User.findAll({ where: { id: { [Op.in]: unique } } })
    for (const user of users) {
        const id = userIdOf(user)
        if (id !== null) found.set(id, user)
    }
    return found
}

/**
 * The people who may open the back-office, optionally only those holding a
 * permission on a collection. Comes from the access helpers (`listAdminUsers`):
 * a project without them has no way to list its staff, so every recipient
 * other than explicit user ids resolves to nobody, with one warning.
 */
export async function listAdminUsers(filter?: { collection?: string; permission?: string }): Promise<any[]> {
    const leaf = adminLeaf()
    if (typeof leaf?.listAdminUsers !== 'function') {
        warnOnce('listAdminUsers', 'listAdminUsers() is missing: notifications to roles, permissions or all admins reach nobody')
        return []
    }
    return (await leaf.listAdminUsers(filter)) ?? []
}

async function resolveRecipients(to: NotifyInput['to']): Promise<Map<number, any>> {
    const leaf = adminLeaf()
    const found = new Map<number, any>()
    if (!leaf || !to) return found
    const add = (users: any[]) => {
        for (const user of users) {
            const id = userIdOf(user)
            if (id !== null) found.set(id, user)
        }
    }

    // Explicit ids come from wherever the sender found them (a flow's
    // template, a record's owner): only those who can still sign in to the
    // back-office are kept, or a resident's id would fill a table no one reads.
    if (to.userIds?.length) {
        const users = await loadUsers(to.userIds.map(Number))
        for (const user of users.values()) {
            if (await leaf.canAccessAdmin(user)) add([user])
        }
    }

    let everyone: any[] | null = null
    const all = async () => (everyone ??= await listAdminUsers())
    if (to.all) add(await all())
    if (to.adminRoleIds?.length) {
        const roles = new Set(to.adminRoleIds.map(Number))
        const column = rolesConfig()?.roleIdColumn ?? 'admin_role_id'
        add((await all()).filter((user) => roles.has(Number(valueOf(user, column)))))
    }
    if (to.permission?.collection) {
        add(await listAdminUsers({ collection: to.permission.collection, permission: to.permission.permission ?? 'view' }))
    }
    return found
}

// ── Sending ───────────────────────────────────────────────────────────────

function safeLink(link: string | undefined): string | null {
    if (typeof link !== 'string') return null
    const trimmed = link.trim()
    // A back-office path only: the bell navigates to it inside the app.
    if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null
    return trimmed.slice(0, 512)
}

/**
 * Creates one notification per recipient and resolves with how many. Does
 * nothing (0) while `features.notifications` is off, so any code may call it.
 * Rejects only when the rows cannot be written; emails go out afterwards and
 * never hold the caller up.
 */
export async function notifyAdmins(input: NotifyInput): Promise<number> {
    if (!config || !input?.to || !input.title) return 0
    const recipients = await resolveRecipients(input.to)
    const actorId = Number(input.actorId)
    if (Number.isInteger(actorId)) recipients.delete(actorId)
    if (!recipients.size) return 0

    const base = {
        type: String(input.type || 'info').slice(0, 32),
        title: String(input.title).slice(0, 255),
        body: input.body ? String(input.body) : null,
        link: safeLink(input.link),
        collection: input.collection ?? null,
        record_id: input.recordId !== undefined && input.recordId !== null ? String(input.recordId) : null,
        actor_id: Number.isInteger(actorId) ? actorId : null,
        data: input.data ?? null,
    }
    const rows = await AdminNotification.bulkCreate(Array.from(recipients.keys()).map((user_id) => ({ ...base, user_id })) as any)

    if (input.email) {
        emailNow(rows, recipients).catch((err: any) => console.error('[ETHAdminLeaf] Notification email:', err?.message || err))
    }
    return rows.length
}

function emailOptions(): Required<NotificationEmailConfig> | null {
    if (!config || config.email === false) return null
    if (!config.appUrl) {
        warnOnce('appUrl', 'features.notifications.appUrl is not set: notification emails are not sent')
        return null
    }
    const email = typeof config.email === 'object' ? config.email : {}
    return {
        digest: email.digest ?? 'off',
        digestHour: email.digestHour ?? 8,
        template: email.template ?? NOTIFICATION_EMAIL,
    }
}

function absoluteUrl(link: string | null): string {
    const base = String(config?.appUrl ?? '').replace(/\/+$/, '')
    return base + (link ?? '/')
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

interface OutgoingEmail {
    title: string
    body: string
    url: string
    buttonLabel: string
}

/** Sends one email to one user. Resolves with whether it left; never throws. */
async function deliver(user: any, email: OutgoingEmail, template: string): Promise<boolean> {
    const address = valueOf(user, 'email')
    if (!address) return false
    try {
        const mail = (etherial as any).eth_mail_leaf
        const listed = (mail?.config?.emails ?? []).some((d: MailDefinition) => d.key === template)
        if (mail && listed) {
            const result = await mail.send(template, {
                to: address,
                user,
                data: { title: email.title, body: email.body, url: email.url, button_label: email.buttonLabel },
            })
            return result?.sent === true
        }

        // The mail leaf would refuse a key the project does not list, so the
        // fallback is Pulse's own branded template, which takes HTML.
        const pulse = (etherial as any).eth_pulse_leaf
        if (!pulse?.email) {
            warnOnce('transport', 'no mail transport (ETHMailLeaf email or ETHPulseLeaf email provider): notification emails are not sent')
            return false
        }
        const result = await pulse.email().sendTransactional({
            email: address,
            userId: userIdOf(user) ?? undefined,
            subject: email.title,
            content: {
                title: escapeHtml(email.title),
                body: email.body ? `<p>${escapeHtml(email.body).replace(/\n/g, '<br>')}</p>` : '',
                buttonText: email.buttonLabel,
                buttonUrl: email.url,
            },
        })
        return result?.success === true
    } catch (err: any) {
        console.error('[ETHAdminLeaf] Notification email:', err?.message || err)
        return false
    }
}

async function emailNow(rows: AdminNotification[], recipients: Map<number, any>) {
    const options = emailOptions()
    if (!options) return
    for (const row of rows) {
        const user = recipients.get(row.user_id)
        const sent = await deliver(
            user,
            { title: row.title, body: row.body ?? '', url: absoluteUrl(row.link), buttonLabel: 'Open' },
            options.template
        )
        if (sent && row.id) {
            await AdminNotification.update({ emailed_at: new Date() } as any, { where: { id: row.id } as any })
        }
    }
}

/** One email per person for what they have neither read nor been emailed about this week. */
async function sendDigest(template: string) {
    const since = new Date(Date.now() - 7 * DAY)
    const rows = await AdminNotification.findAll({
        where: { read_at: null, emailed_at: null, created_at: { [Op.gte]: since } } as any,
        order: [['id', 'DESC']],
        limit: DIGEST_ROWS,
    })
    const byUser = new Map<number, AdminNotification[]>()
    for (const row of rows) {
        const list = byUser.get(row.user_id) ?? []
        list.push(row)
        byUser.set(row.user_id, list)
    }
    if (!byUser.size) return

    const leaf = adminLeaf()
    const users = await loadUsers(Array.from(byUser.keys()))
    for (const [userId, list] of byUser) {
        const user = users.get(userId)
        if (!user || !(await leaf?.canAccessAdmin(user))) continue
        const lines = list.slice(0, DIGEST_LINES).map((row) => `• ${row.title}`)
        if (list.length > DIGEST_LINES) lines.push(`… and ${list.length - DIGEST_LINES} more`)
        const sent = await deliver(
            user,
            {
                title: list.length === 1 ? 'You have 1 unread notification' : `You have ${list.length} unread notifications`,
                body: lines.join('\n'),
                url: absoluteUrl('/'),
                buttonLabel: 'Open the back-office',
            },
            template
        )
        if (sent) {
            await AdminNotification.update({ emailed_at: new Date() } as any, {
                where: { id: { [Op.in]: list.map((row) => row.id) } } as any,
            })
        }
    }
}

/**
 * The purge, daily, and the digest, checked hourly. Both run under a lease,
 * so with several servers only one of them does each turn.
 */
export function scheduleNotificationJobs() {
    if (!config) return
    const days = config.retentionDays ?? 90
    const purge = () =>
        runExclusive('admin-notifications:purge', { ttlMs: 23 * 3600 * 1000, release: false }, async () => {
            const cutoff = new Date(Date.now() - days * DAY)
            await AdminNotification.destroy({ where: { created_at: { [Op.lt]: cutoff } } as any })
        }).catch((err: any) => console.error('[ETHAdminLeaf] Notification retention:', err?.message || err))
    if (days > 0) {
        purge()
        setInterval(purge, DAY).unref()
    }

    const options = emailOptions()
    if (!options || options.digest !== 'daily') return
    const digest = () => {
        if (new Date().getHours() !== options.digestHour) return
        // The lease outlives the hour: every server checks within it, one sends.
        runExclusive('admin-notifications:digest', { ttlMs: 20 * 3600 * 1000, release: false }, () => sendDigest(options.template)).catch(
            (err: any) => console.error('[ETHAdminLeaf] Notification digest:', err?.message || err)
        )
    }
    digest()
    setInterval(digest, 3600 * 1000).unref()
}

/**
 * The email the leaf sends through the mail leaf, ready to add to its
 * `emails` so the back-office can restyle and translate it:
 * `emails: [...mine, adminNotificationEmail()]`.
 */
export function adminNotificationEmail(): MailDefinition {
    return {
        key: NOTIFICATION_EMAIL,
        name: 'Back-office notification',
        description: 'Sent to staff when they are mentioned in a note or notified by a flow, and as the daily digest.',
        category: 'Back-office',
        variables: {
            title: { label: 'Title', example: 'Sara Ali mentioned you on Order #12' },
            body: { label: 'Text', example: 'Can you check the delivery address?' },
            url: { label: 'Link', example: 'https://admin.example.com/orders/12' },
            button_label: { label: 'Button', example: 'Open' },
        },
        subject: '{{title}}',
        blocks: [
            { type: 'heading', text: '{{title}}' },
            { type: 'text', text: '{{body}}' },
            { type: 'button', label: '{{button_label}}', url: '{{url}}' },
        ],
    }
}
