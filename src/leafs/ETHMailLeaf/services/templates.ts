import etherial from 'etherial'
import { createHash } from 'crypto'

import { MailTemplate } from '../models/MailTemplate.js'
import { MailTemplateVersion } from '../models/MailTemplateVersion.js'
import { localizeBlocks, normalizeBlocks, normalizeLine, placeholdersOf } from './blocks.js'
import { peopleNames, person } from './people.js'
import { RenderedMail, render } from './render.js'
import { state } from './state.js'
import { activeTheme, normalizeTheme } from './theme.js'
import {
    LocalBlock,
    MailDefinition,
    MailError,
    MailTheme,
    examplesOf,
    isRtl,
    localesOf,
    localize,
    pickLocale,
    variablesOf,
} from './options.js'

// ──────────────────────────────────────────────────────────────────────────
// One email in one language: the back-office's version when there is one,
// else the code's. Rendering, sending, and what the back-office reads and
// saves.
// ──────────────────────────────────────────────────────────────────────────

export interface MailVersion {
    subject: string
    preheader: string
    blocks: LocalBlock[]
}

export interface SendInput {
    /** One address or several. */
    to: string | string[]
    /** What fills the `{{variables}}`. */
    data?: Record<string, unknown>
    /** Wins over the user's language. */
    locale?: string | null
    /** Gives the language (through the config's `locale`) and the id the message log is filed under. */
    user?: any
    userId?: number | null
    cc?: string | string[]
    bcc?: string | string[]
    replyTo?: string
    attachments?: any[]
}

export interface SendResult extends RenderedMail {
    key: string
    sent: boolean
    messageId?: string
    error?: string
}

export function definitions(): MailDefinition[] {
    return state.config.emails ?? []
}

export function definition(key: string): MailDefinition {
    const found = definitions().find((d) => d.key === key)
    if (!found) throw new MailError('email_not_found', 404, `No email "${key}" in the mail leaf's config`)
    return found
}

/** A language the project writes in, else a 400. */
export function checkLocale(locale: unknown): string {
    const { locales, defaultLocale } = localesOf(state.config)
    if (locale === undefined || locale === null || locale === '') return defaultLocale
    if (typeof locale !== 'string' || !locales.includes(locale)) throw new MailError('invalid_locale', 400)
    return locale
}

export function codeVersion(def: MailDefinition, locale: string): MailVersion {
    const { defaultLocale } = localesOf(state.config)
    return {
        subject: localize(def.subject, locale, defaultLocale),
        preheader: localize(def.preheader, locale, defaultLocale),
        blocks: localizeBlocks(def.blocks, locale, defaultLocale),
    }
}

/** Changes when the code's version of this email changes. */
export function hashOf(version: MailVersion): string {
    return createHash('sha1').update(JSON.stringify(version)).digest('hex')
}

/** Stored versions are checked again on the way out: a row edited by hand can't break an email. */
function storedVersion(row: MailTemplate | null): MailVersion | null {
    if (!row) return null
    try {
        return { subject: normalizeLine(row.subject, 'subject', true), preheader: normalizeLine(row.preheader, 'preheader', false), blocks: normalizeBlocks(row.blocks) }
    } catch (err: any) {
        console.error(`[ETHMailLeaf] The back-office's "${row.key}" (${row.locale}) is invalid, sending the code's:`, err?.message || err)
        return null
    }
}

async function customRow(key: string, locale: string): Promise<MailTemplate | null> {
    try {
        return await MailTemplate.findOne({ where: { key, locale } })
    } catch (err: any) {
        // No table yet, or the database is down: the code's version still goes out.
        console.error('[ETHMailLeaf] Could not read the back-office versions:', err?.message || err)
        return null
    }
}

/** The version that goes out: the back-office's when it has one (unless the email is locked), else the code's. */
export async function activeVersion(def: MailDefinition, locale: string): Promise<{ version: MailVersion; custom: boolean }> {
    if (def.editable !== false) {
        const custom = storedVersion(await customRow(def.key, locale))
        if (custom) return { version: custom, custom: true }
    }
    return { version: codeVersion(def, locale), custom: false }
}

/** `theme` is the one emails go out with (`activeTheme()`), or a draft the back-office previews. */
export function renderVersion(version: MailVersion, locale: string, data: Record<string, unknown>, theme: MailTheme, notice?: string): RenderedMail {
    const { defaultLocale } = localesOf(state.config)
    return render({
        ...version,
        data,
        locale,
        fallbackLocale: defaultLocale,
        rtl: isRtl(state.config, locale),
        theme,
        notice,
    })
}

async function userLocale(user: any): Promise<string | null> {
    if (!user || !state.config.locale) return null
    try {
        return (await state.config.locale(user)) ?? null
    } catch (err: any) {
        console.error("[ETHMailLeaf] The config's locale() failed:", err?.message || err)
        return null
    }
}

/** The language an email goes out in: the one asked, else the person's, else the default. */
export async function resolveLocale(input: { locale?: string | null; user?: any }): Promise<string> {
    return pickLocale(state.config, input.locale, await userLocale(input.user))
}

export async function renderMail(key: string, input: { data?: Record<string, unknown>; locale?: string | null; user?: any } = {}): Promise<RenderedMail> {
    const def = definition(key)
    const locale = await resolveLocale(input)
    const { version } = await activeVersion(def, locale)
    return renderVersion(version, locale, input.data ?? {}, await activeTheme())
}

export function pulse(): any {
    const leaf = (etherial as any).eth_pulse_leaf
    if (!leaf?.email) throw new MailError('pulse_missing', 500, 'ETHMailLeaf sends through ETHPulseLeaf: add it to the config, with an email provider')
    return leaf
}

/** Renders and sends through ETHPulseLeaf, which logs it in the person's timeline. Never throws on a send failure: reads `sent`. */
export async function sendMail(key: string, input: SendInput, options: { subjectPrefix?: string } = {}): Promise<SendResult> {
    const rendered = await renderMail(key, input)
    if (rendered.missing.length) console.warn(`[ETHMailLeaf] "${key}" sent without ${rendered.missing.map((v) => `{{${v}}}`).join(', ')}`)
    const subject = (options.subjectPrefix ?? '') + rendered.subject
    try {
        const result = await pulse()
            .email()
            .send(
                {
                    to: input.to,
                    cc: input.cc,
                    bcc: input.bcc,
                    from: state.config.from,
                    replyTo: input.replyTo ?? state.config.replyTo,
                    subject,
                    html: rendered.html,
                    text: rendered.text,
                    attachments: input.attachments,
                    userId: input.userId ?? input.user?.id ?? undefined,
                },
                state.config.provider
            )
        if (!result?.success) console.error(`[ETHMailLeaf] "${key}" was not sent:`, result?.error)
        return { ...rendered, subject, key, sent: !!result?.success, messageId: result?.messageId, error: result?.success ? undefined : result?.error }
    } catch (err: any) {
        if (err instanceof MailError) throw err
        console.error(`[ETHMailLeaf] "${key}" was not sent:`, err?.message || err)
        return { ...rendered, subject, key, sent: false, error: err?.message || String(err) }
    }
}

// ── What the back-office reads and saves

function variablesFor(def: MailDefinition, versions: MailVersion[]) {
    const declared = variablesOf(def)
    const names = new Set(declared.map((v) => v.name))
    const used = new Set(versions.flatMap((v) => placeholdersOf(v)))
    return {
        variables: declared.map((v) => ({ ...v, used: used.has(v.name) })),
        /** Written in a version, but the code never fills it in: it will come out blank. */
        unknown: [...used].filter((name) => !names.has(name)),
    }
}

export async function listMails() {
    const { locales } = localesOf(state.config)
    const rows = await MailTemplate.findAll({ attributes: ['key', 'locale', 'updated_at', 'default_hash'] }).catch(() => [] as MailTemplate[])
    return definitions().map((def) => {
        const custom = rows.filter((r) => r.key === def.key && locales.includes(r.locale))
        return {
            key: def.key,
            name: def.name,
            description: def.description ?? null,
            category: def.category ?? null,
            editable: def.editable !== false,
            subject: localize(def.subject, localesOf(state.config).defaultLocale, localesOf(state.config).defaultLocale),
            customized: custom.map((r) => r.locale),
            outdated: custom.filter((r) => r.default_hash && r.default_hash !== hashOf(codeVersion(def, r.locale))).map((r) => r.locale),
            updatedAt: custom.reduce<Date | null>((last, r) => (!last || r.updated_at > last ? r.updated_at : last), null),
        }
    })
}

export async function readMail(key: string, localeInput: unknown) {
    const def = definition(key)
    const locale = checkLocale(localeInput)
    const code = codeVersion(def, locale)
    const row = def.editable === false ? null : await customRow(key, locale)
    const custom = storedVersion(row)
    const { locales, defaultLocale } = localesOf(state.config)
    return {
        key: def.key,
        name: def.name,
        description: def.description ?? null,
        category: def.category ?? null,
        editable: def.editable !== false,
        locale,
        locales,
        defaultLocale,
        dir: isRtl(state.config, locale) ? 'rtl' : 'ltr',
        default: code,
        custom: custom && row ? { ...custom, updatedAt: row.updated_at, updatedBy: row.updated_by, outdated: !!row.default_hash && row.default_hash !== hashOf(code) } : null,
        ...variablesFor(def, [code, ...(custom ? [custom] : [])]),
    }
}

/** A version as the back-office sent it, checked. Missing parts are the code's. */
export function draftOf(def: MailDefinition, locale: string, body: any): MailVersion {
    const code = codeVersion(def, locale)
    return {
        subject: body?.subject === undefined ? code.subject : normalizeLine(body.subject, 'subject', true),
        preheader: body?.preheader === undefined ? code.preheader : normalizeLine(body.preheader, 'preheader', false),
        blocks: body?.blocks === undefined ? code.blocks : normalizeBlocks(body.blocks),
    }
}

/** The examples, with what the back-office typed over them. */
function previewData(def: MailDefinition, input: unknown): Record<string, unknown> {
    const data: Record<string, unknown> = examplesOf(def)
    if (input && typeof input === 'object' && !Array.isArray(input)) {
        for (const [name, value] of Object.entries(input)) if (typeof value === 'string' || typeof value === 'number') data[name] = value
    }
    return data
}

/** Renders a draft without saving it, with the examples: what the editor shows as you type. */
export async function previewMail(key: string, body: any) {
    const def = definition(key)
    const locale = checkLocale(body?.locale)
    const version = body?.subject === undefined && body?.blocks === undefined ? (await activeVersion(def, locale)).version : draftOf(def, locale, body)
    const rendered = renderVersion(version, locale, previewData(def, body?.data), await activeTheme())
    return { ...rendered, unknown: variablesFor(def, [version]).unknown }
}

/** An email as it goes out (its saved version, the examples), in a theme the back-office is editing. */
export async function previewTheme(body: any) {
    const locale = checkLocale(body?.locale)
    const theme = normalizeTheme(body?.theme)
    const def = typeof body?.key === 'string' && body.key ? definition(body.key) : definitions()[0]
    const version: MailVersion = def
        ? (await activeVersion(def, locale)).version
        : { subject: 'Hello', preheader: '', blocks: [{ type: 'heading', text: 'Hello' }, { type: 'text', text: 'This is how your emails look.' }] }
    return renderVersion(version, locale, def ? previewData(def, undefined) : {}, theme)
}

export async function saveMail(key: string, body: any, userId: number | null) {
    const def = definition(key)
    if (def.editable === false) throw new MailError('email_locked', 403, 'This email can only be changed in the code')
    const locale = checkLocale(body?.locale)
    const version = draftOf(def, locale, body)
    const restoredFrom = await restoredVersionId(key, locale, body?.restoredFrom)
    const values = { subject: version.subject, preheader: version.preheader || null, blocks: version.blocks, updated_by: userId, default_hash: hashOf(codeVersion(def, locale)) }

    await MailTemplate.sequelize!.transaction(async (transaction) => {
        const row = await MailTemplate.findOne({ where: { key, locale }, transaction })
        if (row) await row.update(values, { transaction })
        else await MailTemplate.create({ key, locale, ...values } as any, { transaction })
        await MailTemplateVersion.create(
            { key, locale, action: 'save', subject: values.subject, preheader: values.preheader, blocks: values.blocks, created_by: userId, restored_from: restoredFrom } as any,
            { transaction }
        )
    })
    return readMail(key, locale)
}

export async function resetMail(key: string, localeInput: unknown, userId: number | null = null) {
    definition(key)
    const locale = checkLocale(localeInput)
    await MailTemplate.sequelize!.transaction(async (transaction) => {
        const removed = await MailTemplate.destroy({ where: { key, locale }, transaction })
        // Only a reset that changed what goes out is history.
        if (removed) await MailTemplateVersion.create({ key, locale, action: 'reset', created_by: userId } as any, { transaction })
    })
    return readMail(key, locale)
}

// ── History

/** The version a save says it brings back: one of this email's, in this language, else nothing. */
async function restoredVersionId(key: string, locale: string, input: unknown): Promise<number | null> {
    const id = Number(input)
    if (input === undefined || input === null || !Number.isInteger(id) || id <= 0) return null
    const row = await MailTemplateVersion.findOne({ where: { id, key, locale }, attributes: ['id'] })
    return row ? row.id : null
}

const HISTORY_LIMIT = 100

/** The saves and resets of one email in one language, newest first. */
export async function listVersions(key: string, localeInput: unknown) {
    const def = definition(key)
    const locale = checkLocale(localeInput)
    const rows = await MailTemplateVersion.findAll({
        where: { key, locale },
        attributes: ['id', 'action', 'subject', 'created_by', 'restored_from', 'created_at'],
        order: [['id', 'DESC']],
        limit: HISTORY_LIMIT,
    })
    const names = await peopleNames(rows.map((r) => r.created_by))
    const live = def.editable !== false && !!(await customRow(key, locale))
    return rows.map((row, i) => ({
        id: row.id,
        action: row.action,
        subject: row.subject,
        createdAt: row.created_at,
        createdBy: person(row.created_by, names),
        restoredFrom: row.restored_from,
        /** What goes out now: the newest save, while the back-office's version is in place. */
        current: i === 0 && row.action === 'save' && live,
    }))
}

export async function readVersion(key: string, idInput: unknown) {
    definition(key)
    const id = Number(idInput)
    const row = Number.isInteger(id) && id > 0 ? await MailTemplateVersion.findOne({ where: { id, key } }) : null
    if (!row) throw new MailError('version_not_found', 404)
    const names = await peopleNames([row.created_by])
    return {
        id: row.id,
        locale: row.locale,
        action: row.action,
        subject: row.subject ?? '',
        preheader: row.preheader ?? '',
        blocks: row.blocks ?? [],
        createdAt: row.created_at,
        createdBy: person(row.created_by, names),
        restoredFrom: row.restored_from,
    }
}

/** Sends the draft (or the saved version) to one address, with the examples, `[Test]` in front of the subject. */
export async function testMail(key: string, body: any, fallbackTo: string | null) {
    const def = definition(key)
    const locale = checkLocale(body?.locale)
    const to = typeof body?.to === 'string' && body.to.trim() ? body.to.trim() : fallbackTo
    if (!to || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(to)) throw new MailError('invalid_recipient', 400)

    const version = body?.subject === undefined && body?.blocks === undefined ? (await activeVersion(def, locale)).version : draftOf(def, locale, body)
    const rendered = renderVersion(version, locale, previewData(def, body?.data), await activeTheme())
    const subject = '[Test] ' + rendered.subject
    const result = await pulse()
        .email()
        .send({ to, from: state.config.from, replyTo: state.config.replyTo, subject, html: rendered.html, text: rendered.text }, state.config.provider)
    if (!result?.success) throw new MailError('send_failed', 502, result?.error || 'The provider refused the email')
    return { sent: true, to, subject, messageId: result.messageId ?? null }
}
