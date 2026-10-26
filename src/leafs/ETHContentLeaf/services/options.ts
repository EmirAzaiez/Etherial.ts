// ──────────────────────────────────────────────────────────────────────────
// What a project tells the content leaf: its languages, the contents it
// offers, the media folder of its images, and what a new server starts with.
// The contents themselves are written in the back-office, in each language.
// ──────────────────────────────────────────────────────────────────────────

import type { Request } from 'express'

/** A text in each language: `{ en: '…', ar: '…' }`, or one text for all. */
export type Localized = string | Record<string, string>

/**
 * - `languages`: the languages the contents are written in, and those the
 *   app gets, set in the back-office (else `locales`, for good);
 * - `faq`: sections and their questions (Help & FAQ);
 * - `contacts`: the ways to reach the company, and its offices;
 * - `legal`: terms, privacy policy…;
 * - `banners`: the home screen's carousel;
 * - `stories`: full-screen slides behind a bubble;
 * - `versions`: the app's versions on the stores, and what an older one asks.
 */
export type ContentFeature = 'languages' | 'faq' | 'contacts' | 'legal' | 'banners' | 'stories' | 'versions'
export const FEATURES: ContentFeature[] = ['languages', 'faq', 'contacts', 'legal', 'banners', 'stories', 'versions']

/** Who sees a banner or a story. */
export const AUDIENCES = ['everyone', 'signed_in', 'guests'] as const
export type Audience = (typeof AUDIENCES)[number]

export const CONTACT_KINDS = ['phone', 'whatsapp', 'email', 'website', 'instagram', 'facebook', 'x', 'linkedin', 'youtube', 'tiktok', 'snapchat'] as const
export type ContactKind = (typeof CONTACT_KINDS)[number]

export const PLATFORMS = ['ios', 'android'] as const
export type Platform = (typeof PLATFORMS)[number]
export const PLATFORM_NAMES: Record<Platform, string> = { ios: 'iOS', android: 'Android' }

/**
 * What an app older than a version does:
 * - `auto`: a banner asks to update when the version is a new major one
 *   (2.0 after 1.x), nothing for a minor one (1.5 after 1.4);
 * - `banner`: a banner asks to update, whatever the version;
 * - `required`: the app is blocked until it is updated.
 */
export const PROMPTS = ['auto', 'banner', 'required'] as const
export type Prompt = (typeof PROMPTS)[number]

export interface SeedFaqSection {
    title: Localized
    questions: { question: Localized; answer: Localized }[]
}

export interface SeedContact {
    kind: ContactKind
    /** A phone number, an email address, an address on the web. */
    value: string
    label?: Localized
    hours?: Localized
}

export interface SeedOffice {
    name: Localized
    address?: Localized
    phone?: string
    email?: string
    hours?: Localized
    latitude?: number
    longitude?: number
    map_url?: string
}

export interface SeedLegal {
    /** `terms`, `privacy`: what the app asks for. */
    slug: string
    title: Localized
    /** HTML. */
    body?: Localized
    /** A page on the project's website, opened instead of the text. */
    url?: Localized
    version?: string
}

export interface ETHContentLeafConfig {
    /**
     * The languages the contents are written in. Default `['en']`. With
     * `languages`, those a new server starts with: the back-office's
     * Content › Languages has the say from then on.
     */
    locales?: string[]
    /** Shown when a text has nothing in the language asked. Default the first of `locales`. */
    defaultLocale?: string
    /** Default `['ar', 'he', 'fa', 'ur']`. */
    rtlLocales?: string[]
    /**
     * The contents this project offers: their tables, collections and routes.
     * Default all of them. Leave out one the project already has its own of,
     * whose route the app calls.
     */
    features?: ContentFeature[]
    /**
     * The media leaf's folder of the banners' and stories' images, uploaded
     * from the back-office. Guests see them: it must be `public-read`.
     * Default `content`.
     */
    folder?: string
    /** The project's media model, as Sequelize names it. Default `Media`. */
    mediaModel?: string
    /**
     * Whether the request comes from someone signed in, for the banners and
     * stories of an audience. Default: a valid Bearer token from etherial's
     * auth. A project whose tokens can be revoked (sessions) checks its own.
     */
    signedIn?: (req: Request) => boolean | Promise<boolean>
    /**
     * The app's page on each store, where the update button leads:
     * `https://apps.apple.com/app/id…`, `https://play.google.com/store/apps/details?id=…`.
     */
    stores?: Partial<Record<Platform, string>>
    /**
     * What a new server starts with, written on its first boot only: each
     * table is seeded once, while it has never had a row, so a content the
     * team empties stays empty.
     */
    seed?: {
        faq?: SeedFaqSection[]
        contacts?: SeedContact[]
        offices?: SeedOffice[]
        legal?: SeedLegal[]
    }
    /** Where the back-office lists them. Default the `Content` group. */
    admin?: { group?: string; order?: number }
}

/** The back-office's collections: what goes in a project's `navigation` and in the roles' rights. */
export const COLLECTIONS = {
    languages: 'content-languages',
    faq: 'content-faq',
    faqQuestions: 'content-faq-questions',
    contacts: 'content-contacts',
    offices: 'content-offices',
    legal: 'content-legal',
    banners: 'content-banners',
    stories: 'content-stories',
    storySlides: 'content-story-slides',
    versions: 'content-app-versions',
} as const

/** The longest `label`: a back-office title, not the text itself. */
const LABEL_LENGTH = 200

const DEFAULT_RTL = ['ar', 'he', 'fa', 'ur']

/**
 * The languages the contents are written in, as the leaf runs them: from the
 * back-office (`languages`), else from the config.
 */
export interface Languages {
    /** Every one, the default first: the back-office's fields. */
    all: string[]
    /** Those the app gets, the default first. The others are being translated. */
    app: string[]
    /** What a text missing in another language falls back to. */
    default: string
    /** Those written right to left. */
    rtl: string[]
    /** Each one's name, as the app's language picker shows it. */
    names: Record<string, string>
}

export class ContentError extends Error {
    constructor(
        message: string,
        public status = 400
    ) {
        super(message)
    }
}

export function defaultLocaleOf(config: ETHContentLeafConfig): string {
    return config.defaultLocale ?? config.locales?.[0] ?? 'en'
}

/** The languages the contents are written in, the default one first. */
export function localesOf(config: ETHContentLeafConfig): string[] {
    const fallback = defaultLocaleOf(config)
    return [fallback, ...(config.locales ?? []).filter((l) => l !== fallback)]
}

export function rtlOf(config: ETHContentLeafConfig, locale: string): boolean {
    return (config.rtlLocales ?? DEFAULT_RTL).includes(locale)
}

/** The config's languages, every one in the app. */
export function languagesOf(config: ETHContentLeafConfig): Languages {
    const all = localesOf(config)
    return {
        all,
        app: all,
        default: all[0],
        rtl: all.filter((l) => rtlOf(config, l)),
        names: Object.fromEntries(all.map((l) => [l, nativeName(l)])),
    }
}

export function featuresOf(config: ETHContentLeafConfig): ContentFeature[] {
    return config.features ?? FEATURES
}

export function folderOf(config: ETHContentLeafConfig): string {
    return (config.folder ?? 'content').replace(/^\/+|\/+$/g, '')
}

/** The text in `locale`, else in the default language, else the first one written. */
export function localize(text: Localized | undefined | null, locale: string, fallback: string): string {
    if (text === undefined || text === null) return ''
    if (typeof text === 'string') return text.trim()
    const pick = (l: string) => (typeof text[l] === 'string' && text[l].trim() ? text[l].trim() : '')
    return pick(locale) || pick(fallback) || Object.keys(text).map(pick).find((t) => t) || ''
}

/** A seed's text as a column holds it: `{ <default locale>: text }` for one text. */
export function localizedOf(text: Localized | undefined, fallback: string): Record<string, string> {
    if (text === undefined || text === null) return {}
    if (typeof text === 'string') return { [fallback]: text }
    return { ...text }
}

/**
 * What the back-office shows of a text in its lists and on a card: the
 * default language's, on one line. Its translations are JSON, which the
 * back-office can neither search nor print as a title.
 */
export function labelOf(text: Localized | undefined | null, fallback: string): string {
    return localize(text, fallback, fallback).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, LABEL_LENGTH)
}

/** `2.10.1` → `[2, 10, 1]`; null for anything but numbers between dots. */
export function parseVersion(value: unknown): number[] | null {
    if (typeof value !== 'string' || !/^\d{1,6}(\.\d{1,6}){0,3}$/.test(value.trim())) return null
    return value.trim().split('.').map(Number)
}

/** `1.10.0` > `1.9.2`: a missing part counts as 0. Versions that aren't one compare as 0. */
export function compareVersions(a: string, b: string): number {
    const [pa, pb] = [parseVersion(a) ?? [0], parseVersion(b) ?? [0]]
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
        if (diff) return Math.sign(diff)
    }
    return 0
}

/** `fr`, `zh`: the codes a language goes by (`languageOf`). */
export function isLocale(value: unknown): value is string {
    return typeof value === 'string' && /^[a-z]{2,3}$/.test(value)
}

/** `ar-AE,ar;q=0.9` → `ar`. */
export function languageOf(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const lang = value.split(',')[0].trim().split(/[-_;]/)[0].toLowerCase()
    return isLocale(lang) ? lang : null
}

/** `Privacy Policy` → `privacy-policy`. */
export function slugify(text: string): string {
    return text
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
}

/** The languages the back-office offers to add: each one's name in English, and in itself. */
export const LANGUAGES: Record<string, { name: string; native: string }> = {
    en: { name: 'English', native: 'English' },
    ar: { name: 'Arabic', native: 'العربية' },
    fr: { name: 'French', native: 'Français' },
    es: { name: 'Spanish', native: 'Español' },
    de: { name: 'German', native: 'Deutsch' },
    it: { name: 'Italian', native: 'Italiano' },
    pt: { name: 'Portuguese', native: 'Português' },
    nl: { name: 'Dutch', native: 'Nederlands' },
    sv: { name: 'Swedish', native: 'Svenska' },
    pl: { name: 'Polish', native: 'Polski' },
    ro: { name: 'Romanian', native: 'Română' },
    el: { name: 'Greek', native: 'Ελληνικά' },
    tr: { name: 'Turkish', native: 'Türkçe' },
    ru: { name: 'Russian', native: 'Русский' },
    uk: { name: 'Ukrainian', native: 'Українська' },
    he: { name: 'Hebrew', native: 'עברית' },
    fa: { name: 'Persian', native: 'فارسی' },
    ur: { name: 'Urdu', native: 'اردو' },
    hi: { name: 'Hindi', native: 'हिन्दी' },
    bn: { name: 'Bengali', native: 'বাংলা' },
    ta: { name: 'Tamil', native: 'தமிழ்' },
    ml: { name: 'Malayalam', native: 'മലയാളം' },
    tl: { name: 'Filipino', native: 'Filipino' },
    id: { name: 'Indonesian', native: 'Bahasa Indonesia' },
    ms: { name: 'Malay', native: 'Bahasa Melayu' },
    th: { name: 'Thai', native: 'ไทย' },
    vi: { name: 'Vietnamese', native: 'Tiếng Việt' },
    zh: { name: 'Chinese', native: '中文' },
    ja: { name: 'Japanese', native: '日本語' },
    ko: { name: 'Korean', native: '한국어' },
}

/** In English, for the back-office's messages. */
export function languageName(locale: string): string {
    return LANGUAGES[locale]?.name ?? locale.toUpperCase()
}

/** In itself, on the back-office's language switch and the app's picker. */
export function nativeName(locale: string): string {
    return LANGUAGES[locale]?.native ?? locale.toUpperCase()
}
