import { createHash } from 'crypto'

import { PulseText } from '../models/PulseText.js'

// ──────────────────────────────────────────────────────────────────────────
// The texts of the automatic notifications ("Your appointment is confirmed."),
// written in the code in every language and rewritten in the back-office. A
// rewrite goes out instead of the code's text until it is reset.
// ──────────────────────────────────────────────────────────────────────────

export type PulseLocalized = string | Record<string, string>

export interface PulseTextVariable {
    label?: string
    example?: string | number
}

export interface PulseTextDefinition {
    /** Stable id the code sends with: `appointment.confirmed`. */
    key: string
    /** What the back-office shows: "Appointment confirmed". */
    name: string
    /** When it is sent. */
    description?: string
    /** Groups the back-office's list: "Appointments". */
    category?: string
    /** Where it shows, for the back-office's preview. Default `push`. */
    channel?: 'push' | 'sms' | 'inbox'
    /** What the code fills in: `{ time: { label: 'Appointment time', example: 'Sun 12 Oct, 10:00' } }`. */
    variables?: Record<string, PulseTextVariable | string | number>
    /** The code's text, in each language. `{{variable}}` is filled at send time. */
    text: PulseLocalized
    /** Longest text the back-office accepts. Default 240 (a push shows about 180). */
    maxLength?: number
    /** false: read in the back-office, changed only in the code. */
    editable?: boolean
}

export interface PulseTextsConfig {
    /** Languages the texts are written in. The first is the default. */
    locales: string[]
    defaultLocale?: string
    /** Written right to left. Default `['ar', 'fa', 'he', 'ur']`. */
    rtlLocales?: string[]
    /** A person's language, when `text()` is given a user and no locale. */
    locale?: (user: any) => string | null | undefined | Promise<string | null | undefined>
    items: PulseTextDefinition[]
}

export class PulseTextError extends Error {
    constructor(
        public code: string,
        public status = 400,
        message?: string
    ) {
        super(message || code)
    }
}

export const TEXTS_COLLECTION = 'pulse-texts'
const CACHE_MS = 30_000
/** `{{unit}}`, or `{{unit|your unit}}`: the text after `|` goes in when the value is empty. */
const PLACEHOLDER = /\{\{\s*([\w.]+)\s*(?:\|([^{}|]*))?\}\}/g

let config: PulseTextsConfig | null = null
let cache: { rows: Map<string, PulseText>; at: number } | null = null

export function setTextsConfig(input: PulseTextsConfig | undefined) {
    if (!input) return
    const keys = input.items.map((i) => i.key)
    const twice = keys.find((k, i) => keys.indexOf(k) !== i)
    if (twice) throw new Error(`[ETHPulseLeaf] Two texts share the key "${twice}"`)
    const bad = keys.find((k) => !/^[a-z0-9][a-z0-9_.-]{0,127}$/i.test(k))
    if (bad !== undefined) throw new Error(`[ETHPulseLeaf] "${bad}" can't be a text key: letters, digits, _ . - only`)
    if (!input.locales?.length) throw new Error('[ETHPulseLeaf] texts.locales is empty')
    config = input
}

export function textsEnabled() {
    return !!config
}

function conf(): PulseTextsConfig {
    if (!config) throw new PulseTextError('texts_off', 404, 'Notification texts are not set up: add `texts` to the pulse leaf config')
    return config
}

export function textLocales() {
    const { locales, defaultLocale, rtlLocales } = conf()
    return {
        locales,
        defaultLocale: defaultLocale && locales.includes(defaultLocale) ? defaultLocale : locales[0],
        rtlLocales: (rtlLocales ?? ['ar', 'fa', 'he', 'ur']).filter((l) => locales.includes(l)),
    }
}

function find(key: string): PulseTextDefinition {
    const item = conf().items.find((i) => i.key === key)
    if (!item) throw new PulseTextError('text_not_found', 404)
    return item
}

function checkLocale(value: unknown): string {
    const { locales } = textLocales()
    if (typeof value !== 'string' || !locales.includes(value)) throw new PulseTextError('invalid_locale', 400, `The language must be one of ${locales.join(', ')}`)
    return value
}

function codeText(item: PulseTextDefinition, locale: string): string {
    const { defaultLocale } = textLocales()
    if (typeof item.text === 'string') return item.text
    return item.text[locale] ?? item.text[defaultLocale] ?? Object.values(item.text)[0] ?? ''
}

const hashOf = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16)
const rowKey = (key: string, locale: string) => `${key}\u0000${locale}`

async function rows(): Promise<Map<string, PulseText>> {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows
    try {
        const all = await PulseText.findAll()
        cache = { rows: new Map(all.map((r) => [rowKey(r.key, r.locale), r])), at: Date.now() }
    } catch (err: any) {
        // No table yet, or the database is down: the code's texts still go out.
        console.error('[ETHPulseLeaf] Could not read the back-office texts:', err?.message || err)
        cache = { rows: new Map(), at: Date.now() }
    }
    return cache.rows
}

function variablesOf(item: PulseTextDefinition) {
    return Object.entries(item.variables ?? {}).map(([name, v]) =>
        v !== null && typeof v === 'object' ? { name, label: v.label ?? name, example: v.example === undefined ? '' : String(v.example) } : { name, label: name, example: String(v) }
    )
}

function fill(text: string, data: Record<string, unknown>): string {
    return text
        .replace(PLACEHOLDER, (_, path: string, fallback: string | undefined) => {
            const value = path.split('.').reduce<any>((at, part) => (at === null || at === undefined ? undefined : at[part]), data)
            const text = value === undefined || value === null || typeof value === 'object' ? '' : String(value).trim()
            return text || (fallback ?? '').trim()
        })
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
}

async function userLocale(user: any): Promise<string | null> {
    const locale = config?.locale
    if (!user || !locale) return null
    try {
        return (await locale(user)) ?? null
    } catch (err: any) {
        console.error("[ETHPulseLeaf] The texts' locale() failed:", err?.message || err)
        return null
    }
}

/**
 * The text a notification goes out with: the back-office's for that language
 * when it has one, else the code's. The language is `locale`, else the
 * user's, else the default one.
 */
export async function pulseText(key: string, input: { user?: any; locale?: string | null; data?: Record<string, unknown> } = {}): Promise<string> {
    const item = find(key)
    const { locales, defaultLocale } = textLocales()
    const asked = [input.locale, await userLocale(input.user)].map((l) => (typeof l === 'string' ? l.split(/[-_]/)[0].toLowerCase() : null))
    const locale = asked.find((l) => l && locales.includes(l)) ?? defaultLocale
    const custom = item.editable === false ? null : (await rows()).get(rowKey(key, locale))
    return fill(custom?.text ?? codeText(item, locale), input.data ?? {})
}

// ── The back-office

async function peopleNames(ids: (number | null)[]): Promise<Map<number, string>> {
    const wanted = [...new Set(ids.filter((id): id is number => Number.isInteger(id)))]
    const User = (PulseText.sequelize?.models as any)?.User
    if (!wanted.length || !User) return new Map()
    try {
        const columns = Object.keys(User.rawAttributes ?? {})
        const pick = ['firstname', 'first_name', 'lastname', 'last_name', 'name', 'email'].filter((c) => columns.includes(c))
        const users = await User.findAll({ where: { id: wanted }, attributes: ['id', ...pick], raw: true })
        return new Map(
            users.map((u: any) => {
                const name = [u.firstname ?? u.first_name, u.lastname ?? u.last_name].filter(Boolean).join(' ') || u.name || u.email
                return [u.id, name || `#${u.id}`]
            })
        )
    } catch {
        return new Map()
    }
}

export async function listTexts() {
    const { locales, defaultLocale, rtlLocales } = textLocales()
    const all = await rows()
    const names = await peopleNames([...all.values()].map((r) => r.updated_by))
    return {
        locales,
        defaultLocale,
        rtlLocales,
        items: conf().items.map((item) => ({
            key: item.key,
            name: item.name,
            description: item.description ?? null,
            category: item.category ?? null,
            channel: item.channel ?? 'push',
            variables: variablesOf(item),
            maxLength: item.maxLength ?? 240,
            editable: item.editable !== false,
            texts: Object.fromEntries(
                locales.map((locale) => {
                    const row = all.get(rowKey(item.key, locale))
                    const code = codeText(item, locale)
                    return [
                        locale,
                        {
                            default: code,
                            custom: row?.text ?? null,
                            updatedAt: row?.updated_at ?? null,
                            updatedBy: row?.updated_by ? { id: row.updated_by, name: names.get(row.updated_by) ?? `#${row.updated_by}` } : null,
                            /** The code's text changed since this one was saved. */
                            outdated: !!row && !!row.default_hash && row.default_hash !== hashOf(code),
                        },
                    ]
                })
            ),
        })),
    }
}

export async function saveText(key: string, body: any, userId: number | null) {
    const item = find(key)
    if (item.editable === false) throw new PulseTextError('text_locked', 403, 'This text can only be changed in the code')
    const locale = checkLocale(body?.locale)
    if (typeof body?.text !== 'string' || !body.text.trim()) throw new PulseTextError('invalid_text', 400, 'The text is empty')
    const text = body.text.replace(/\r\n?/g, '\n').trim()
    const max = item.maxLength ?? 240
    if (text.length > max) throw new PulseTextError('invalid_text', 400, `The text is longer than ${max} characters`)
    const declared = new Set(variablesOf(item).map((v) => v.name))
    const unknown = [...text.matchAll(PLACEHOLDER)].map((m) => m[1]).filter((name) => !declared.has(name.split('.')[0]))
    if (unknown.length) throw new PulseTextError('unknown_variable', 400, `{{${unknown[0]}}} is not filled by the code: ${declared.size ? `use ${[...declared].map((n) => `{{${n}}}`).join(', ')}` : 'this text has no variable'}`)

    const values = { text, updated_by: userId, default_hash: hashOf(codeText(item, locale)) }
    const row = await PulseText.findOne({ where: { key, locale } })
    if (row) await row.update(values)
    else await PulseText.create({ key, locale, ...values } as any)
    cache = null
    return listTexts()
}

export async function resetText(key: string, localeInput: unknown) {
    find(key)
    const locale = checkLocale(localeInput)
    await PulseText.destroy({ where: { key, locale } })
    cache = null
    return listTexts()
}
