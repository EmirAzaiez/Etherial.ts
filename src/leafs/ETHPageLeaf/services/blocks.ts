import {
    Align,
    BLOCK_TYPES,
    BlockStyle,
    COLOR_TOKENS,
    ContactKind,
    HEAD_COVERS,
    HEAD_SIZES,
    HEAD_WEIGHTS,
    Localized,
    PageBlock,
    PageBlocks,
    PageColor,
    PageError,
    PageHead,
    PageImage,
    PageLink,
    Ratio,
    RichNode,
    RichText,
    Space,
    Span,
    languageName,
} from './options.js'
import { fontIdOf } from './fonts.js'
import { pageIconOf } from './icons.js'

// ──────────────────────────────────────────────────────────────────────────
// A page as the back-office sends it, checked before it is saved: its title,
// its address, and its blocks in each language. A block that isn't finished
// (a button without its link, an event without its date) is refused, so the
// web never shows half a page; an option that makes no sense (a color, a
// size) is dropped. The preview and the templates read the same blocks as
// drafts: nothing is refused, an unfinished block stays as it is.
// ──────────────────────────────────────────────────────────────────────────

/** `strict` refuses a block not finished; `draft` keeps it. */
export type Mode = 'strict' | 'draft'

const MAX_BLOCKS = 100
const MAX_RICH = 10000
const MAX_URL = 2000
const MAX_SPANS = 300
const MAX_NODES = 200
const MAX_LIST_ITEMS = 100

const ALIGNS: Align[] = ['start', 'center', 'end']
const SPACES: Space[] = ['none', 'sm', 'md', 'lg', 'xl']
const RATIOS: Ratio[] = ['auto', '16:9', '4:3', '1:1', '3:4']
const CONTACT_KINDS: ContactKind[] = ['phone', 'whatsapp', 'email', 'map', 'website']

/** `page:opening-hours`: opens another page, in the app as on the web. */
export const PAGE_LINK = /^page:([a-z0-9]+(?:-[a-z0-9]+)*)$/
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_SLUG = 80

const LINK_RULE = 'a link starts with https://, mailto: or tel:, or is page: and the address of another page.'
const IMAGE_RULE = 'upload the image, or give its address (https://…).'

/** A link that opens something: `https://`, `mailto:`, `tel:`, `page:<slug>`. Anything else is ''. */
export function linkOf(value: unknown): string {
    if (typeof value !== 'string') return ''
    let out = value.trim()
    // A number as people write it: `tel:+971 2 448 0011`.
    if (/^tel:/i.test(out)) out = 'tel:' + out.slice(4).replace(/[\s().-]/g, '')
    if (/^page:/i.test(out)) out = out.toLowerCase()
    if (!out || out.length > MAX_URL || /\s/.test(out)) return ''
    if (PAGE_LINK.test(out)) return out
    if (/^https:\/\/[^/?#\s]+\.[^/?#\s]+/i.test(out)) return out
    if (/^mailto:[^@\s?]+@[^@\s?]+\.[^@\s?]+(\?.*)?$/i.test(out)) return out
    if (/^tel:\+?\d{3,}$/i.test(out)) return out
    return ''
}

/** An image's or a video's address: https only (the app and a web page served over https refuse the rest). */
function httpsOf(value: unknown): string {
    if (typeof value !== 'string') return ''
    const out = value.trim()
    return out.length <= MAX_URL && /^https:\/\/[^/?#\s]+\S*$/i.test(out) ? out : ''
}

/** A color token, or `#RRGGBB` (`#abc` is written out in full). Anything else is undefined. */
export function colorOf(value: unknown): PageColor | undefined {
    if (typeof value !== 'string') return undefined
    const out = value.trim()
    if ((COLOR_TOKENS as readonly string[]).includes(out)) return out as PageColor
    const hex = out.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
    if (!hex) return undefined
    const six = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1]
    return `#${six.toUpperCase()}`
}

/** A latitude (`max` 90) or a longitude (180) in degrees, to six places. */
function degrees(value: unknown, max: number): number | undefined {
    if (value === '' || value === null || value === undefined) return undefined
    const n = Number(value)
    return Number.isFinite(n) && Math.abs(n) <= max ? Math.round(n * 1e6) / 1e6 : undefined
}

function oneOf<T>(value: unknown, allowed: readonly T[]): T | undefined {
    return allowed.includes(value as T) ? (value as T) : undefined
}

function raw(value: unknown): string {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    return typeof value === 'string' ? value.replace(/\r\n?/g, '\n') : ''
}

/** Without its undefined keys: what is saved is what the JSON says. */
function compact<T extends object>(value: T): T {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T
}

/** Where a block is, and how hard to be on it. */
class Check {
    constructor(
        readonly at: string,
        readonly draft: boolean
    ) {}

    /** Strict: refuses the block. Draft: lets it through. */
    need(ok: unknown, message: string): void {
        if (!ok && !this.draft) throw new PageError(`${this.at}: ${message}`)
    }

    /** A text, trimmed; one line unless `lines`. Too long: refused, or cut in a draft. */
    text(value: unknown, max: number, what: string, lines = false): string {
        const value_ = raw(value)
        const out = (lines ? value_.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n') : value_.replace(/\s+/g, ' ')).trim()
        if (out.length <= max) return out
        this.need(false, `${what} is too long: ${max} characters at most.`)
        return out.slice(0, max)
    }

    /** A list, at most `max` long. */
    list(value: unknown, max: number, what: string): any[] {
        if (!Array.isArray(value)) return []
        const items = value.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
        if (items.length <= max) return items
        this.need(false, `${max} ${what} at most.`)
        return items.slice(0, max)
    }
}

// ── Rich text ─────────────────────────────────────────────────────────────

function sameMarks(a: Span, b: Span): boolean {
    return a.bold === b.bold && a.italic === b.italic && a.underline === b.underline && a.strike === b.strike && a.color === b.color && a.link === b.link
}

/** The runs of a line: their known marks only, the empty ones gone, the alike ones merged. A bad link is plain text. */
function cleanSpans(value: unknown): Span[] {
    if (!Array.isArray(value)) return []
    const out: Span[] = []
    for (const item of value.slice(0, MAX_SPANS)) {
        if (!item || typeof item !== 'object') continue
        const text = raw((item as any).text)
        if (!text) continue
        const s = item as any
        const span: Span = compact({
            text,
            bold: s.bold === true ? (true as const) : undefined,
            italic: s.italic === true ? (true as const) : undefined,
            underline: s.underline === true ? (true as const) : undefined,
            strike: s.strike === true ? (true as const) : undefined,
            color: colorOf(s.color),
            link: linkOf(s.link) || undefined,
        })
        const last = out[out.length - 1]
        if (last && sameMarks(last, span)) last.text += span.text
        else out.push(span)
    }
    return trimSpans(out)
}

/** No blank at either end: a line doesn't start with a space nor end with a line break. */
function trimSpans(spans: Span[]): Span[] {
    const out = spans.map((s) => ({ ...s }))
    while (out.length && !(out[0].text = out[0].text.replace(/^\s+/, ''))) out.shift()
    while (out.length && !(out[out.length - 1].text = out[out.length - 1].text.replace(/\s+$/, ''))) out.pop()
    return out
}

function cleanRich(value: unknown): RichText {
    if (!Array.isArray(value)) return []
    const out: RichNode[] = []
    for (const node of value.slice(0, MAX_NODES)) {
        if (node?.type === 'paragraph') out.push({ type: 'paragraph', spans: cleanSpans(node.spans) })
        else if (node?.type === 'list') {
            const items = (Array.isArray(node.items) ? node.items : [])
                .slice(0, MAX_LIST_ITEMS)
                .map(cleanSpans)
                .filter((item: Span[]) => item.length)
            if (items.length) out.push(node.ordered === true ? { type: 'list', ordered: true, items } : { type: 'list', items })
        }
    }
    // An empty line between paragraphs stays; the ones before the first and after the last say nothing.
    const blank = (n: RichNode) => n.type === 'paragraph' && !n.spans.length
    while (out.length && blank(out[0])) out.shift()
    while (out.length && blank(out[out.length - 1])) out.pop()
    return out
}

export function spansLength(spans: Span[]): number {
    return spans.reduce((n, s) => n + s.text.length, 0)
}

function richLength(rich: RichText): number {
    return rich.reduce((n, node) => n + (node.type === 'paragraph' ? spansLength(node.spans) : node.items.reduce((m, item) => m + spansLength(item), 0)), 0)
}

/** The words of a line, without their marks. */
export function spansText(spans: Span[]): string {
    return spans.map((s) => s.text).join('')
}

/** The words of a rich text, without their marks: a link's words stay, its address goes. */
export function richText(rich: RichText): string {
    return rich
        .map((node) => (node.type === 'paragraph' ? spansText(node.spans) : node.items.map(spansText).join(' ')))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function checkSpans(c: Check, value: unknown, max: number, what: string): Span[] {
    const spans = cleanSpans(value)
    c.need(spansText(spans).trim(), `${what} is empty.`)
    c.need(spansLength(spans) <= max, `${what} is too long: ${max} characters at most.`)
    return spans
}

function checkRich(c: Check, value: unknown, what: string, required: boolean): RichText {
    const rich = cleanRich(value)
    if (required) c.need(richText(rich), `${what} is empty.`)
    c.need(richLength(rich) <= MAX_RICH, `${what} is too long: ${MAX_RICH} characters at most.`)
    return rich
}

// ── Pieces ────────────────────────────────────────────────────────────────

/** Corners in whole pixels, 0 to 32. */
function radiusOf(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') return undefined
    const n = Math.round(Number(value))
    return Number.isFinite(n) && n >= 0 && n <= 32 ? n : undefined
}

function cleanStyle(value: unknown): BlockStyle | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
    const s = value as any
    const out: BlockStyle = compact({
        background: colorOf(s.background),
        color: colorOf(s.color),
        padding: oneOf(s.padding, SPACES),
        rounded: s.rounded === true ? true : undefined,
        bleed: s.bleed === true ? true : undefined,
        above: oneOf(s.above, SPACES),
        below: oneOf(s.below, SPACES),
        font: fontIdOf(s.font),
        radius: radiusOf(s.radius),
    })
    return Object.keys(out).length ? out : undefined
}

/**
 * An image. A required one without its address is refused, or kept empty in
 * a draft (a placeholder). An optional one left empty is no image.
 */
function cleanImage(c: Check, value: unknown, what: string, required: boolean): PageImage | undefined {
    const v = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as any
    const given = raw(v.src).trim()
    const src = httpsOf(given)
    if (!src) {
        if (required || given) c.need(false, `${what}: ${IMAGE_RULE}`)
        if (!required) return undefined
    }
    const media = Number(v.media)
    return compact({
        src,
        media: Number.isInteger(media) && media > 0 ? media : undefined,
        alt: c.text(v.alt, 300, `${what}'s description`) || undefined,
    })
}

/** An optional link (an image's, a card's): refused when it is written wrong, dropped in a draft. */
function optionalLink(c: Check, value: unknown, what: string): string | undefined {
    const given = raw(value).trim()
    if (!given) return undefined
    const out = linkOf(given)
    c.need(out, `${what}: ${LINK_RULE}`)
    return out || undefined
}

/** A button inside a block (a hero's): both its words and its link, or nothing. */
function cleanButton(c: Check, value: unknown): PageLink | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
    const v = value as any
    const label = c.text(v.label, 120, "the button's words")
    const given = raw(v.url).trim()
    if (!label && !given) return undefined
    const url = linkOf(given)
    c.need(label, 'the button has no words.')
    c.need(url, `the button's link: ${LINK_RULE}`)
    return { label, url }
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/

/** `2026-11-14`, a day that exists. */
function dateOf(value: unknown): string {
    const out = raw(value).trim()
    const m = out.match(DATE)
    if (!m) return ''
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? out : ''
}

/** `9:00` → `09:00`. */
function timeOf(value: unknown): string {
    const m = raw(value).trim().match(TIME)
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''
}

/** A phone number people can call: digits, spaces, `+ ( ) -`, at least 5 digits. */
function phoneOf(value: string): boolean {
    return /^\+?[\d\s().-]+$/.test(value) && value.replace(/\D/g, '').length >= 5
}

function contactValue(kind: ContactKind, value: string): boolean {
    if (kind === 'phone' || kind === 'whatsapp') return phoneOf(value)
    if (kind === 'email') return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)
    return !!httpsOf(value)
}

const CONTACT_RULE: Record<ContactKind, string> = {
    phone: 'the phone number is not valid.',
    whatsapp: 'the WhatsApp number is not valid.',
    email: 'the email address is not valid.',
    map: "the map's link starts with https://.",
    website: "the site's link starts with https://.",
}

// ── Blocks ────────────────────────────────────────────────────────────────

function cleanBlock(v: any, c: Check): PageBlock {
    const align = oneOf<Align>(v.align, ALIGNS)
    switch (v.type as PageBlock['type']) {
        case 'heading': {
            const level = Number(v.level)
            return compact({
                type: 'heading',
                text: checkSpans(c, v.text, 300, 'the heading'),
                level: level === 1 || level === 2 || level === 3 ? level : undefined,
                align,
                eyebrow: c.text(v.eyebrow, 60, "the heading's eyebrow") || undefined,
                weight: oneOf(v.weight, HEAD_WEIGHTS),
            })
        }
        case 'text':
            return compact({ type: 'text', text: checkRich(c, v.text, 'the text', true), align, size: oneOf(v.size, ['sm', 'md', 'lg'] as const) })
        case 'button': {
            const label = c.text(v.label, 120, "the button's words")
            const url = linkOf(v.url)
            c.need(label, 'the button has no words.')
            c.need(url, `the button's link: ${LINK_RULE}`)
            return compact({
                type: 'button',
                label,
                url,
                align,
                variant: oneOf(v.variant, ['primary', 'outline', 'soft'] as const),
                color: colorOf(v.color),
                full: v.full === true ? (true as const) : undefined,
                icon: pageIconOf(v.icon),
                shape: oneOf(v.shape, ['round', 'cut'] as const),
                size: oneOf(v.size, ['sm'] as const),
            })
        }
        case 'image': {
            const width = Number(v.width)
            return compact({
                type: 'image',
                image: cleanImage(c, v.image, 'the image', true)!,
                caption: c.text(v.caption, 300, 'the caption') || undefined,
                url: optionalLink(c, v.url, "the image's link"),
                width: Number.isFinite(width) && width > 0 ? Math.min(1200, Math.max(24, Math.round(width))) : undefined,
                align,
                ratio: oneOf(v.ratio, RATIOS),
            })
        }
        case 'hero': {
            const overlay = Number(v.overlay)
            return compact({
                type: 'hero',
                image: cleanImage(c, v.image, 'the image', true)!,
                title: c.text(v.title, 160, 'the title') || undefined,
                subtitle: c.text(v.subtitle, 300, 'the subtitle', true) || undefined,
                button: cleanButton(c, v.button),
                height: oneOf(v.height, ['sm', 'md', 'lg'] as const),
                overlay: v.overlay !== undefined && v.overlay !== null && v.overlay !== '' && Number.isFinite(overlay) ? Math.min(90, Math.max(0, Math.round(overlay))) : undefined,
                align,
                position: oneOf(v.position, ['top', 'center', 'bottom'] as const),
            })
        }
        case 'gallery': {
            const images = c.list(v.images, 30, 'images').map((item, i) => {
                const image = cleanImage(c, item, `image ${i + 1}`, true)!
                return compact({ ...image, caption: c.text(item.caption, 300, `image ${i + 1}'s caption`) || undefined })
            })
            c.need(images.length, 'add an image.')
            return compact({ type: 'gallery', images, layout: oneOf(v.layout, ['carousel', 'grid', 'slides'] as const), ratio: oneOf(v.ratio, RATIOS) })
        }
        case 'video': {
            const url = httpsOf(v.url)
            c.need(url, "give the video's address (https://…).")
            const media = Number(v.media)
            return compact({
                type: 'video',
                url,
                media: Number.isInteger(media) && media > 0 ? media : undefined,
                poster: cleanImage(c, v.poster, 'the poster', false),
                caption: c.text(v.caption, 300, 'the caption') || undefined,
            })
        }
        case 'cards': {
            const items = c.list(v.items, 30, 'cards').map((item, i) => {
                const title = c.text(item.title, 160, `card ${i + 1}'s title`)
                c.need(title, `card ${i + 1} has no title.`)
                return compact({
                    image: cleanImage(c, item.image, `card ${i + 1}'s image`, false),
                    title,
                    text: c.text(item.text, 600, `card ${i + 1}'s text`, true) || undefined,
                    url: optionalLink(c, item.url, `card ${i + 1}'s link`),
                })
            })
            c.need(items.length, 'add a card.')
            const columns = Number(v.columns)
            return compact({ type: 'cards', items, columns: columns === 1 || columns === 2 ? columns : undefined })
        }
        case 'media-text':
            return compact({
                type: 'media-text',
                image: cleanImage(c, v.image, 'the image', true)!,
                title: c.text(v.title, 160, 'the title') || undefined,
                text: checkRich(c, v.text, 'the text', false),
                button: cleanButton(c, v.button),
                side: oneOf(v.side, ['start', 'end'] as const),
            })
        case 'faq': {
            const items = c.list(v.items, 50, 'questions').map((item, i) => {
                const question = c.text(item.question, 300, `question ${i + 1}`)
                c.need(question, `question ${i + 1} is empty.`)
                const answer = checkRich(c, item.answer, `the answer to question ${i + 1}`, false)
                c.need(richText(answer), `question ${i + 1} has no answer.`)
                return { question, answer }
            })
            c.need(items.length, 'add a question.')
            return { type: 'faq', items }
        }
        case 'contact': {
            const items = c
                .list(v.items, 10, 'ways to reach you')
                .filter((item) => CONTACT_KINDS.includes(item.kind))
                .map((item, i) => {
                    const kind = item.kind as ContactKind
                    // A number or an address given as a link (tel:…, mailto:…): the number, the address.
                    const given = c.text(item.value, 300, `item ${i + 1}`)
                    const value = kind === 'email' ? given.replace(/^mailto:/i, '') : kind === 'phone' || kind === 'whatsapp' ? given.replace(/^tel:/i, '') : given
                    c.need(contactValue(kind, value), `item ${i + 1}: ${CONTACT_RULE[kind]}`)
                    return compact({ kind, value, label: c.text(item.label, 80, `item ${i + 1}'s words`) || undefined })
                })
            c.need(items.length, 'add a way to reach you.')
            return compact({ type: 'contact', items, layout: oneOf(v.layout, ['buttons', 'list', 'card'] as const) })
        }
        case 'event': {
            const date = dateOf(v.date)
            c.need(date, 'give the date (YYYY-MM-DD).')
            let endDate = dateOf(v.endDate) || undefined
            if (raw(v.endDate).trim()) c.need(endDate, 'the end date is not a date (YYYY-MM-DD).')
            if (endDate && date && endDate < date) {
                c.need(false, 'the end date is before the start date.')
                endDate = undefined
            }
            if (endDate === date) endDate = undefined
            const startTime = timeOf(v.startTime) || undefined
            let endTime = timeOf(v.endTime) || undefined
            if (raw(v.startTime).trim()) c.need(startTime, 'the start time is not a time (HH:MM).')
            if (raw(v.endTime).trim()) c.need(endTime, 'the end time is not a time (HH:MM).')
            if (endTime && !startTime) {
                c.need(false, 'give the start time too.')
                endTime = undefined
            }
            return compact({
                type: 'event',
                title: c.text(v.title, 200, 'the title') || undefined,
                date,
                endDate,
                startTime,
                endTime,
                place: c.text(v.place, 300, 'the place') || undefined,
                mapUrl: optionalLink(c, v.mapUrl, "the map's link"),
                calendar: v.calendar === false ? false : undefined,
            })
        }
        case 'quote': {
            const text = c.text(v.text, 1000, 'the quote', true)
            c.need(text, 'the quote is empty.')
            return compact({ type: 'quote', text, author: c.text(v.author, 120, 'the author') || undefined })
        }
        case 'stats': {
            const items = c.list(v.items, 6, 'figures').map((item, i) => {
                const value = c.text(item.value, 40, `figure ${i + 1}`)
                c.need(value, `figure ${i + 1} has no value.`)
                return { value, label: c.text(item.label, 120, `figure ${i + 1}'s words`) }
            })
            c.need(items.length, 'add a figure.')
            return { type: 'stats', items }
        }
        case 'note':
            return compact({
                type: 'note',
                title: c.text(v.title, 160, 'the title') || undefined,
                text: checkRich(c, v.text, 'the note', true),
                tone: oneOf(v.tone, ['info', 'success', 'warning', 'danger'] as const),
            })
        case 'details': {
            const rows = c.list(v.rows, 30, 'lines').map((row, i) => {
                const label = c.text(row.label, 300, `line ${i + 1}'s label`)
                const value = c.text(row.value, 1000, `line ${i + 1}'s value`, true)
                c.need(label, `line ${i + 1} has no label.`)
                c.need(value, `line ${i + 1} has no value.`)
                return compact({ label, value, icon: pageIconOf(row.icon) })
            })
            c.need(rows.length, 'add a line.')
            return compact({ type: 'details', rows, layout: oneOf(v.layout, ['table', 'card', 'rows'] as const) })
        }
        case 'map': {
            // Draft: a map not placed yet keeps no coordinates; the page refuses it.
            const lat = degrees(v.lat, 90)
            const lng = degrees(v.lng, 180)
            c.need(lat !== undefined && lng !== undefined, 'place the map: paste a Google Maps link, or its latitude and longitude.')
            const zoom = Math.round(Number(v.zoom))
            return compact({
                type: 'map',
                lat: lat as number,
                lng: lng as number,
                zoom: zoom >= 3 && zoom <= 20 && zoom !== 15 ? zoom : undefined,
                address: c.text(v.address, 300, 'the address') || undefined,
                layout: oneOf(v.layout, ['plain'] as const),
            })
        }
        case 'features': {
            const items = c.list(v.items, 24, 'items').map((item, i) => {
                const label = c.text(item.label, 60, `item ${i + 1}`)
                c.need(label, `item ${i + 1} has no words.`)
                return compact({ label, icon: pageIconOf(item.icon) })
            })
            c.need(items.length, 'add an item.')
            return compact({ type: 'features', items, columns: Number(v.columns) === 1 ? (1 as const) : undefined, variant: oneOf(v.variant, ['soft'] as const) })
        }
        case 'divider':
            return { type: 'divider' }
        case 'spacer':
            return compact({ type: 'spacer', size: oneOf(v.size, SPACES) })
    }
}

/**
 * One language's blocks, checked, each with its place in the list it came
 * from: a draft drops what it can't read, and the preview still points at the
 * block the editor has under its eyes. `where` names the language in the
 * messages.
 */
export function normalizeBlockList(input: unknown, where: string, mode: Mode = 'strict'): { index: number; block: PageBlock }[] {
    const draft = mode === 'draft'
    if (input === undefined || input === null) return []
    if (!Array.isArray(input)) {
        if (draft) return []
        throw new PageError(`${where}: the blocks must be a list.`)
    }
    if (input.length > MAX_BLOCKS && !draft) throw new PageError(`${where}: ${MAX_BLOCKS} blocks at most.`)
    const out: { index: number; block: PageBlock }[] = []
    input.slice(0, MAX_BLOCKS).forEach((value: any, index) => {
        const c = new Check(`${where}, block ${index + 1}`, draft)
        if (!value || typeof value !== 'object' || !BLOCK_TYPES.includes(value.type)) {
            if (draft) return
            throw new PageError(`${c.at}: unknown type.`)
        }
        const block = cleanBlock(value, c)
        const style = cleanStyle(value.style)
        out.push({ index, block: style ? { ...block, style } : block })
    })
    return out
}

/** One language's blocks, checked. */
export function normalizeBlocks(input: unknown, where: string, mode: Mode = 'strict'): PageBlock[] {
    return normalizeBlockList(input, where, mode).map((b) => b.block)
}

/** JSON columns can come back as text from some drivers, and the back-office may send either. */
function parsed(value: unknown): unknown {
    if (typeof value !== 'string') return value
    try {
        return JSON.parse(value)
    } catch {
        return value
    }
}

/** Every language's blocks; a language the project dropped is dropped with it. */
export function normalizePageBlocks(input: unknown, locales: string[], mode: Mode = 'strict'): PageBlocks {
    const value = parsed(input)
    if (value === undefined || value === null || value === '') return {}
    // One list for all: the default language's.
    if (Array.isArray(value)) {
        const list = normalizeBlocks(value, languageName(locales[0]), mode)
        return list.length ? { [locales[0]]: list } : {}
    }
    if (typeof value !== 'object') {
        if (mode === 'draft') return {}
        throw new PageError('The blocks must be a list per language.')
    }
    const out: PageBlocks = {}
    for (const locale of locales) {
        const list = normalizeBlocks((value as any)[locale], languageName(locale), mode)
        if (list.length) out[locale] = list
    }
    return out
}

/** How a page opens, as the back-office sends it: a choice it doesn't have is left out. Null when none is made. */
export function normalizeHead(input: unknown): PageHead | null {
    const value = parsed(input)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const h = value as any
    const out: PageHead = compact({
        cover: oneOf(h.cover, HEAD_COVERS),
        align: oneOf(h.align, ALIGNS),
        size: oneOf(h.size, HEAD_SIZES),
        weight: oneOf(h.weight, HEAD_WEIGHTS),
        upper: typeof h.upper === 'boolean' ? h.upper : undefined,
        sheet: typeof h.sheet === 'boolean' ? h.sheet : undefined,
        logo: typeof h.logo === 'boolean' ? h.logo : undefined,
        color: colorOf(h.color),
        font: fontIdOf(h.font),
        fontRtl: fontIdOf(h.fontRtl),
        photo: coverOf(h.photo) ?? undefined,
    })
    return Object.keys(out).length ? out : null
}

/** The photo across the top of a page: its own, else its record's. */
export function photoOf(page: { head?: unknown; cover?: PageImage | null }): PageImage | null {
    return normalizeHead(page.head)?.photo ?? page.cover ?? null
}

/** A cover photo: an https address, with the upload it is when there is one. Null otherwise. */
export function coverOf(input: unknown): PageImage | null {
    const value = parsed(input)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const src = httpsOf((value as any).src)
    if (!src) return null
    const media = Number((value as any).media)
    return compact({ src, media: Number.isInteger(media) && media > 0 ? media : undefined })
}

/** Every uploaded file named in blocks, however deep: any `{ src, media }` in the JSON, and a video's `{ url, media }`. */
export function mediaIdsOf(value: unknown, out: number[] = []): number[] {
    const v = parsed(value)
    if (Array.isArray(v)) {
        for (const item of v) mediaIdsOf(item, out)
    } else if (v && typeof v === 'object') {
        const media = (v as any).media
        if (typeof ((v as any).src ?? (v as any).url) === 'string' && Number.isInteger(media) && media > 0) out.push(media)
        for (const child of Object.values(v)) if (child && typeof child === 'object') mediaIdsOf(child, out)
    }
    return out
}

/** A title, or a summary, in each language: trimmed, single line. */
export function normalizeLocalized(input: unknown, field: string, locales: string[], max: number): Record<string, string> {
    const value = parsed(input)
    if (value === undefined || value === null || value === '') return {}
    const source: Record<string, unknown> = typeof value === 'string' ? { [locales[0]]: value } : (value as any)
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new PageError(`The ${field} must be a text per language.`)
    const out: Record<string, string> = {}
    for (const locale of locales) {
        const value_ = source[locale]
        if (value_ === undefined || value_ === null) continue
        if (typeof value_ !== 'string') throw new PageError(`The ${field} in ${languageName(locale)} must be a text.`)
        const line = value_.replace(/\s+/g, ' ').trim()
        if (line.length > max) throw new PageError(`The ${field} in ${languageName(locale)} is too long: ${max} characters at most.`)
        if (line) out[locale] = line
    }
    return out
}

/** "Opening hours & map" → `opening-hours-map`. Empty when nothing in it is Latin (an Arabic title). */
export function slugify(title: string): string {
    return title
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, MAX_SLUG)
        .replace(/-+$/, '')
}

export function checkSlug(slug: unknown): string {
    const out = typeof slug === 'string' ? slug.trim().toLowerCase() : ''
    if (!out) throw new PageError('Give the page an address.')
    if (out.length > MAX_SLUG) throw new PageError(`The address is ${MAX_SLUG} characters at most.`)
    if (!SLUG.test(out)) throw new PageError('The address takes lowercase letters, digits and dashes: opening-hours.')
    return out
}

/** The first text a localized value has, for messages and fallbacks. */
export function firstOf(value: Localized | undefined | null, locales: string[]): string {
    if (!value) return ''
    if (typeof value === 'string') return value
    return locales.map((l) => value[l]).find((t) => typeof t === 'string' && t.trim()) ?? ''
}
