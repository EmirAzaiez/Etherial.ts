import { randomUUID } from 'crypto'
import { Op, col, fn } from 'sequelize'

import { runExclusive } from '../../../components/database/lock.js'

import { MailCampaign, MailCampaignStatus } from '../models/MailCampaign.js'
import { MailCampaignRecipient } from '../models/MailCampaignRecipient.js'
import { MailUnsubscribe } from '../models/MailUnsubscribe.js'
import { normalizeBlocks, normalizeLine, placeholdersOf } from './blocks.js'
import { peopleNames, person } from './people.js'
import { state } from './state.js'
import { MailVersion, checkLocale, pulse, renderVersion, resolveLocale } from './templates.js'
import { activeTheme } from './theme.js'
import { isUnsubscribed, unsubscribeNotice, unsubscribeUrl, unsubscribedAmong } from './unsubscribe.js'
import { MailAudience, MailCampaignsConfig, MailError, MailRecipient, isRtl, localesOf, variablesOf } from './options.js'

// ──────────────────────────────────────────────────────────────────────────
// Campaigns: an email written in the back-office, in each language, sent once
// to one of the project's audiences. When it is due, its recipients are listed
// (one row per address, so listing again never doubles one), then a sweep sends
// them in small batches. A batch takes its rows atomically: two servers never
// send the same email. A row a stopped server left half-sent is marked failed,
// never sent again: it may have left.
// ──────────────────────────────────────────────────────────────────────────

const SWEEP_MS = 20_000
/** A campaign listing its recipients this long was left by a stopped server: listed again. */
const PREPARE_STALE_MS = 10 * 60_000
/** A row taken by a batch this long ago was left by a stopped server: failed. */
const SENDING_STALE_MS = 30 * 60_000
const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/
const EDITABLE: MailCampaignStatus[] = ['draft']
const DELETABLE: MailCampaignStatus[] = ['draft', 'cancelled', 'failed', 'sent']

function config(): MailCampaignsConfig {
    const campaigns = state.config.campaigns
    if (!campaigns) throw new MailError('campaigns_off', 404, 'Campaigns are not set up: add `campaigns` to the mail leaf config')
    return campaigns
}

// ── Content

type Content = Record<string, MailVersion>

const written = (version: MailVersion | undefined) => !!version && (!!version.subject || !!version.preheader || version.blocks.length > 0)

/** The languages as the back-office sent them, checked. A language with nothing written is left out. */
function normalizeContent(input: unknown): Content {
    const { locales } = localesOf(state.config)
    if (input === undefined || input === null) return {}
    if (typeof input !== 'object' || Array.isArray(input)) throw new MailError('invalid_content', 400, 'content must be one version per language')
    const content: Content = {}
    for (const locale of locales) {
        const raw = (input as any)[locale]
        if (!raw) continue
        const version: MailVersion = {
            subject: normalizeLine(raw.subject, 'subject', false),
            preheader: normalizeLine(raw.preheader, 'preheader', false),
            blocks: raw.blocks === undefined || raw.blocks === null ? [] : normalizeBlocks(raw.blocks),
        }
        if (written(version)) content[locale] = version
    }
    return content
}

/** Stored content is checked again on the way out; what fails is dropped (the default language then stands in). */
function storedContent(campaign: MailCampaign): Content {
    try {
        return normalizeContent(campaign.content)
    } catch (err: any) {
        console.error(`[ETHMailLeaf] Campaign #${campaign.id}'s content is invalid:`, err?.message || err)
        return {}
    }
}

/** The version for a language, else the default language's. */
function versionFor(content: Content, locale: string): { version: MailVersion; locale: string } | null {
    const { defaultLocale } = localesOf(state.config)
    if (written(content[locale])) return { version: content[locale], locale }
    if (written(content[defaultLocale])) return { version: content[defaultLocale], locale: defaultLocale }
    return null
}

/** What a campaign needs before it can leave. */
function checkSendable(campaign: MailCampaign, content: Content) {
    const { locales, defaultLocale } = localesOf(state.config)
    if (!campaign.audience) throw new MailError('audience_required', 400, 'Choose who the campaign goes to')
    const main = content[defaultLocale]
    if (!main?.subject || !main.blocks.length) {
        throw new MailError('content_required', 400, `Write the ${defaultLocale.toUpperCase()} version, with a subject and a block: it goes to everyone whose language has none`)
    }
    for (const locale of locales) {
        const version = content[locale]
        if (version && (!version.subject || !version.blocks.length)) {
            throw new MailError('content_incomplete', 400, `The ${locale.toUpperCase()} version needs a subject and at least one block, or nothing at all`)
        }
    }
}

// ── Variables and recipients

export function campaignVariables() {
    return variablesOf({ variables: state.config.campaigns?.variables ?? {} } as any)
}

function examples(): Record<string, unknown> {
    return Object.fromEntries(campaignVariables().map((v) => [v.name, v.example]))
}

/** Only plain values reach a recipient's row: their name, their unit. */
function cleanData(input: unknown): Record<string, string | number | boolean> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
    const out: Record<string, string | number | boolean> = {}
    for (const [key, value] of Object.entries(input).slice(0, 50)) {
        if (typeof value === 'string') out[key] = value.slice(0, 500)
        else if (typeof value === 'number' || typeof value === 'boolean') out[key] = value
    }
    return out
}

interface Person {
    email: string
    user_id: number | null
    locale: string
    data: Record<string, string | number | boolean>
}

/** Valid addresses, once each, lower case, with their language. */
async function normalizeRecipients(people: MailRecipient[]): Promise<Person[]> {
    const seen = new Set<string>()
    const out: Person[] = []
    for (const p of people ?? []) {
        const email = typeof p?.email === 'string' ? p.email.trim().toLowerCase() : ''
        if (email.length > 320 || !EMAIL.test(email) || seen.has(email)) continue
        seen.add(email)
        const userId = Number.isInteger(p.userId) ? (p.userId as number) : Number.isInteger(p.user?.id) ? p.user.id : null
        out.push({ email, user_id: userId, locale: await resolveLocale({ locale: p.locale, user: p.user }), data: cleanData(p.data) })
    }
    return out
}

export async function listAudiences(): Promise<MailAudience[]> {
    const list = await config().audiences()
    return (list ?? []).filter((a) => a && typeof a.key === 'string' && a.key).map((a) => ({ key: a.key, label: a.label || a.key, description: a.description, group: a.group }))
}

async function findAudience(key: unknown): Promise<MailAudience> {
    const found = (await listAudiences()).find((a) => a.key === key)
    if (!found) throw new MailError('audience_not_found', 400, 'This audience no longer exists: choose another one')
    return found
}

/** How many people an audience reaches today, by language. */
export async function countAudience(key: unknown) {
    const audience = await findAudience(key)
    const people = await config().recipients(audience.key)
    const list = await normalizeRecipients(people ?? [])
    const unsubscribed = await unsubscribedAmong(list.map((p) => p.email))
    const byLocale: Record<string, number> = {}
    for (const p of list) if (!unsubscribed.has(p.email)) byLocale[p.locale] = (byLocale[p.locale] ?? 0) + 1
    return {
        audience: audience.key,
        reachable: list.length - unsubscribed.size,
        unsubscribed: unsubscribed.size,
        /** No address, an invalid one, or one already listed. */
        invalid: (people?.length ?? 0) - list.length,
        byLocale,
    }
}

// ── What the back-office reads

async function find(idInput: unknown): Promise<MailCampaign> {
    const id = Number(idInput)
    const campaign = Number.isInteger(id) && id > 0 ? await MailCampaign.findByPk(id) : null
    if (!campaign) throw new MailError('campaign_not_found', 404)
    return campaign
}

function stats(c: MailCampaign) {
    return {
        recipients: c.recipients_count,
        sent: c.sent_count,
        failed: c.failed_count,
        skipped: c.skipped_count,
        unsubscribed: c.unsubscribed_count,
        pending: Math.max(0, c.recipients_count - c.sent_count - c.failed_count - c.skipped_count),
    }
}

function summary(c: MailCampaign, names: Map<number, string>) {
    const { defaultLocale } = localesOf(state.config)
    const content = (c.content ?? {}) as Record<string, any>
    return {
        id: c.id,
        name: c.name,
        status: c.status,
        audience: c.audience,
        audienceLabel: c.audience_label,
        subject: content[defaultLocale]?.subject ?? Object.values(content)[0]?.subject ?? '',
        locales: Object.keys(content),
        scheduledAt: c.scheduled_at,
        startedAt: c.started_at,
        finishedAt: c.finished_at,
        stats: stats(c),
        error: c.error,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        createdBy: person(c.created_by, names),
        updatedBy: person(c.updated_by, names),
        scheduledBy: person(c.scheduled_by, names),
    }
}

export async function listCampaigns(query: any) {
    const statuses = typeof query?.status === 'string' && query.status ? query.status.split(',') : null
    const page = Math.max(1, Number(query?.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 50))
    const { rows, count } = await MailCampaign.findAndCountAll({
        where: statuses ? { status: { [Op.in]: statuses } } : {},
        order: [['created_at', 'DESC']],
        offset: (page - 1) * limit,
        limit,
    })
    const names = await peopleNames(rows.flatMap((c) => [c.created_by, c.updated_by, c.scheduled_by]))
    return { items: rows.map((c) => summary(c, names)), total: count, page, limit }
}

export async function readCampaign(idInput: unknown) {
    const campaign = await find(idInput)
    const names = await peopleNames([campaign.created_by, campaign.updated_by, campaign.scheduled_by])
    const content = storedContent(campaign)
    const declared = new Set(campaignVariables().map((v) => v.name))
    const used = new Set(Object.values(content).flatMap((v) => placeholdersOf(v)))
    return {
        ...summary(campaign, names),
        content,
        editable: EDITABLE.includes(campaign.status),
        /** Written in the content, but no recipient has it: it will come out blank. */
        unknown: [...used].filter((name) => !declared.has(name) && name !== 'unsubscribe_url'),
    }
}

// ── What the back-office changes

export async function createCampaign(body: any, userId: number | null) {
    const name = normalizeName(body?.name) || 'Untitled campaign'
    const campaign = await MailCampaign.create({
        name,
        status: 'draft',
        audience: typeof body?.audience === 'string' && body.audience ? body.audience.slice(0, 200) : null,
        content: normalizeContent(body?.content),
        created_by: userId,
        updated_by: userId,
    } as any)
    return readCampaign(campaign.id)
}

function normalizeName(value: unknown): string {
    if (value === undefined || value === null) return ''
    if (typeof value !== 'string') throw new MailError('invalid_name', 400, 'The name must be text')
    const name = value.replace(/\s+/g, ' ').trim()
    if (name.length > 200) throw new MailError('invalid_name', 400, 'The name is longer than 200 characters')
    return name
}

function lockedMessage(status: string): string {
    return status === 'scheduled' ? 'Only a draft can be changed: unschedule it first' : 'This campaign has left: duplicate it to send it again'
}

export async function updateCampaign(idInput: unknown, body: any, userId: number | null) {
    const campaign = await find(idInput)
    if (!EDITABLE.includes(campaign.status)) throw new MailError('campaign_locked', 409, lockedMessage(campaign.status))
    const values: Record<string, unknown> = { updated_by: userId }
    if (body?.name !== undefined) values.name = normalizeName(body.name) || campaign.name
    if (body?.audience !== undefined) values.audience = typeof body.audience === 'string' && body.audience ? body.audience.slice(0, 200) : null
    if (body?.content !== undefined) values.content = normalizeContent(body.content)
    // Only while it is still a draft: a schedule that landed meanwhile wins.
    const [changed] = await MailCampaign.update(values, { where: { id: campaign.id, status: 'draft' } })
    if (!changed) throw new MailError('campaign_locked', 409, lockedMessage((await find(campaign.id)).status))
    return readCampaign(campaign.id)
}

export async function deleteCampaign(idInput: unknown) {
    const campaign = await find(idInput)
    if (!DELETABLE.includes(campaign.status)) throw new MailError('campaign_busy', 409, 'Unschedule or stop the campaign before deleting it')
    await MailCampaign.sequelize!.transaction(async (transaction) => {
        await MailCampaignRecipient.destroy({ where: { campaign_id: campaign.id }, transaction })
        await campaign.destroy({ transaction })
    })
    return { deleted: true, id: campaign.id }
}

export async function duplicateCampaign(idInput: unknown, userId: number | null) {
    const source = await find(idInput)
    const copy = await MailCampaign.create({
        name: `${source.name} (copy)`.slice(0, 200),
        status: 'draft',
        audience: source.audience,
        content: storedContent(source),
        created_by: userId,
        updated_by: userId,
    } as any)
    return readCampaign(copy.id)
}

/** The API's address for unsubscribe links: the config's, else the one the back-office reached. */
function publicUrl(origin: string | null): string | null {
    const configured = state.config.campaigns?.publicUrl
    if (configured && /^https?:\/\//i.test(configured)) return configured.replace(/\/+$/, '')
    return origin ? origin.replace(/\/+$/, '') : null
}

export async function scheduleCampaign(idInput: unknown, body: any, userId: number | null, origin: string | null) {
    const campaign = await find(idInput)
    if (campaign.status !== 'draft') throw new MailError('campaign_locked', 409, 'This campaign is not a draft anymore')
    checkSendable(campaign, storedContent(campaign))
    const audience = await findAudience(campaign.audience)
    const base = publicUrl(origin)
    if (!base) throw new MailError('public_url_missing', 500, "Set the mail leaf's campaigns.publicUrl: the unsubscribe links need the API's address")

    let at = new Date()
    if (body?.scheduledAt) {
        at = new Date(body.scheduledAt)
        if (Number.isNaN(at.getTime())) throw new MailError('invalid_date', 400, 'The date is not valid')
        if (at.getTime() < Date.now() - 5 * 60_000) throw new MailError('invalid_date', 400, 'Pick a time in the future')
        if (at.getTime() > Date.now() + 366 * 24 * 3600_000) throw new MailError('invalid_date', 400, 'Pick a time within a year')
    }
    const [scheduled] = await MailCampaign.update(
        { status: 'scheduled', scheduled_at: at, audience_label: audience.label.slice(0, 300), public_url: base, scheduled_by: userId, error: null },
        { where: { id: campaign.id, status: 'draft' } }
    )
    if (!scheduled) throw new MailError('campaign_locked', 409, 'This campaign is not a draft anymore')
    // Due now: no need to wait for the next sweep to list it; the sending
    // itself stays the sweep's, within the rate.
    if (at.getTime() <= Date.now()) setTimeout(() => sweepOnce({ startOnly: true }), 500).unref?.()
    return readCampaign(campaign.id)
}

export async function unscheduleCampaign(idInput: unknown, userId: number | null) {
    const campaign = await find(idInput)
    const [done] = await MailCampaign.update({ status: 'draft', scheduled_by: null, updated_by: userId }, { where: { id: campaign.id, status: 'scheduled' } })
    if (!done) throw new MailError('campaign_started', 409, 'The campaign has already started: stop it instead')
    return readCampaign(campaign.id)
}

/** Stops it: what has left has left, the rest stays home. */
export async function cancelCampaign(idInput: unknown, userId: number | null) {
    const campaign = await find(idInput)
    const [done] = await MailCampaign.update(
        { status: 'cancelled', finished_at: new Date(), updated_by: userId },
        { where: { id: campaign.id, status: { [Op.in]: ['scheduled', 'preparing', 'sending'] } } }
    )
    if (!done) throw new MailError('campaign_not_running', 409, 'This campaign is not sending')
    await MailCampaignRecipient.update({ status: 'cancelled' }, { where: { campaign_id: campaign.id, status: 'pending' } })
    await refreshStats(campaign.id)
    return readCampaign(campaign.id)
}

// ── Preview and test

function previewVersion(body: any): { version: MailVersion; locale: string } {
    const locale = checkLocale(body?.locale)
    const content = normalizeContent({ [locale]: body ?? {} })
    return { version: content[locale] ?? { subject: '', preheader: '', blocks: [] }, locale }
}

/** A draft as a recipient sees it, with the example variables and the unsubscribe line. */
export async function previewCampaign(body: any, origin: string | null) {
    const { version, locale } = previewVersion(body)
    const data = { ...examples(), ...cleanData(body?.data), unsubscribe_url: `${publicUrl(origin) ?? 'https://example.com'}/mail/unsubscribe` }
    const rendered = renderVersion(version, locale, data, await activeTheme(), unsubscribeNotice(locale))
    const declared = new Set(campaignVariables().map((v) => v.name))
    return { ...rendered, unknown: placeholdersOf(version).filter((name) => !declared.has(name) && name !== 'unsubscribe_url') }
}

/** The draft in one language to one address, `[Test]` in front of the subject. Its unsubscribe link works. */
export async function testCampaign(body: any, fallbackTo: string | null, origin: string | null) {
    const to = typeof body?.to === 'string' && body.to.trim() ? body.to.trim().toLowerCase() : fallbackTo?.toLowerCase()
    if (!to || !EMAIL.test(to)) throw new MailError('invalid_recipient', 400)
    const { version, locale } = previewVersion(body)
    if (!version.subject || !version.blocks.length) throw new MailError('content_required', 400, 'Write a subject and at least one block first')
    const base = publicUrl(origin)
    const url = base ? await unsubscribeUrl(base, to, null, locale) : ''
    const rendered = renderVersion(version, locale, { ...examples(), ...cleanData(body?.data), unsubscribe_url: url }, await activeTheme(), unsubscribeNotice(locale))
    const subject = '[Test] ' + rendered.subject
    const result = await pulse()
        .email()
        .send(
            { to, from: state.config.from, replyTo: state.config.replyTo, subject, html: rendered.html, text: rendered.text, headers: url ? unsubscribeHeaders(url) : undefined },
            state.config.provider
        )
    if (!result?.success) throw new MailError('send_failed', 502, result?.error || 'The provider refused the email')
    return { sent: true, to, subject, locale }
}

function unsubscribeHeaders(url: string): Record<string, string> {
    return { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
}

// ── Results

const RECIPIENT_STATUSES = ['pending', 'sending', 'sent', 'failed', 'skipped', 'cancelled']

export async function listRecipients(idInput: unknown, query: any) {
    const campaign = await find(idInput)
    const page = Math.max(1, Number(query?.page) || 1)
    const limit = Math.min(200, Math.max(1, Number(query?.limit) || 50))
    const where: any = { campaign_id: campaign.id }
    if (typeof query?.status === 'string' && RECIPIENT_STATUSES.includes(query.status)) where.status = query.status
    if (typeof query?.search === 'string' && query.search.trim()) where.email = { [Op.like]: `%${query.search.trim().toLowerCase().replace(/[%_\\]/g, '\\$&')}%` }
    const { rows, count } = await MailCampaignRecipient.findAndCountAll({
        where,
        attributes: ['id', 'email', 'user_id', 'locale', 'status', 'error', 'sent_at', 'updated_at'],
        order: [['id', 'ASC']],
        offset: (page - 1) * limit,
        limit,
    })
    const unsubscribed = await MailUnsubscribe.findAll({ where: { campaign_id: campaign.id, email: { [Op.in]: rows.map((r) => r.email) } }, attributes: ['email'], raw: true })
    const left = new Set(unsubscribed.map((u: any) => u.email))
    return {
        items: rows.map((r) => ({
            id: r.id,
            email: r.email,
            userId: r.user_id,
            locale: r.locale,
            status: r.status,
            error: r.error,
            sentAt: r.sent_at,
            unsubscribed: left.has(r.email),
        })),
        total: count,
        page,
        limit,
    }
}

async function refreshStats(campaignId: number) {
    const rows = (await MailCampaignRecipient.findAll({
        where: { campaign_id: campaignId },
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        group: ['status'],
        raw: true,
    })) as any[]
    const by = Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]))
    const total = rows.reduce((sum, r) => sum + Number(r.count), 0)
    await MailCampaign.update(
        {
            recipients_count: total,
            sent_count: by.sent ?? 0,
            failed_count: by.failed ?? 0,
            skipped_count: (by.skipped ?? 0) + (by.cancelled ?? 0),
            unsubscribed_count: await MailUnsubscribe.count({ where: { campaign_id: campaignId } }),
        },
        { where: { id: campaignId }, silent: true }
    )
}

// ── Sending

/** Lists a due campaign's recipients, then lets the sweep send them. */
async function prepare(campaignId: number) {
    const campaign = await MailCampaign.findByPk(campaignId)
    if (!campaign || campaign.status !== 'preparing') return

    let people: MailRecipient[]
    try {
        people = (await config().recipients(campaign.audience!)) ?? []
    } catch (err: any) {
        console.error(`[ETHMailLeaf] Campaign #${campaignId}: the audience could not be read:`, err?.message || err)
        await MailCampaign.update(
            { status: 'failed', finished_at: new Date(), error: `The audience could not be read: ${err?.message || err}` },
            { where: { id: campaignId, status: 'preparing' } }
        )
        return
    }

    const list = await normalizeRecipients(people)
    const unsubscribed = await unsubscribedAmong(list.map((p) => p.email))
    for (let i = 0; i < list.length; i += 500) {
        await MailCampaignRecipient.bulkCreate(
            list.slice(i, i + 500).map((p) => ({
                campaign_id: campaignId,
                email: p.email,
                user_id: p.user_id,
                locale: p.locale,
                data: p.data,
                status: unsubscribed.has(p.email) ? 'skipped' : 'pending',
                error: unsubscribed.has(p.email) ? 'Unsubscribed' : null,
            })) as any[],
            { ignoreDuplicates: true }
        )
    }

    const [started] = await MailCampaign.update({ status: 'sending' }, { where: { id: campaignId, status: 'preparing' } })
    // Stopped while it listed: nothing it listed leaves.
    if (!started) await MailCampaignRecipient.update({ status: 'cancelled' }, { where: { campaign_id: campaignId, status: 'pending' } })
    await refreshStats(campaignId)
    console.log(`[ETHMailLeaf] Campaign #${campaignId}: ${list.length - unsubscribed.size} recipient(s), ${unsubscribed.size} unsubscribed`)
}

async function deliver(campaign: MailCampaign, content: Content, recipient: MailCampaignRecipient, theme: any) {
    const picked = versionFor(content, recipient.locale)
    if (!picked) return { sent: false, error: 'The campaign has no content' }
    const url = await unsubscribeUrl(campaign.public_url!, recipient.email, campaign.id, picked.locale)
    const rendered = renderVersion(picked.version, picked.locale, { ...(recipient.data ?? {}), unsubscribe_url: url }, theme, unsubscribeNotice(picked.locale))
    try {
        const result = await pulse()
            .email()
            .send(
                {
                    to: recipient.email,
                    from: state.config.from,
                    replyTo: state.config.replyTo,
                    subject: rendered.subject,
                    html: rendered.html,
                    text: rendered.text,
                    headers: unsubscribeHeaders(url),
                    userId: recipient.user_id ?? undefined,
                },
                state.config.provider
            )
        return result?.success ? { sent: true, messageId: result.messageId as string | undefined } : { sent: false, error: String(result?.error || 'Refused by the provider') }
    } catch (err: any) {
        return { sent: false, error: String(err?.message || err) }
    }
}

/** Takes up to `limit` addresses of a campaign and sends them. Returns how many it took. */
async function sendBatch(campaign: MailCampaign, limit: number): Promise<number> {
    const ids = (
        (await MailCampaignRecipient.findAll({ where: { campaign_id: campaign.id, status: 'pending' }, attributes: ['id'], order: [['id', 'ASC']], limit, raw: true })) as any[]
    ).map((r) => r.id)
    if (!ids.length) return 0

    // Only the rows still pending are taken; another server's are left to it.
    const claim = randomUUID()
    await MailCampaignRecipient.update({ status: 'sending', claim }, { where: { id: { [Op.in]: ids }, status: 'pending' } })
    const batch = await MailCampaignRecipient.findAll({ where: { claim, status: 'sending' }, order: [['id', 'ASC']] })

    const content = storedContent(campaign)
    const theme = await activeTheme()
    for (const recipient of batch) {
        const current = await MailCampaign.findByPk(campaign.id, { attributes: ['status'] })
        if (current?.status !== 'sending') {
            await MailCampaignRecipient.update({ status: 'cancelled' }, { where: { claim, status: 'sending' } })
            break
        }
        if (await isUnsubscribed(recipient.email)) {
            await recipient.update({ status: 'skipped', error: 'Unsubscribed' })
            continue
        }
        const result = await deliver(campaign, content, recipient, theme)
        await recipient.update(
            result.sent
                ? { status: 'sent', sent_at: new Date(), message_id: result.messageId?.slice(0, 300) ?? null, error: null }
                : { status: 'failed', error: result.error?.slice(0, 2000) ?? 'Not sent' }
        )
    }
    await refreshStats(campaign.id)
    return batch.length
}

async function finishIfDone(campaignId: number) {
    const open = await MailCampaignRecipient.count({ where: { campaign_id: campaignId, status: { [Op.in]: ['pending', 'sending'] } } })
    if (open) return
    const [done] = await MailCampaign.update({ status: 'sent', finished_at: new Date() }, { where: { id: campaignId, status: 'sending' } })
    if (done) {
        await refreshStats(campaignId)
        console.log(`[ETHMailLeaf] Campaign #${campaignId} sent`)
    }
}

function batchSize(): number {
    const perMinute = Number(state.config.campaigns?.perMinute) || 60
    return Math.max(1, Math.floor((perMinute * SWEEP_MS) / 60_000))
}

/** Due campaigns: list their recipients. Claimed one by one, safe on any server. */
async function startDue() {
    const due = await MailCampaign.findAll({ where: { status: 'scheduled', scheduled_at: { [Op.lte]: new Date() } }, order: [['scheduled_at', 'ASC']], limit: 5 })
    for (const campaign of due) {
        const [taken] = await MailCampaign.update({ status: 'preparing', started_at: new Date() }, { where: { id: campaign.id, status: 'scheduled' } })
        if (taken) await prepare(campaign.id)
    }
}

async function sweep() {
    // 1. Due campaigns: list their recipients.
    await startDue()

    // 2. Listing for too long: its server stopped. Listing again is safe, one row per address.
    const stale = await MailCampaign.findAll({ where: { status: 'preparing', updated_at: { [Op.lt]: new Date(Date.now() - PREPARE_STALE_MS) } }, limit: 5 })
    for (const campaign of stale) {
        const [taken] = await MailCampaign.update({ status: 'preparing' }, { where: { id: campaign.id, status: 'preparing', updated_at: campaign.updated_at } })
        if (taken) await prepare(campaign.id)
    }

    // 3. Rows a stopped server took and never finished: failed, not sent again (they may have left).
    const interrupted = await MailCampaignRecipient.findAll({
        where: { status: 'sending', updated_at: { [Op.lt]: new Date(Date.now() - SENDING_STALE_MS) } },
        attributes: ['id', 'campaign_id'],
        raw: true,
    })
    if (interrupted.length) {
        await MailCampaignRecipient.update(
            { status: 'failed', error: 'Interrupted: the server stopped while sending it. Not sent again, in case it left.' },
            { where: { id: { [Op.in]: interrupted.map((r: any) => r.id) }, status: 'sending' } }
        )
        for (const id of new Set(interrupted.map((r: any) => r.campaign_id as number))) await refreshStats(id)
    }

    // 4. Sending: the next batch, oldest campaign first, within the rate.
    let budget = batchSize()
    const sending = await MailCampaign.findAll({ where: { status: 'sending' }, order: [['started_at', 'ASC']] })
    for (const campaign of sending) {
        if (budget > 0) budget -= await sendBatch(campaign, budget)
        await finishIfDone(campaign.id)
    }
}

let timer: NodeJS.Timeout | null = null
let running = false

/**
 * One turn, on one server. The rows are claimed, so two servers would not send
 * an address twice, but each would spend the whole `perMinute` budget: two
 * servers, twice the rate the provider was promised. The lease, kept for most
 * of the turn, makes the budget the whole cluster's.
 *
 * `startOnly`: just open the campaigns that are due, without sending — what
 * scheduling one for now asks, whoever holds the lease.
 */
async function sweepOnce(options: { startOnly?: boolean } = {}) {
    if (running) return
    running = true
    try {
        if (options.startOnly) await startDue()
        else await runExclusive('eth_mail.campaign_sweep', { ttlMs: SWEEP_MS - 2_000, release: false }, sweep)
    } catch (err: any) {
        console.error('[ETHMailLeaf] Campaign sweep failed:', err?.message || err)
    } finally {
        running = false
    }
}

/**
 * Sends the due campaigns every 20 seconds. The first sweep waits: a CLI
 * command boots the app too, and is usually done before it.
 */
export function startCampaignSweep() {
    if (!state.config.campaigns || timer) return
    setTimeout(() => sweepOnce(), 15_000).unref()
    timer = setInterval(() => sweepOnce(), SWEEP_MS)
    timer.unref()
}

/** What the back-office needs to open the Campaigns page. */
export function campaignsFeature() {
    const { locales, defaultLocale, rtlLocales } = localesOf(state.config)
    return {
        locales,
        defaultLocale,
        rtlLocales: rtlLocales.filter((l) => locales.includes(l)),
        variables: campaignVariables(),
        perMinute: Number(state.config.campaigns?.perMinute) || 60,
        dir: Object.fromEntries(locales.map((l) => [l, isRtl(state.config, l) ? 'rtl' : 'ltr'])),
    }
}
