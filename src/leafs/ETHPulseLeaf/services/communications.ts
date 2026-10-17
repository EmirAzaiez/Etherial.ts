// ──────────────────────────────────────────────────────────────────────────
// A user's communications, in one timeline.
//
// "Did this customer get the reminder?" used to mean opening the message log,
// guessing the recipient (an email? a push token?), then the notifications,
// then the devices. The back-office now asks one route, which merges what the
// leaf knows — the message log, the in-app inbox, the devices — with what the
// project adds: a campaign table, a WhatsApp log, anything with a user id and
// a date.
//
// The log is matched by user id *and* by address. Rows written before the
// services passed the user id along only carry the recipient, and an email
// sent to a typed address belongs to whoever owns it today.
// ──────────────────────────────────────────────────────────────────────────

import etherial from 'etherial'
import { Op } from 'sequelize'

export type CommunicationChannel = 'push' | 'sms' | 'email' | 'inbox' | (string & {})

export interface CommunicationEntry {
    /** Unique across sources: `<source>:<id>`. */
    id: string
    channel: CommunicationChannel
    at: Date | string
    title?: string | null
    body?: string | null
    /** sent, delivered, failed, opened, unread… */
    status?: string | null
    recipient?: string | null
    error?: string | null
    /** Where it came from, in words: "Campaign", "Transactional", "Back-office". */
    source?: string | null
    /** The device it went to, for a push. */
    device?: string | null
    /** The record behind it in the back-office. */
    link?: { collection: string; id: string | number } | null
    /** The push side of the message, across the user's devices. */
    push?: PushSummary | null
    /**
     * Entries that are one message seen from several tables share a key: the
     * push of an inbox entry gives `inbox:<notification id>`, the key the
     * entry itself has. The timeline shows them as one.
     */
    groupKey?: string
}

export interface PushSummary {
    /** failed when no device got it, else the furthest any device got. */
    status: string
    devices: number
    failed: number
    delivered?: number
    opened?: number
}

export interface CommunicationQuery {
    userId: number
    user: any
    /** Only entries strictly older than this. */
    before?: Date
    limit: number
    channel?: string
}

export interface CommunicationSource {
    /** The channels this source can return, so a filtered query skips it. */
    channels: CommunicationChannel[]
    list(query: CommunicationQuery): Promise<CommunicationEntry[]>
    count?(query: CommunicationQuery): Promise<Partial<Record<string, number>>>
}

export interface CommunicationsConfig {
    /** The admin collection the timeline is shown on. Default `users`. */
    usersCollection?: string
    /** The Sequelize model of that collection. Default `User`. */
    userModel?: string
}

export function communicationsOptions(value: boolean | CommunicationsConfig | undefined): CommunicationsConfig | null {
    if (!value) return null
    return value === true ? {} : value
}

const sources = new Map<string, CommunicationSource>()

export function registerCommunicationSource(name: string, source: CommunicationSource): void {
    sources.set(name, source)
}

const models = () => (etherial as any).database?.sequelize?.models ?? {}
const adminLeaf = () => (etherial as any).eth_admin_leaf

/** The admin collection a model is listed in, so an entry can link to its record. */
export function collectionOf(model: any): string | null {
    if (!model) return null
    const found = adminLeaf()?.collections?.find((c: any) => c.model === model || c.model?.name === model.name)
    return found?.name ?? null
}

const SOURCE_LABELS: Record<string, string> = {
    transactional: 'Transactional',
    'back-office': 'Back-office',
}

/** The addresses a user is reachable at, as the log records them. */
function addressesOf(user: any, devices: any[]): string[] {
    const values = [user?.email, user?.phone, user?.phone_number, user?.mobile, ...devices.map((d) => d.push_token)]
    const out = new Set<string>()
    for (const v of values) {
        if (typeof v !== 'string' || !v.trim()) continue
        out.add(v.trim())
        if (v.includes('@')) out.add(v.trim().toLowerCase())
    }
    return [...out]
}

function messageLogWhere(query: CommunicationQuery, addresses: string[]) {
    const owner: any[] = [{ user_id: query.userId }]
    if (addresses.length) owner.push({ recipient: { [Op.in]: addresses } })
    const where: any = { [Op.or]: owner }
    if (query.before) where.created_at = { [Op.lt]: query.before }
    if (query.channel && query.channel !== 'inbox') where.type = query.channel
    return where
}

/**
 * The built-in sources, from the models the project registered: the message
 * log (push, SMS, email) and the in-app inbox. Either is skipped when the
 * project has no such model.
 */
function builtinSources(devices: any[]): Map<string, CommunicationSource> {
    const { MessageLog, Notification } = models()
    const builtins = new Map<string, CommunicationSource>()

    if (MessageLog) {
        const collection = collectionOf(MessageLog)
        builtins.set('messages', {
            channels: ['push', 'sms', 'email'],
            async list(query) {
                const rows = await MessageLog.findAll({
                    where: messageLogWhere(query, addressesOf(query.user, devices)),
                    order: [['created_at', 'DESC'], ['id', 'DESC']],
                    limit: query.limit,
                })
                const deviceByToken = new Map(devices.map((d) => [d.push_token, d]))
                let legacy: { key: string; subject: string; content: string; at: number } | null = null
                return rows.map((row: any): CommunicationEntry => {
                    const meta = row.metadata ?? {}
                    const device = row.type === 'push' ? deviceByToken.get(row.recipient) : null
                    const at = new Date(row.created_at ?? row.createdAt).getTime()
                    let groupKey = meta.notification_id ? `inbox:${meta.notification_id}` : meta.batch ? `batch:${meta.batch}` : undefined
                    // Rows logged before batches existed: the same push to each
                    // of a user's devices, written within a few seconds.
                    if (!groupKey && row.type === 'push') {
                        const subject = row.subject ?? ''
                        const content = meta.content ?? ''
                        if (!legacy || legacy.subject !== subject || legacy.content !== content || legacy.at - at > 3000) {
                            legacy = { key: `push:${row.id}`, subject, content, at }
                        }
                        groupKey = legacy.key
                    }
                    return {
                        id: `message:${row.id}`,
                        channel: row.type,
                        at: row.created_at ?? row.createdAt,
                        title: row.subject ?? null,
                        body: meta.content ?? null,
                        status: row.status,
                        recipient: row.type === 'push' ? null : row.recipient,
                        error: row.error_message ?? null,
                        source: SOURCE_LABELS[meta.source ?? meta.type] ?? meta.source ?? null,
                        device: device ? deviceLabel(device) : null,
                        link: collection ? { collection, id: row.id } : null,
                        groupKey,
                    }
                })
            },
            async count(query) {
                const rows = await MessageLog.count({
                    where: messageLogWhere({ ...query, before: undefined, channel: undefined }, addressesOf(query.user, devices)),
                    group: ['type'],
                })
                const out: Record<string, number> = {}
                for (const r of rows as any[]) out[r.type] = Number(r.count)
                return out
            },
        })
    }

    if (Notification && Notification.rawAttributes?.created_for_user_id) {
        const collection = collectionOf(Notification)
        builtins.set('inbox', {
            channels: ['inbox'],
            async list(query) {
                const where: any = { created_for_user_id: query.userId }
                if (query.before) where.created_at = { [Op.lt]: query.before }
                const rows = await Notification.findAll({
                    where,
                    order: [['created_at', 'DESC'], ['id', 'DESC']],
                    limit: query.limit,
                    paranoid: false,
                })
                return rows.map((row: any): CommunicationEntry => ({
                    id: `inbox:${row.id}`,
                    channel: 'inbox',
                    at: row.created_at ?? row.createdAt,
                    title: row.title ?? null,
                    body: [row.location_title, row.sub_location_title].filter(Boolean).join(' · ') || null,
                    status: row.deleted_at ? 'deleted' : row.is_opened ? 'opened' : 'unread',
                    source: row.location ?? null,
                    link: collection ? { collection, id: row.id } : null,
                }))
            },
            async count(query) {
                return { inbox: await Notification.count({ where: { created_for_user_id: query.userId }, paranoid: false }) }
            },
        })
    }

    return builtins
}

export function deviceLabel(device: any): string {
    const name = [device.brand && device.model && !String(device.model).startsWith(device.brand) ? device.brand : null, device.model || device.device]
        .filter(Boolean)
        .join(' ')
    return name || device.platform || `Device #${device.id}`
}

// The leaf's DevicePlatform values; a project may store the name instead.
const PLATFORMS: Record<string, string> = { '1': 'web', '2': 'android', '3': 'ios' }

function serializeDevice(device: any) {
    const token: string | null = device.push_token ?? null
    const platform = device.platform == null ? null : PLATFORMS[String(device.platform)] ?? String(device.platform).toLowerCase()
    return {
        id: device.id,
        label: deviceLabel(device),
        platform,
        os_version: device.os_version ?? null,
        app_version: device.app_version ?? null,
        locale: device.locale ?? null,
        tz: device.tz ?? null,
        // 1 = enabled in the leaf's enum; a project may store it as a string.
        push_enabled: !!token && (device.push_token_status === undefined || device.push_token_status === 1 || device.push_token_status === 'enabled'),
        active: device.status !== false,
        // Enough to tell two tokens apart, not enough to push with.
        push_token: token ? `${token.slice(0, 22)}…` : null,
        last_activity: device.last_activity ?? null,
        created_at: device.created_at ?? device.createdAt ?? null,
    }
}

const RANK = ['failed', 'sent', 'delivered', 'opened']

function summarize(entries: CommunicationEntry[]): PushSummary {
    const parts = entries.map((e) => e.push ?? { status: e.status ?? 'sent', devices: 1, failed: e.status === 'failed' ? 1 : 0 })
    const sum = (key: 'devices' | 'failed' | 'delivered' | 'opened') => parts.reduce((n, p) => n + (p[key] ?? 0), 0)
    const devices = sum('devices')
    const failed = sum('failed')
    const best = parts.map((p) => p.status).reduce((a, b) => (RANK.indexOf(b) > RANK.indexOf(a) ? b : a), 'failed')
    return { status: failed === devices ? 'failed' : best, devices, failed, delivered: sum('delivered'), opened: sum('opened') }
}

/**
 * One message, one line: the entries sharing a `groupKey` fold into the inbox
 * entry when it is on the page (it is what the user sees), else into the
 * first of them. The push side becomes a delivery summary.
 */
function mergeGroups(entries: CommunicationEntry[]): CommunicationEntry[] {
    const keyOf = (e: CommunicationEntry) => e.groupKey ?? (e.channel === 'inbox' ? e.id : undefined)
    const groups = new Map<string, CommunicationEntry[]>()
    for (const e of entries) {
        const key = keyOf(e)
        if (!key) continue
        const group = groups.get(key) ?? []
        group.push(e)
        groups.set(key, group)
    }

    const out: CommunicationEntry[] = []
    const done = new Set<string>()
    for (const e of entries) {
        const key = keyOf(e)
        const group = key ? groups.get(key)! : [e]
        if (group.length === 1) {
            out.push(e)
            continue
        }
        if (done.has(key!)) continue
        done.add(key!)
        const base = group.find((g) => g.channel === 'inbox') ?? group[0]
        const pushes = group.filter((g) => g.channel === 'push')
        const other = group.find((g) => g !== base)!
        const push = pushes.length ? summarize(pushes) : base.push
        out.push({
            ...base,
            status: base.channel === 'inbox' || !push ? base.status : push.status,
            title: base.title ?? other.title,
            body: base.body ?? other.body,
            // The record that sent it says more than the inbox row.
            source: other.source ?? base.source,
            link: other.link ?? base.link,
            device: pushes.length > 1 ? null : pushes[0]?.device ?? base.device,
            push,
        })
    }
    return out
}

export async function userCommunications(options: {
    userId: number
    before?: Date
    limit?: number
    channel?: string
    config: CommunicationsConfig
}) {
    const m = models()
    const User = m[options.config.userModel ?? 'User']
    const user = User ? await User.findByPk(options.userId) : null
    if (User && !user) return null

    const Device = m.Device
    // The phone in use first: by last activity, which a project may not track.
    const seen = (d: any) => new Date(d.last_activity ?? d.updated_at ?? d.updatedAt ?? 0).getTime()
    const devices: any[] = Device
        ? (await Device.findAll({ where: { user_id: options.userId } })).sort((a: any, b: any) => seen(b) - seen(a))
        : []

    const limit = Math.min(Math.max(options.limit ?? 30, 1), 100)
    const query: CommunicationQuery = {
        userId: options.userId,
        user,
        before: options.before,
        limit,
        channel: options.channel,
    }

    const all = new Map([...builtinSources(devices), ...sources])
    const active = [...all.entries()].filter(([, s]) => !query.channel || s.channels.includes(query.channel))

    const lists = await Promise.all(
        active.map(([name, s]) =>
            s.list(query).catch((err) => {
                console.error(`[ETHPulseLeaf] Communications source "${name}":`, err?.message || err)
                return [] as CommunicationEntry[]
            })
        )
    )

    // Each source returned its newest `limit`; the newest `limit` of the union
    // is exact. The cursor is the oldest one kept.
    const merged = lists
        .flat()
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, limit)
    const items = mergeGroups(merged).map(({ groupKey, ...e }) => e)
    const nextBefore = merged.length === limit ? new Date(merged[merged.length - 1].at).toISOString() : null

    // Totals only on the first page: they do not move with the cursor.
    let counts: Record<string, number> | undefined
    if (!options.before) {
        counts = {}
        const results = await Promise.all(
            [...all.entries()].map(([name, s]) =>
                s.count
                    ? s.count({ ...query, channel: undefined }).catch((err) => {
                          console.error(`[ETHPulseLeaf] Communications count "${name}":`, err?.message || err)
                          return {}
                      })
                    : Promise.resolve({})
            )
        )
        for (const r of results) {
            for (const [channel, n] of Object.entries(r)) counts[channel] = (counts[channel] ?? 0) + (n ?? 0)
        }
    }

    return {
        devices: devices.map(serializeDevice),
        items,
        counts,
        nextBefore,
    }
}
