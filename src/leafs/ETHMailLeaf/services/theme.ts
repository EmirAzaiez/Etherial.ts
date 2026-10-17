import { MailSetting } from '../models/MailSetting.js'
import { COLORS, FONT, FONT_RTL } from './render.js'
import { state } from './state.js'
import { Align, MailError, MailTheme, localesOf } from './options.js'

// ──────────────────────────────────────────────────────────────────────────
// The brand around every email: logo, colors, fonts, footer. Written in the
// project's config; the back-office can change it, and its version goes out
// instead until it is reset. Stored whole, checked again on the way out.
// ──────────────────────────────────────────────────────────────────────────

export type ColorKey = keyof typeof COLORS
export const COLOR_KEYS = Object.keys(COLORS) as ColorKey[]

/** The theme as the back-office edits it: every field set, texts in every language. */
export interface EditableTheme {
    brandName: Record<string, string>
    logoUrl: string
    logoWidth: number
    logoAlign: Align
    colors: Record<ColorKey, string>
    font: string
    fontRtl: string
    radius: number
    footer: Record<string, string>
    links: { label: Record<string, string>; url: string }[]
}

const THEME_KEY = 'theme'
const CACHE_MS = 30_000
const ALIGNS: Align[] = ['start', 'center', 'end']
const MAX_LINKS = 6

let cache: { custom: EditableTheme | null; at: number } | null = null

function invalid(message: string): never {
    throw new MailError('invalid_theme', 400, message)
}

function text(value: unknown, field: string, max: number): string {
    if (value === undefined || value === null) return ''
    if (typeof value !== 'string') invalid(`${field} must be text`)
    const trimmed = value.replace(/\r\n?/g, '\n').trim()
    if (trimmed.length > max) invalid(`${field} is longer than ${max} characters`)
    return trimmed
}

function localized(value: unknown, field: string, max: number): Record<string, string> {
    const { locales } = localesOf(state.config)
    if (value === undefined || value === null || value === '') return Object.fromEntries(locales.map((l) => [l, '']))
    if (typeof value === 'string') return Object.fromEntries(locales.map((l) => [l, text(value, field, max)]))
    if (typeof value !== 'object' || Array.isArray(value)) invalid(`${field} must be a text per language`)
    return Object.fromEntries(locales.map((l) => [l, text((value as any)[l], `${field} (${l})`, max)]))
}

function url(value: unknown, field: string, required: boolean): string {
    const href = text(value, field, 1000)
    if (!href) {
        if (required) invalid(`${field} is required`)
        return ''
    }
    if (!/^(https?:\/\/|mailto:|tel:)\S+$/i.test(href)) invalid(`${field} must start with https://, http://, mailto: or tel:`)
    return href
}

function color(value: unknown, key: ColorKey): string {
    if (value === undefined || value === null || value === '') return COLORS[key]
    if (typeof value !== 'string' || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())) invalid(`The ${key} color must be a hex color, like #85553A`)
    return value.trim().toUpperCase()
}

function font(value: unknown, field: string, fallback: string): string {
    const stack = text(value, field, 300)
    if (!stack) return fallback
    if (/[;"<>{}]/.test(stack)) invalid(`${field} can't contain ; " < > { }`)
    return stack
}

function int(value: unknown, field: string, min: number, max: number, fallback: number): number {
    if (value === undefined || value === null || value === '') return fallback
    const n = Number(value)
    if (!Number.isFinite(n)) invalid(`${field} must be a number`)
    return Math.max(min, Math.min(max, Math.round(n)))
}

/** A theme from the config or the back-office, checked, with every field set. */
export function normalizeTheme(input: unknown): EditableTheme {
    const theme = (input && typeof input === 'object' && !Array.isArray(input) ? input : {}) as Record<string, any>
    const colors = theme.colors && typeof theme.colors === 'object' ? theme.colors : {}
    const links = theme.links === undefined || theme.links === null ? [] : theme.links
    if (!Array.isArray(links)) invalid('links must be a list')
    if (links.length > MAX_LINKS) invalid(`${MAX_LINKS} links at most`)
    const align = theme.logoAlign ?? 'center'
    if (!ALIGNS.includes(align)) invalid('logoAlign must be start, center or end')

    return {
        brandName: localized(theme.brandName, 'The brand name', 80),
        logoUrl: url(theme.logoUrl, 'The logo', false),
        logoWidth: int(theme.logoWidth, 'The logo width', 24, 300, 120),
        logoAlign: align,
        colors: Object.fromEntries(COLOR_KEYS.map((key) => [key, color(colors[key], key)])) as Record<ColorKey, string>,
        font: font(theme.font, 'The font', FONT),
        fontRtl: font(theme.fontRtl, 'The right-to-left font', FONT_RTL),
        radius: int(theme.radius, 'The corner radius', 0, 24, 8),
        footer: localized(theme.footer, 'The footer', 1000),
        links: links.map((link: any, i: number) => ({
            label: localized(link?.label, `Link ${i + 1}'s label`, 60),
            url: url(link?.url, `Link ${i + 1}'s address`, true),
        })),
    }
}

/** The config's theme, as the back-office edits it. A config the checks refuse still renders: it is the developer's. */
function codeTheme(): EditableTheme {
    try {
        return normalizeTheme(state.config.theme ?? {})
    } catch (err: any) {
        console.error("[ETHMailLeaf] The config's theme is invalid:", err?.message || err)
        return normalizeTheme({})
    }
}

async function customRow(): Promise<MailSetting | null> {
    try {
        return await MailSetting.findOne({ where: { key: THEME_KEY } })
    } catch (err: any) {
        console.error('[ETHMailLeaf] Could not read the back-office theme:', err?.message || err)
        return null
    }
}

function storedTheme(row: MailSetting | null): EditableTheme | null {
    if (!row?.value) return null
    try {
        // The code's colors under the stored ones: a color the code adds later is not lost.
        return normalizeTheme({ ...row.value, colors: { ...state.config.theme?.colors, ...row.value.colors } })
    } catch (err: any) {
        console.error("[ETHMailLeaf] The back-office theme is invalid, using the code's:", err?.message || err)
        return null
    }
}

/** The theme emails go out with: the back-office's when it has one, else the config's. Cached 30 s. */
export async function activeTheme(): Promise<MailTheme> {
    if (!cache || Date.now() - cache.at > CACHE_MS) cache = { custom: storedTheme(await customRow()), at: Date.now() }
    return cache.custom ?? state.config.theme ?? {}
}

export async function readTheme() {
    const row = await customRow()
    const custom = storedTheme(row)
    const { locales, defaultLocale, rtlLocales } = localesOf(state.config)
    return {
        locales,
        defaultLocale,
        rtlLocales: rtlLocales.filter((l) => locales.includes(l)),
        default: codeTheme(),
        custom: custom && row ? { ...custom, updatedAt: row.updated_at, updatedBy: row.updated_by } : null,
        defaults: { colors: COLORS, font: FONT, fontRtl: FONT_RTL, logoWidth: 120, radius: 8 },
    }
}

export async function saveTheme(input: unknown, userId: number | null) {
    const theme = normalizeTheme(input)
    const row = await MailSetting.findOne({ where: { key: THEME_KEY } })
    if (row) await row.update({ value: theme, updated_by: userId })
    else await MailSetting.create({ key: THEME_KEY, value: theme, updated_by: userId } as any)
    cache = null
    return readTheme()
}

export async function resetTheme() {
    await MailSetting.destroy({ where: { key: THEME_KEY } })
    cache = null
    return readTheme()
}
