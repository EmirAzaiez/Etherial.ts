import type { PageFonts } from './fonts.js'

// ──────────────────────────────────────────────────────────────────────────
// What a project tells the page leaf: its languages, where the pages go in
// the media leaf's bucket, and how they look on the web. The pages themselves
// are written in the back-office, block by block, in each language.
// ──────────────────────────────────────────────────────────────────────────

/** A text in each language: `{ en: '…', ar: '…' }`, or one text for all. */
export type Localized = string | Record<string, string>

/** `start` is left in English and right in Arabic; `end` the other way. */
export type Align = 'start' | 'center' | 'end'

/**
 * A color: one of the page's own, which each place that draws the page takes
 * from its theme (the web from `theme.colors`, the app from its palette), or
 * `#RRGGBB`.
 */
export type PageColor = (typeof COLOR_TOKENS)[number] | `#${string}`
export const COLOR_TOKENS = ['primary', 'text', 'muted', 'subtle', 'white', 'black'] as const

/** none 0 · sm 8 · md 20 · lg 36 · xl 56 (pixels, points in the app). */
export type Space = 'none' | 'sm' | 'md' | 'lg' | 'xl'

/** A run of text with its marks. `\n` in it is a line break. */
export interface Span {
    text: string
    bold?: true
    italic?: true
    underline?: true
    strike?: true
    color?: PageColor
    /** `https://`, `mailto:`, `tel:`, or `page:<slug>` to open another page. */
    link?: string
}

/** Text as the editor writes it: paragraphs and lists, top to bottom. */
export type RichNode = { type: 'paragraph'; spans: Span[] } | { type: 'list'; ordered?: true; items: Span[][] }
export type RichText = RichNode[]

/** The box any block can sit in. */
export interface BlockStyle {
    background?: PageColor
    /** The color of the text in the box. Default the page's, white on a dark background. */
    color?: PageColor
    /** Space inside the box. Default `md` when it has a background, else `none`. */
    padding?: Space
    /** Rounded corners, the theme's radius. */
    rounded?: boolean
    /** Edge to edge, out of the page's side margins. */
    bleed?: boolean
    /** Space above the block. Default `none`, `md` for a heading that is not the first block. */
    above?: Space
    /** Space below the block. Default `md`. */
    below?: Space
    /** The font of all its words, titles and text (an id of `FONTS`). Default the page's. */
    font?: string
}

/** An image: uploaded from the back-office, or an address. */
export interface PageImage {
    src: string
    /** The media row of an uploaded image, so the orphan cleanup keeps it. */
    media?: number
    /** For screen readers. */
    alt?: string
}

/** A button: its words and where it goes. */
export interface PageLink {
    label: string
    url: string
}

/** Width:height an image is cut to. `auto` keeps the image's own. */
export type Ratio = 'auto' | '16:9' | '4:3' | '1:1' | '3:4'

export type ContactKind = 'phone' | 'whatsapp' | 'email' | 'map' | 'website'

/**
 * The pieces a page is made of, top to bottom. Every link (a button's, a
 * span's, a card's) is `https://`, `mailto:`, `tel:` or `page:<slug>`.
 * Texts the editor formats are `Span[]` (one line) or `RichText`.
 */
export type PageBlock = (
    | { type: 'heading'; text: Span[]; level?: 1 | 2 | 3; align?: Align }
    | { type: 'text'; text: RichText; align?: Align; size?: 'sm' | 'md' | 'lg' }
    /** `soft`: the color, faint, behind the label. `color` replaces the primary one. */
    | { type: 'button'; label: string; url: string; align?: Align; variant?: 'primary' | 'outline' | 'soft'; color?: PageColor; full?: boolean }
    /** `width`: at most this many pixels wide. */
    | { type: 'image'; image: PageImage; caption?: string; url?: string; width?: number; align?: Align; ratio?: Ratio }
    /** A picture across the page with words on it. `overlay`: how dark it gets under them, 0 to 90 (%), default 35. */
    | {
          type: 'hero'
          image: PageImage
          title?: string
          subtitle?: string
          button?: PageLink
          height?: 'sm' | 'md' | 'lg'
          overlay?: number
          align?: Align
          position?: 'top' | 'center' | 'bottom'
      }
    | { type: 'gallery'; images: (PageImage & { caption?: string })[]; layout?: 'carousel' | 'grid'; ratio?: Ratio }
    /** YouTube, Vimeo, or a video file's address. */
    | { type: 'video'; url: string; poster?: PageImage; caption?: string }
    | { type: 'cards'; items: { image?: PageImage; title: string; text?: string; url?: string }[]; columns?: 1 | 2 }
    /** An image beside a text, on the `side` it says (on a phone, above it). */
    | { type: 'media-text'; image: PageImage; title?: string; text: RichText; button?: PageLink; side?: 'start' | 'end' }
    | { type: 'faq'; items: { question: string; answer: RichText }[] }
    /** Ways to reach someone: a phone number, a WhatsApp number, an email address, a map's link, a site. */
    | { type: 'contact'; items: { kind: ContactKind; value: string; label?: string }[]; layout?: 'buttons' | 'list' }
    /** `date` / `endDate`: `YYYY-MM-DD`; `startTime` / `endTime`: `HH:MM`, in the project's `timezone`. */
    | {
          type: 'event'
          title?: string
          date: string
          endDate?: string
          startTime?: string
          endTime?: string
          place?: string
          mapUrl?: string
          /** The "Add to calendar" link. Default true. */
          calendar?: boolean
      }
    | { type: 'quote'; text: string; author?: string }
    /** Key figures: "120 · Villas". */
    | { type: 'stats'; items: { value: string; label: string }[] }
    /** A boxed sentence that must not be missed. */
    | { type: 'note'; title?: string; text: RichText; tone?: 'info' | 'success' | 'warning' | 'danger' }
    /** Label / value lines: the hours, the place, the phone number. */
    | { type: 'details'; rows: { label: string; value: string }[] }
    | { type: 'divider' }
    | { type: 'spacer'; size?: Space }
) & { style?: BlockStyle }

export type PageBlockType = PageBlock['type']
export type BlockOf<T extends PageBlockType> = Extract<PageBlock, { type: T }>

export const BLOCK_TYPES: PageBlockType[] = [
    'heading',
    'text',
    'button',
    'image',
    'hero',
    'gallery',
    'video',
    'cards',
    'media-text',
    'faq',
    'contact',
    'event',
    'quote',
    'stats',
    'note',
    'details',
    'divider',
    'spacer',
]

/** A page's blocks, one list per language. */
export type PageBlocks = Record<string, PageBlock[]>

/**
 * What the app and the web get on top of a block, worked out by the API in
 * the page's language (`resolveBlocks`): nothing to compute on the phone.
 */
export interface ResolvedExtras {
    /** event: "14", "Nov", "Friday 14 November 2026", "19:00 – 22:00", the "Add to calendar" link (Google Calendar). */
    event?: { day: string; month: string; date: string; time: string | null; calendarUrl: string | null }
    /** video: what it is, the picture to show before it plays (YouTube's own when none is given), its player for a web page. */
    video?: { provider: 'youtube' | 'vimeo' | 'file' | 'link'; poster: string | null; embedUrl: string | null }
    /** contact: each item's link (`tel:`, `https://wa.me/…`, `mailto:`, the map, the site) and its words. */
    contact?: { href: string; label: string }[]
}

/** A block as the app gets it. */
export type ResolvedBlock = PageBlock & { resolved?: ResolvedExtras }

export interface PageTheme {
    /** Above every page on the web, and in the tab's title. */
    brandName?: Localized
    logoUrl?: string
    /** Logo height in pixels. Default 28. */
    logoHeight?: number
    colors?: {
        /** Buttons, links and the notes' bar. */
        primary?: string
        /** Text on the buttons. */
        onPrimary?: string
        text?: string
        /** Secondary text. */
        muted?: string
        background?: string
        border?: string
        /** The notes' background. */
        subtle?: string
    }
    /**
     * The fonts of the pages (ids of `FONTS`) until the back-office picks
     * others: the app's own, so that the web looks like it.
     */
    fonts?: PageFonts
    /** What the words are drawn in without a font of `FONTS`. Default the system's. */
    font?: string
    fontRtl?: string
    /** Corner radius of the buttons and images, in pixels. Default 12. */
    radius?: number
    /**
     * How every page opens until the back-office sets another look: its cover
     * photo, its title. A key left out is `DEFAULT_HEAD`'s.
     */
    head?: PageHead
}

export const HEAD_COVERS = ['none', 'sm', 'md', 'lg'] as const
export const HEAD_SIZES = ['sm', 'md', 'lg', 'xl'] as const
export const HEAD_WEIGHTS = ['regular', 'medium', 'bold'] as const

/**
 * How a page opens: the record's cover photo across the top (a news' own),
 * then the title and the line under it. Set for every page in the
 * back-office's settings, and page by page: a key a page leaves out is the
 * settings', then the theme's.
 */
export interface PageHead {
    /** The cover's height; `none` leaves it out. A page without a cover has none to show. */
    cover?: (typeof HEAD_COVERS)[number]
    /** The title and the line under it. */
    align?: Align
    size?: (typeof HEAD_SIZES)[number]
    weight?: (typeof HEAD_WEIGHTS)[number]
    /** In capitals. */
    upper?: boolean
    color?: PageColor
    /** A font of `FONTS`; without it, the titles' font. */
    font?: string
    /** This page's own photo across the top, over its record's (a news' photo on the list). A page's only: every page's look has none. */
    photo?: PageImage
}

/** How a page opens when nothing says otherwise: the look pages had before it could be set. */
export const DEFAULT_HEAD: Required<Omit<PageHead, 'font' | 'photo'>> = { cover: 'md', align: 'start', size: 'md', weight: 'bold', upper: false, color: 'text' }

/** Claude, writing a page from a few words in the editor ("Write with AI"). Needs the admin leaf's `features.ai`. */
export interface PageAIConfig {
    /** Default the assistant leaf's, else `ANTHROPIC_API_KEY`. */
    apiKey?: string
    /** Default the assistant leaf's, else `ANTHROPIC_BASE_URL`, else Anthropic's. */
    baseUrl?: string
    /** Default `claude-opus-5-5`. */
    model?: string
    /** How long Claude thinks before it writes. Default `low`: the first block comes sooner. */
    effort?: 'low' | 'medium' | 'high' | 'max'
    /** Ask another model when the first declines (`fallbacks: "default"`). Default on, off for Haiku. */
    fallbacks?: boolean
}

export interface ETHPageLeafConfig {
    /** The languages a page is written in. Default `['en']`. */
    locales?: string[]
    /** Shown when a page has nothing in the language asked. Default the first of `locales`. */
    defaultLocale?: string
    /** Default `['ar', 'he', 'fa', 'ur']`. */
    rtlLocales?: string[]
    /** The events' times are in it (`Asia/Dubai`): their "Add to calendar" link says so. */
    timezone?: string
    /**
     * The media leaf's folder the pages live in: their images, uploaded from
     * the back-office, and their HTML (`<folder>/<slug>/<locale>.html`). It
     * must be one of the media leaf's `public-read` folders. Default `pages`.
     */
    folder?: string
    /** The HTML's `Cache-Control`: short, so a change shows soon. Default `public, max-age=60`. */
    cacheControl?: string
    theme?: PageTheme
    /** Where the back-office lists them. Default the `Content` group. */
    admin?: { group?: string; order?: number; icon?: string }
    /** "Write with AI" in the editor: on when the admin leaf's AI is and a key is found. `false`: off. */
    ai?: PageAIConfig | false
}

/** Not `pages`: the back-office's own pages are at `/pages/<page>`. */
export const COLLECTION = 'content-pages'
export const BLOCKS_TYPE = 'page-blocks'
/** The `html` column on the back-office: the links of each language, to open or copy. */
export const LINKS_TYPE = 'page-links'
/**
 * A field of another collection whose content is a page (a news' text): its
 * blocks are written in that record's form, like a file in a media field, and
 * the page is saved and deleted with the record. The column keeps its id.
 */
export const PAGE_TYPE = 'page'

/** What a `page` field says next to its type: `{ name: 'page_id', type: 'page', page: { title: 'title' } }`. */
export interface PageFieldOptions {
    /** The record's column the page's title comes from. Default `title`. */
    title?: string
    /** The record's column the line under the title comes from. None by default. */
    summary?: string
    /** The record's column with its cover photo (a media field): above the title, across the page. None by default. */
    cover?: string
}

// A project's admin collections can write `page: { … }` on a field.
declare module '../../ETHAdminLeaf/features/ActionRegistry.js' {
    interface FieldDefinition {
        page?: PageFieldOptions
    }
}

const DEFAULT_RTL = ['ar', 'he', 'fa', 'ur']

/** The agent's name wherever a person reads it: the errors of Write with AI. */
export const AGENT_NAME = 'DLS Assistant'

export class PageError extends Error {
    constructor(
        message: string,
        public status = 400
    ) {
        super(message)
    }
}

export function defaultLocaleOf(config: ETHPageLeafConfig): string {
    return config.defaultLocale ?? config.locales?.[0] ?? 'en'
}

/** The languages a page is written in, the default one first. */
export function localesOf(config: ETHPageLeafConfig): string[] {
    const fallback = defaultLocaleOf(config)
    return [fallback, ...(config.locales ?? []).filter((l) => l !== fallback)]
}

export function rtlOf(config: ETHPageLeafConfig, locale: string): boolean {
    return (config.rtlLocales ?? DEFAULT_RTL).includes(locale)
}

export function folderOf(config: ETHPageLeafConfig): string {
    return (config.folder ?? 'pages').replace(/^\/+|\/+$/g, '')
}

/** The text in `locale`, else in the default language, else the first one written. */
export function localize(text: Localized | undefined | null, locale: string, fallback: string): string {
    if (text === undefined || text === null) return ''
    if (typeof text === 'string') return text.trim()
    const pick = (l: string) => (typeof text[l] === 'string' && text[l].trim() ? text[l].trim() : '')
    return pick(locale) || pick(fallback) || Object.keys(text).map(pick).find((t) => t) || ''
}

/** `ar-AE,ar;q=0.9` → `ar`. */
export function languageOf(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const lang = value.split(',')[0].trim().split(/[-_;]/)[0].toLowerCase()
    return /^[a-z]{2,3}$/.test(lang) ? lang : null
}

const NAMES: Record<string, string> = { en: 'English', ar: 'Arabic', fr: 'French', es: 'Spanish', de: 'German', it: 'Italian', ru: 'Russian', zh: 'Chinese' }

export function languageName(locale: string): string {
    return NAMES[locale] ?? locale.toUpperCase()
}
