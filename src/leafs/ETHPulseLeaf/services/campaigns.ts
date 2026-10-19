import { Op, QueryTypes, col, fn, where as sqlWhere } from 'sequelize'
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk'
import etherial from 'etherial'

import { runExclusive } from '../../../components/database/lock.js'
import { DevicePushTokenStatus } from '../models/Device.js'
import { NotificationCampaignStatus } from '../models/PushCampaign.js'
import { NotificationDeliveryStatus } from '../models/NotificationCampaignDelivery.js'
import type { FieldDefinition } from '../../ETHAdminLeaf/features/ActionRegistry.js'
import type { CollectionMeta } from '../../ETHAdminLeaf/features/CollectionConfig.js'

/**
 * Push campaigns: the engine behind the back-office "Push campaigns".
 *
 * A campaign is never sent from the request that creates it. "Send now" only
 * schedules it for now and kicks the dispatcher; everything else goes through
 * the sweep below, which sends what is due and then collects Expo's receipts.
 *
 * Expo is called directly rather than through the push service: the provider
 * keeps the ticket ids but drops the error codes, and those codes are the
 * whole point here (a `DeviceNotRegistered` receipt is what tells us a token
 * is dead and must stop being counted). The service would also log every
 * device in the message log, where a campaign has its own deliveries.
 */

/**
 * Who a campaign reaches, as the project's audience rule decides it.
 *
 * `userIds` set: the devices of those users only (an empty list reaches
 * nobody, it is a real answer, not a missing filter). `userWhere` set: the
 * devices of the users it matches, filtered in the same query (an account
 * type, a segment's ids…). Neither: every signed-in user's device, unless
 * `users` is false. `guests` adds the devices nobody is signed in on (not with
 * `userWhere`); they never get a notification-centre entry.
 */
export interface PushCampaignAudience {
    userIds?: number[]
    userWhere?: Record<string | symbol, any>
    users?: boolean
    guests?: boolean
}

export interface PushCampaignsConfig {
    /**
     * The project's models: its campaign extends `BasePushCampaign` with
     * `@Table(pushCampaignTable)`, its delivery `BaseNotificationCampaignDelivery`
     * with `@Table(notificationCampaignDeliveryTable)`. The devices, users and
     * notification centre default to the database's `Device`, `User` and
     * `Notification` models.
     */
    models: {
        campaign: any
        delivery: any
        device?: any
        user?: any
        notification?: any
    }
    /**
     * Who the campaign reaches, from the project's own targeting columns (a
     * segment, an account type…). A list of user ids is the same as `{ userIds }`;
     * `{ userWhere }` filters the users in the sending query itself.
     * Asked at send time, and again for the notification centre.
     * Default: the campaign's two boxes, `target_logged_user` / `target_not_logged_user`.
     */
    audience?: (campaign: any) => Promise<PushCampaignAudience | number[]>
    /** Does this device get the Arabic copy? Default: its locale starts with "ar". */
    arabic?: (device: any) => boolean
    /** Columns of the device's user (`device.user`) that `arabic` reads. */
    userAttributes?: string[]
    /**
     * The project's own rules, given the campaign as it would be saved (the
     * model's defaults filled in on create). Throw an Error to refuse it.
     */
    validate?: (campaign: Record<string, any>) => void | Promise<void>
    /** The zone "Send At" is read in, in the Schedule summary. Default UTC. */
    timeZone?: { id: string; label: string }
    /** Who gets the campaigns, in the back-office texts. Default "users". */
    audienceNoun?: string
    /**
     * Leave each campaign in the app's notification centre (one entry per
     * user, location "Campaign") when its "Show in notification screen" is on.
     * Default on, when the project has a notification model.
     */
    inbox?: boolean
    /** Run the sweep in this process. Default on. */
    sweep?: boolean
    admin?: {
        /**
         * The targeting fields of the form and of the show page, in order.
         * Default: the leaf's two boxes, logged-in users and guests.
         */
        targeting?: FieldDefinition[]
        /** Changes to the default fields, by name (a help text, a label…). */
        fields?: Record<string, Partial<FieldDefinition>>
        meta?: Partial<CollectionMeta>
    }
}

const SWEEP_INTERVAL_MS = 60 * 1000

/** Receipts are collected every five minutes, by one server. */
const RECEIPT_INTERVAL_MS = 5 * 60 * 1000

/** Expo advises waiting ~15 min before asking for a receipt… */
const RECEIPT_DELAY_MS = 15 * 60 * 1000

/** …and forgets them after 24h. Past that, the delivery stays "sent". */
const RECEIPT_TTL_MS = 23 * 60 * 60 * 1000

/** The `location` of a campaign in the notification centre (the bell). */
export const CAMPAIGN_NOTIFICATION_LOCATION = 'Campaign'

let config: PushCampaignsConfig | null = null

export function setCampaignsConfig(value: PushCampaignsConfig | undefined): void {
    config = value ?? null
}

export function campaignsConfig(): PushCampaignsConfig {
    if (!config) {
        throw new Error('[ETHPulseLeaf] Push campaigns are off: set `campaigns` in the leaf config')
    }
    return config
}

const pulseConfig = () => (etherial as any).eth_pulse_leaf?.config

function models() {
    const own = campaignsConfig().models
    const registered = etherial.database!.sequelize.models as Record<string, any>
    return {
        Campaign: own.campaign,
        Delivery: own.delivery,
        Device: own.device ?? registered.Device,
        User: own.user ?? registered.User,
        Notification: own.notification ?? registered.Notification,
    }
}

let expoClient: Expo | null = null
function expo(): Expo {
    if (!expoClient) {
        const accessToken = pulseConfig()?.push?.providers?.expo?.accessToken || process.env.EXPO_ACCESS_TOKEN || undefined
        expoClient = new Expo({ accessToken })
    }
    return expoClient
}

export const defaultCampaignTitle = (): string => pulseConfig()?.push?.defaultNotificationTitle || 'Notification'

function isArabic(device: any): boolean {
    const own = campaignsConfig().arabic
    if (own) {
        return own(device)
    }
    return (device.locale || '').toLowerCase().startsWith('ar')
}

/** The push a device gets for this campaign, in its language. */
function buildMessage(campaign: any, device: any, extraData: Record<string, any> = {}): Omit<ExpoPushMessage, 'to'> {
    const arabic = isArabic(device)
    const data: Record<string, any> = { ...(campaign.data || {}), ...extraData }
    if (campaign.url) {
        data.location = 'ExternalLink'
        data.url = campaign.url
    }

    return {
        sound: 'default',
        title: (arabic && campaign.title_ar) || campaign.title || defaultCampaignTitle(),
        body: (arabic && campaign.message_ar) || campaign.message,
        data,
    }
}

/** The device's user, with what the language guess reads (and, given, who it must be). */
function userInclude(userWhere?: Record<string | symbol, any>): Record<string, any> {
    const include: Record<string, any> = { association: 'user', attributes: ['id', ...(campaignsConfig().userAttributes ?? [])], required: false }
    if (userWhere) {
        include.where = userWhere
        include.required = true
    }
    return include
}

/**
 * Every enabled device a campaign targets, as the project's audience says.
 *
 * `pushOnly: false` keeps the devices that refused push, and `inbox` drops the
 * guests: the notification centre is for every signed-in user, and only for them.
 */
async function targetDevices(campaign: any, { pushOnly = true, inbox = false } = {}): Promise<any[]> {
    const { Device } = models()
    const own = campaignsConfig().audience
    const resolved = own
        ? await own(campaign)
        : { users: campaign.target_logged_user !== false, guests: !!campaign.target_not_logged_user }
    const audience: PushCampaignAudience = Array.isArray(resolved) ? { userIds: resolved } : resolved ?? {}

    const named = audience.userIds !== undefined || audience.userWhere !== undefined
    const users = named || audience.users !== false
    // A filter on the users is an inner join: it leaves no room for guests.
    const guests = !!audience.guests && !inbox && !audience.userWhere
    if (!users && !guests) {
        return []
    }

    const where: Record<string, any> = {
        ...(pushOnly ? { push_token_status: DevicePushTokenStatus.ENABLED } : {}),
        status: true,
    }
    const signedIn = audience.userIds !== undefined ? { [Op.in]: audience.userIds } : { [Op.ne]: null }
    if (users && guests) {
        if (audience.userIds !== undefined) {
            where[Op.or as any] = [{ user_id: signedIn }, { user_id: null }]
        }
    } else if (users) {
        where.user_id = signedIn
    } else {
        where.user_id = null
    }

    return Device.findAll({ where, include: [userInclude(audience.userWhere)] })
}

type Outcome = { device: any; ticket: ExpoPushTicket | null; error?: string }

/**
 * Sends one message per device and returns what Expo said about each one. A
 * chunk that fails as a whole marks all its devices failed.
 */
async function sendToDevices(devices: any[], messageFor: (device: any) => Omit<ExpoPushMessage, 'to'>): Promise<Outcome[]> {
    const outcomes: Outcome[] = []
    const valid: any[] = []

    for (const device of devices) {
        if (Expo.isExpoPushToken(device.push_token)) {
            valid.push(device)
        } else {
            outcomes.push({ device, ticket: null, error: 'InvalidPushToken' })
        }
    }

    // chunkPushNotifications keeps the order, so chunk i/j maps back to valid[k].
    const messages: ExpoPushMessage[] = valid.map((device) => ({ to: device.push_token, ...messageFor(device) }))
    let k = 0
    for (const chunk of expo().chunkPushNotifications(messages)) {
        const slice = valid.slice(k, k + chunk.length)
        k += chunk.length
        try {
            const tickets = await expo().sendPushNotificationsAsync(chunk)
            slice.forEach((device, i) => outcomes.push({ device, ticket: tickets[i] ?? null }))
        } catch (err) {
            const error = (err as Error)?.message || 'Push send failed'
            slice.forEach((device) => outcomes.push({ device, ticket: null, error }))
        }
    }

    return outcomes
}

/** What a campaign reads like in the notification centre, in the person's language. */
function inboxText(campaign: any, arabic: boolean): string {
    const title = (arabic && campaign.title_ar) || campaign.title
    const message = (arabic && campaign.message_ar) || campaign.message
    return [title, message].filter((part) => part && part.trim()).join('\n')
}

/**
 * Leaves the campaign in the notification centre of every signed-in user it
 * targets, one entry per user (not per device), in the language of the device
 * they used last. Users who refused push get it too: the centre is where they
 * can still find it.
 *
 * A push alone leaves no trace in the app: once the banner is gone, the
 * campaign cannot be found anywhere. Safe to call again, a user who already
 * has the entry is skipped.
 *
 * `bulkCreate` on purpose: a Notification created one by one pushes itself
 * (@AfterCreate in the base notification), and the campaign has already pushed.
 */
export async function publishCampaignToInbox(campaign: any): Promise<number> {
    const { Notification } = models()
    const devices = await targetDevices(campaign, { pushOnly: false, inbox: true })

    const already = await Notification.findAll({
        where: { location: CAMPAIGN_NOTIFICATION_LOCATION, location_id: campaign.id },
        attributes: ['created_for_user_id'],
    })
    const done = new Set(already.map((n: any) => n.created_for_user_id))

    const lastDevice = new Map<number, any>()
    for (const device of devices) {
        if (!device.user_id || done.has(device.user_id)) {
            continue
        }
        const current = lastDevice.get(device.user_id)
        if (!current || (device.last_activity?.getTime() ?? 0) > (current.last_activity?.getTime() ?? 0)) {
            lastDevice.set(device.user_id, device)
        }
    }

    const rows = [...lastDevice.values()].map((device) => ({
        title: inboxText(campaign, isArabic(device)),
        location: CAMPAIGN_NOTIFICATION_LOCATION,
        location_id: campaign.id,
        // The link the push opens, so the entry opens it too (the column is a varchar(255))
        location_title: campaign.url && campaign.url.length <= 255 ? campaign.url : null,
        created_for_user_id: device.user_id,
        created_by_user_id: campaign.created_by_user_id ?? null,
    }))
    if (rows.length > 0) {
        await Notification.bulkCreate(rows, { hooks: false })
    }
    return rows.length
}

function inboxEnabled(): boolean {
    return campaignsConfig().inbox !== false && !!models().Notification
}

/** Stops pushing to a token Apple / Google told us is gone. */
async function disableDevices(deviceIds: number[]): Promise<void> {
    if (deviceIds.length === 0) {
        return
    }
    const { Device } = models()
    await Device.update({ push_token_status: DevicePushTokenStatus.DISABLED }, { where: { id: { [Op.in]: deviceIds } } })
}

const quotedTable = (model: any): string => (model.sequelize.getQueryInterface() as any).queryGenerator.quoteTable(model.getTableName())

/** Recomputes the campaign's counters from its deliveries (one query). */
export async function refreshCampaignStats(campaignId: number): Promise<void> {
    const { Campaign, Delivery } = models()
    await Campaign.sequelize.query(
        `UPDATE ${quotedTable(Campaign)} c
            SET sent_count      = s.sent,
                failed_count    = s.failed,
                delivered_count = s.delivered,
                opened_count    = s.opened
           FROM (SELECT COUNT(*) FILTER (WHERE status <> 'failed')    AS sent,
                        COUNT(*) FILTER (WHERE status = 'failed')     AS failed,
                        COUNT(*) FILTER (WHERE status = 'delivered')  AS delivered,
                        COUNT(*) FILTER (WHERE opened_at IS NOT NULL) AS opened
                   FROM ${quotedTable(Delivery)}
                  WHERE campaign_id = :id) s
          WHERE c.id = :id`,
        { replacements: { id: campaignId }, type: QueryTypes.UPDATE }
    )
}

function ticketError(ticket: ExpoPushTicket | null): string | null {
    if (!ticket || ticket.status !== 'error') {
        return null
    }
    return (ticket as any).details?.error || ticket.message || 'Error'
}

/**
 * Sends a campaign that is due. Safe to call from anywhere, any number of times,
 * from any number of API instances: the status flip to `sending` is the claim,
 * and only the caller that wins it sends anything.
 *
 * Returns false when the campaign was not claimable (not scheduled, or not due).
 */
export async function dispatchCampaign(campaignId: number): Promise<boolean> {
    const { Campaign, Delivery } = models()
    const [claimed] = await Campaign.update(
        { status: NotificationCampaignStatus.SENDING, error: null },
        {
            where: {
                id: campaignId,
                status: NotificationCampaignStatus.SCHEDULED,
                scheduled_at: { [Op.lte]: new Date() },
            },
        }
    )
    if (claimed === 0) {
        return false
    }

    const campaign = await Campaign.findByPk(campaignId)
    if (!campaign) {
        return false
    }

    try {
        const devices = await targetDevices(campaign)
        await campaign.update({ devices_count: devices.length })

        const outcomes = await sendToDevices(devices, (device) => buildMessage(campaign, device, { campaign_id: campaign.id }))

        await Delivery.bulkCreate(
            outcomes.map(({ device, ticket, error }) => {
                const ok = ticket?.status === 'ok'
                return {
                    campaign_id: campaign.id,
                    device_id: device.id,
                    user_id: device.user_id ?? null,
                    status: ok ? NotificationDeliveryStatus.SENT : NotificationDeliveryStatus.FAILED,
                    ticket_id: ok ? (ticket as any).id : null,
                    error: ok ? null : ticketError(ticket) ?? error ?? 'Unknown error',
                }
            }),
            { ignoreDuplicates: true }
        )

        await disableDevices(
            outcomes.filter((o) => o.ticket?.status === 'error' && (o.ticket as any).details?.error === 'DeviceNotRegistered').map((o) => o.device.id)
        )

        await campaign.update({ status: NotificationCampaignStatus.SENT, sent_at: new Date() })
        await refreshCampaignStats(campaign.id)

        console.log(`[Campaigns] #${campaign.id} sent to ${devices.length} device(s)`)

        // The pushes are out: a failure here must not mark the campaign failed
        if (campaign.show_in_notifications !== false && inboxEnabled()) {
            try {
                const people = await publishCampaignToInbox(campaign)
                console.log(`[Campaigns] #${campaign.id} added to ${people} notification centre(s)`)
            } catch (err) {
                console.error(`[Campaigns] #${campaign.id} notification centre failed:`, (err as Error)?.message || err)
            }
        }
        return true
    } catch (err) {
        const message = (err as Error)?.message || String(err)
        console.error(`[Campaigns] #${campaign.id} failed:`, message)
        await campaign.update({ status: NotificationCampaignStatus.FAILED, error: message })
        await refreshCampaignStats(campaign.id).catch(() => undefined)
        return true
    }
}

/**
 * Sends the campaign, exactly as people will get it, to one user's devices
 * only. Nothing is recorded: a test never counts in the results.
 */
export async function sendCampaignTest(campaign: any, userId: number): Promise<{ devices: number; sent: number; errors: string[] }> {
    const { Device } = models()
    const devices = await Device.findAll({
        where: { user_id: userId, push_token_status: DevicePushTokenStatus.ENABLED, status: true },
        include: [userInclude()],
    })
    // No campaign_id in the data: tapping a test must not count as an open.
    const outcomes = await sendToDevices(devices, (device) => buildMessage(campaign, device, { campaign_test: true }))

    return {
        devices: devices.length,
        sent: outcomes.filter((o) => o.ticket?.status === 'ok').length,
        errors: outcomes.map((o) => ticketError(o.ticket) ?? o.error).filter((e): e is string => !!e),
    }
}

/** The user a test goes to, by email, whatever its case. */
export async function findCampaignTestUser(email: string): Promise<any | null> {
    const { User } = models()
    return User.findOne({ where: sqlWhere(fn('lower', col('email')), email.trim().toLowerCase()) })
}

/**
 * Collects the receipts of the tickets old enough to have one. Receipts that
 * are not ready yet are simply retried on the next pass.
 */
export async function collectReceipts(): Promise<void> {
    const { Delivery } = models()
    const now = Date.now()
    const pending = await Delivery.findAll({
        where: {
            status: NotificationDeliveryStatus.SENT,
            ticket_id: { [Op.ne]: null },
            receipt_checked_at: null,
            created_at: { [Op.lte]: new Date(now - RECEIPT_DELAY_MS) },
        },
        limit: 5000,
        order: [['id', 'ASC']],
    })
    if (pending.length === 0) {
        return
    }

    const byTicket = new Map<string, any>(pending.map((d: any) => [d.ticket_id as string, d]))
    const touched = new Set<number>()
    const deadDevices: number[] = []

    for (const chunk of expo().chunkPushNotificationReceiptIds([...byTicket.keys()])) {
        let receipts: Record<string, any>
        try {
            receipts = await expo().getPushNotificationReceiptsAsync(chunk)
        } catch (err) {
            console.warn('[Campaigns] receipt fetch failed:', (err as Error)?.message)
            continue
        }

        for (const [ticketId, receipt] of Object.entries(receipts)) {
            const delivery = byTicket.get(ticketId)
            if (!delivery) {
                continue
            }
            const code = receipt.details?.error || receipt.message
            await delivery.update({
                status: receipt.status === 'ok' ? NotificationDeliveryStatus.DELIVERED : NotificationDeliveryStatus.FAILED,
                error: receipt.status === 'ok' ? null : code,
                receipt_checked_at: new Date(),
            })
            if (receipt.details?.error === 'DeviceNotRegistered') {
                deadDevices.push(delivery.device_id)
            }
            touched.add(delivery.campaign_id)
        }
    }

    // Expo no longer has a receipt for these: stop asking, they stay "sent".
    const expired = pending.filter((d: any) => !d.receipt_checked_at && d.created_at.getTime() < now - RECEIPT_TTL_MS)
    if (expired.length > 0) {
        await Delivery.update(
            { receipt_checked_at: new Date() },
            { where: { id: { [Op.in]: expired.map((d: any) => d.id) }, receipt_checked_at: null } }
        )
    }

    await disableDevices(deadDevices)
    for (const campaignId of touched) {
        await refreshCampaignStats(campaignId)
    }
}

/**
 * The app reports a tap on a campaign push, with its installation id. Idempotent:
 * only the first tap on a device counts (the app re-reports the launch
 * notification on every cold start).
 */
export async function recordCampaignOpen(campaignId: number, installationId: string): Promise<boolean> {
    const { Device, Delivery } = models()
    const device = await Device.findOne({ where: { device: installationId }, attributes: ['id'] })
    if (!device) {
        return false
    }

    const [updated] = await Delivery.update(
        { opened_at: new Date() },
        { where: { campaign_id: campaignId, device_id: device.id, opened_at: null } }
    )
    if (updated > 0) {
        await refreshCampaignStats(campaignId)
    }
    return updated > 0
}

/** Sends every scheduled campaign that has come due. */
async function dispatchDueCampaigns(): Promise<void> {
    const { Campaign } = models()
    const due = await Campaign.findAll({
        where: { status: NotificationCampaignStatus.SCHEDULED, scheduled_at: { [Op.lte]: new Date() } },
        attributes: ['id'],
        order: [['scheduled_at', 'ASC']],
    })
    for (const { id } of due) {
        await dispatchCampaign(id)
    }
}

let sweepTimer: NodeJS.Timeout | null = null
let sweeping = false

async function sweepOnce(): Promise<void> {
    if (sweeping) {
        return
    }
    sweeping = true
    try {
        // One server per turn. The leases are only there to spare the others
        // the work: the claim in dispatchCampaign is what makes a campaign go
        // out once, even when a long send outlives its lease.
        await runExclusive('pulse:push-campaigns', { ttlMs: SWEEP_INTERVAL_MS - 5_000, release: false }, dispatchDueCampaigns)
        await runExclusive('pulse:push-campaign-receipts', { ttlMs: RECEIPT_INTERVAL_MS - 5_000, release: false }, collectReceipts)
    } catch (err) {
        console.error('[Campaigns] sweep failed:', err)
    } finally {
        sweeping = false
    }
}

/**
 * Start the campaign sweep: due campaigns every minute, receipts every five.
 * The first pass waits a little, for the project's start-up migrations.
 *
 * A campaign left in `sending` by a crash mid-dispatch is NOT retried: some of
 * its pushes are already out, and sending again would double them. It shows up
 * as `sending` in the back-office, with its partial results.
 */
export function startCampaignSweep(): void {
    if (!config || config.sweep === false || sweepTimer) {
        return
    }
    setTimeout(sweepOnce, 15_000).unref()
    sweepTimer = setInterval(sweepOnce, SWEEP_INTERVAL_MS)
    sweepTimer.unref()
}
