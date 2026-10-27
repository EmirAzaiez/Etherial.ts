import { Align, BlockOf, BlockStyle, PageBlock, PageColor, PageImage, PageTheme, Ratio, ResolvedBlock, RichText, Space, Span } from './options.js'
import { PAGE_LINK, colorOf, richText, spansText } from './blocks.js'
import { resolveBlocks } from './resolve.js'
import { PageFonts, fontOf, fontStack, fontsIn, googleFontsHref } from './fonts.js'

// ──────────────────────────────────────────────────────────────────────────
// Blocks → a page any phone or browser shows well: one HTML file, its styles
// and icons inside, no script, right to left for Arabic. It is what a shared
// link opens, what the app shows in a web view when it can't draw the blocks
// itself, and the back-office's phone preview.
// ──────────────────────────────────────────────────────────────────────────

export interface RenderInput {
    title: string
    summary: string
    blocks: PageBlock[]
    locale: string
    rtl: boolean
    theme: PageTheme
    brand: string
    /** Where a `page:<slug>` link goes. */
    pageHref: (slug: string) => string
    /** The page in each language, this one included: the switch at the top. */
    languages: { locale: string; href: string }[]
    /** The address it is served at, for the previews of a shared link. */
    canonical?: string
    /** The project's: an event's "Add to calendar" link says its times are in it. */
    timezone?: string
    /** The brand above and below, the language switch. Default true; off for a page shown inside something else. */
    chrome?: boolean
    /** A block being written: an image not uploaded yet is a grey box, a button without its link is drawn anyway. */
    draft?: boolean
    /** Each block's outermost element says which one it is (`data-block`), for the back-office to point at. */
    marks?: boolean
    /** With `marks`: each block's place in the list the back-office sent, when some were left out. */
    indexes?: number[]
    /** The fonts of the titles and of the text, those the back-office set. Default the theme's `font`. */
    fonts?: PageFonts
    /** A line above everything: a preview link says the page is not on the web. */
    notice?: string
    /** Kept out of search engines, its address out of the Referer of its links: a preview link. */
    unlisted?: boolean
}

export const COLORS = {
    primary: '#111827',
    onPrimary: '#FFFFFF',
    text: '#111827',
    muted: '#6B7280',
    background: '#FFFFFF',
    border: '#E5E7EB',
    subtle: '#F3F4F6',
}
export const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
export const FONT_RTL = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, Arial, sans-serif"
export const RADIUS = 12

const SPACE: Record<Space, number> = { none: 0, sm: 8, md: 20, lg: 36, xl: 56 }
const PADDING: Record<Space, number> = { none: 0, sm: 12, md: 20, lg: 32, xl: 48 }
const RATIO: Record<Exclude<Ratio, 'auto'>, string> = { '16:9': '16/9', '4:3': '4/3', '1:1': '1/1', '3:4': '3/4' }

/** Each language named in itself, for the switch. */
const NATIVE: Record<string, string> = { en: 'English', ar: 'العربية', fr: 'Français', es: 'Español', de: 'Deutsch', it: 'Italiano', ru: 'Русский', zh: '中文' }
const ADD_TO_CALENDAR: Record<string, string> = { en: 'Add to calendar', ar: 'أضف إلى التقويم', fr: 'Ajouter au calendrier' }
/** What an empty list block says in the preview: the back-office is in English. */
const EMPTY: Partial<Record<PageBlock['type'], string>> = {
    gallery: 'Add images',
    cards: 'Add cards',
    faq: 'Add questions',
    contact: 'Add ways to reach you',
    stats: 'Add figures',
    details: 'Add lines',
}

// Lucide's shapes (ISC), drawn in the text's color.
const ICONS: Record<string, string> = {
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
    play: '<path d="M7 4.5v15a1 1 0 0 0 1.52.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z" fill="currentColor" stroke="none"/>',
    quote: '<path d="M10 7.5C6.96 7.5 4.5 9.96 4.5 13v4.5h5.5V12H7.2A2.8 2.8 0 0 1 10 9.5zM19.5 7.5c-3.04 0-5.5 2.46-5.5 5.5v4.5h5.5V12h-2.8a2.8 2.8 0 0 1 2.8-2.5z" fill="currentColor" stroke="none"/>',
    // WhatsApp's own mark (Simple Icons, CC0).
    whatsapp:
        '<path fill="currentColor" stroke="none" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.27-.2-.57-.35m-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89a11.82 11.82 0 0 0-3.48-8.41z"/>',
}

const CONTACT_ICON = { phone: 'phone', whatsapp: 'whatsapp', email: 'mail', map: 'pin', website: 'globe' } as const

function icon(name: string, cls = ''): string {
    return `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`
}

function esc(value: string): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

/** A text written on several lines keeps them. */
function lines(value: string | undefined): string {
    return esc(value ?? '').replace(/\n/g, '<br>')
}

/** Only colors and fonts reach the styles: a theme can't open a rule. */
function cssValue(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() && !/[;"<>{}]/.test(value) ? value.trim() : fallback
}

// ── Colors ────────────────────────────────────────────────────────────────

type Palette = typeof COLORS

/** The theme's colors over the defaults: what the page is drawn with, and what the editor shows. */
export function paletteOf(theme: PageTheme | undefined): Palette {
    return Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, cssValue((theme?.colors as any)?.[k], v)])) as Palette
}

/** The theme's corner radius, in pixels. */
export function radiusOf(theme: PageTheme | undefined): number {
    return Math.max(0, Math.min(32, Number(theme?.radius ?? RADIUS) || 0))
}

function rgbOf(value: string | undefined): [number, number, number] | null {
    const hex = (value ?? '').trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1]
    if (!hex) return null
    const six = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
    return [0, 2, 4].map((i) => parseInt(six.slice(i, i + 2), 16)) as [number, number, number]
}

/** WCAG's relative luminance; a color it can't read counts as light. */
function luminance(value: string | undefined): number {
    const rgb = rgbOf(value)
    if (!rgb) return 1
    const [r, g, b] = rgb.map((v) => {
        const c = v / 255
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Dark enough for white text on it. */
function isDark(value: string | undefined): boolean {
    return luminance(value) < 0.45
}

/** A page color as CSS: the theme's through its variable, so a box follows the page. */
function colorCss(color: PageColor): string {
    switch (color) {
        case 'primary':
            return 'var(--primary)'
        case 'text':
            return 'var(--text)'
        case 'muted':
            return 'var(--muted)'
        case 'subtle':
            return 'var(--subtle)'
        case 'white':
            return '#FFFFFF'
        case 'black':
            return '#000000'
        default:
            return color
    }
}

/** A page color's value, to weigh how dark it is. */
function colorValue(color: PageColor, c: Palette): string {
    const tokens: Record<string, string> = { primary: c.primary, text: c.text, muted: c.muted, subtle: c.subtle, white: '#FFFFFF', black: '#000000' }
    return tokens[color] ?? color
}

/** The color, faint. */
function soft(css: string, value: string, alpha: number): string {
    const rgb = rgbOf(value)
    return rgb ? `rgba(${rgb.join(',')},${alpha})` : `color-mix(in srgb,${css} ${Math.round(alpha * 100)}%,transparent)`
}

// ── Text ──────────────────────────────────────────────────────────────────

interface Ctx {
    input: RenderInput
    c: Palette
    draft: boolean
    lang: string
    /** What the words fall back on: the theme's font, else the system's. */
    system: string
    /** The cover the page opens on: its title is the page's (an h1), not drawn again above it. */
    opener?: ResolvedBlock
}

/** Links that open something; anything else (`javascript:`) is dropped. */
function hrefOf(url: string | undefined, ctx: Ctx): string {
    const value = (url ?? '').trim()
    const page = value.match(PAGE_LINK)
    if (page) return ctx.input.pageHref(page[1])
    return /^(https:\/\/|mailto:|tel:)/i.test(value) ? value : ''
}

/**
 * With `marks`: words the back-office may write right on the page, where they
 * go in the block and what they may hold (`spans`: one line with marks, `rich`:
 * paragraphs and lists, `line`: plain words, `lines`: plain words on lines).
 */
function editable(ctx: Ctx, path: string, kind: 'spans' | 'rich' | 'line' | 'lines'): string {
    return ctx.input.marks ? ` data-edit="${path}" data-kind="${kind}"` : ''
}

function spansHtml(spans: Span[], ctx: Ctx): string {
    return (spans ?? [])
        .map((span) => {
            let out = lines(span.text)
            if (span.strike) out = `<s>${out}</s>`
            if (span.underline) out = `<u>${out}</u>`
            if (span.italic) out = `<em>${out}</em>`
            if (span.bold) out = `<strong>${out}</strong>`
            const color = colorOf(span.color)
            if (color) out = `<span style="color:${colorCss(color)}">${out}</span>`
            const href = span.link ? hrefOf(span.link, ctx) : ''
            // The link as written (`page:<slug>`), for the back-office to read back.
            const written = ctx.input.marks ? ` data-link="${esc(span.link!)}"` : ''
            return href ? `<a href="${esc(href)}"${written}>${out}</a>` : out
        })
        .join('')
}

function richHtml(rich: RichText, ctx: Ctx): string {
    return (rich ?? [])
        .map((node) => {
            if (node.type === 'paragraph') return `<p>${spansHtml(node.spans, ctx) || '<br>'}</p>`
            const tag = node.ordered ? 'ol' : 'ul'
            return `<${tag}>${node.items.map((item) => `<li>${spansHtml(item, ctx)}</li>`).join('')}</${tag}>`
        })
        .join('')
}

// ── Pieces ────────────────────────────────────────────────────────────────

function ratioStyle(ratio: Ratio | undefined, fallback: Ratio | null): string {
    const r = ratio ?? fallback
    return r && r !== 'auto' ? `aspect-ratio:${RATIO[r]}` : ''
}

/** An image, or in a draft the grey box it will fill. Nothing when there is neither. */
function imageHtml(image: PageImage | undefined, ctx: Ctx, cls: string, style = ''): string {
    if (image?.src && /^https:\/\//i.test(image.src)) {
        return `<img class="${cls}" src="${esc(image.src)}" alt="${esc(image.alt ?? '')}" loading="lazy" decoding="async"${style ? ` style="${style}"` : ''}>`
    }
    if (!ctx.draft) return ''
    return `<div class="${cls} ph" style="${style || 'aspect-ratio:16/9'}">${icon('image')}</div>`
}

/** A button. `onDark`: in a dark box, the default one is white with the box's color for its words. */
function buttonHtml(label: string, url: string, ctx: Ctx, cls: string, style = '', attrs = ''): string {
    const href = hrefOf(url, ctx) || (ctx.draft ? '#' : '')
    if (!href) return ''
    return `<a class="${cls}" href="${esc(href)}"${style ? ` style="${style}"` : ''}${attrs}>${esc(label)}</a>`
}

function alignOf(align: Align | undefined, fallback: Align): string {
    return `al-${align ?? fallback}`
}

// ── Blocks ────────────────────────────────────────────────────────────────

function headingHtml(block: BlockOf<'heading'>, ctx: Ctx): string {
    const level = block.level ?? 2
    const tag = `h${level + 1}`
    const text = spansHtml(block.text, ctx)
    return `<${tag} class="h h${level} ${alignOf(block.align, 'start')}${text ? '' : ' empty'}"${editable(ctx, 'text', 'spans')}>${text}</${tag}>`
}

function eventHtml(block: ResolvedBlock & BlockOf<'event'>, ctx: Ctx): string {
    const ev = block.resolved?.event
    const info: string[] = []
    if (block.title) info.push(`<h3 class="ev-title"${editable(ctx, 'title', 'line')}>${esc(block.title)}</h3>`)
    if (ev?.date) info.push(`<p class="${block.title ? 'ev-date' : 'ev-title'}"><time datetime="${esc(block.date)}">${esc(ev.date)}</time></p>`)
    if (ev?.time) info.push(`<p class="ev-line">${icon('clock')}<span dir="ltr">${esc(ev.time)}</span></p>`)
    if (block.place) {
        const map = hrefOf(block.mapUrl, ctx)
        const place = `${icon('pin')}<span${editable(ctx, 'place', 'line')}>${esc(block.place)}</span>`
        info.push(map ? `<a class="ev-line ev-map" href="${esc(map)}">${place}</a>` : `<p class="ev-line">${place}</p>`)
    }
    const calendar = ev?.calendarUrl
        ? `<a class="btn outline ev-cal" href="${esc(ev.calendarUrl)}">${icon('calendar')}<span>${esc(ADD_TO_CALENDAR[ctx.lang] ?? ADD_TO_CALENDAR.en)}</span></a>`
        : ''
    return `<div class="card ev"><div class="ev-top"><div class="ev-badge" aria-hidden="true"><span class="ev-mon">${esc(ev?.month ?? '')}</span><span class="ev-day">${esc(ev?.day ?? '–')}</span></div><div class="ev-info">${info.join('')}</div></div>${calendar}</div>`
}

function videoHtml(block: ResolvedBlock & BlockOf<'video'>, ctx: Ctx): string {
    const video = block.resolved?.video
    const caption = block.caption ? `<figcaption class="cap"${editable(ctx, 'caption', 'line')}>${esc(block.caption)}</figcaption>` : ''
    const poster = video?.poster && /^https:\/\//i.test(video.poster) ? video.poster : ''
    const play = `<span class="play">${icon('play')}</span>`
    let player: string
    // The preview shows the poster: a player inside the editor would reload at every key.
    if (video?.embedUrl && !ctx.draft) {
        player = `<div class="vid media"><iframe src="${esc(video.embedUrl)}" title="${esc(block.caption ?? 'Video')}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
    } else if (video?.provider === 'file' && /^https:\/\//i.test(block.url)) {
        player = `<div class="vid media"><video src="${esc(block.url)}" controls playsinline preload="metadata"${poster ? ` poster="${esc(poster)}"` : ''}></video></div>`
    } else {
        // Another site: its picture, and a tap opens it there.
        const inner = `${poster ? `<img src="${esc(poster)}" alt="" loading="lazy">` : ''}${play}`
        const href = /^https:\/\//i.test(block.url ?? '') ? block.url : ctx.draft ? '#' : ''
        player = href ? `<a class="vid media" href="${esc(href)}">${inner}</a>` : `<div class="vid media">${inner}</div>`
    }
    return `<figure class="fig">${player}${caption}</figure>`
}

function galleryHtml(block: BlockOf<'gallery'>, ctx: Ctx): string {
    const ratio = ratioStyle(block.ratio, '4:3')
    const figures = block.images
        .map((image, i, all) => {
            const img = imageHtml(image, ctx, 'media', ratio)
            if (!img) return ''
            const caption = image.caption ? `<figcaption class="cap"${editable(ctx, `images.${i}.caption`, 'line')}>${esc(image.caption)}</figcaption>` : ''
            // An odd count in a grid: the first one across both columns.
            const wide = all.length % 2 === 1 && i === 0 ? ' wide' : ''
            return `<figure class="slide${wide}">${img}${caption}</figure>`
        })
        .filter(Boolean)
    if (!figures.length) return ''
    if (block.layout === 'grid' || figures.length === 1) return `<div class="gal grid${figures.length === 1 ? ' one' : ''}">${figures.join('')}</div>`
    return `<div class="gal track">${figures.join('').replace(/ wide/g, '')}</div>`
}

function cardsHtml(block: BlockOf<'cards'>, ctx: Ctx): string {
    const two = block.columns === 2
    const items = block.items.map((item, i) => {
        const img = imageHtml(item.image, ctx, 'card-img')
        const href = hrefOf(item.url, ctx)
        const text = item.text ? `<p class="card-text"${editable(ctx, `items.${i}.text`, 'lines')}>${lines(item.text)}</p>` : ''
        const body = `<div class="card-body"><h3 class="card-title"${editable(ctx, `items.${i}.title`, 'line')}>${esc(item.title)}</h3>${text}</div>`
        const chevron = href && !two ? icon('chevron', 'chev') : ''
        const inner = `${img}${body}${chevron}`
        return href ? `<a class="card" href="${esc(href)}">${inner}</a>` : `<div class="card">${inner}</div>`
    })
    return `<div class="cards ${two ? 'c2' : 'c1'}">${items.join('')}</div>`
}

function mediaTextHtml(block: BlockOf<'media-text'>, ctx: Ctx): string {
    const img = imageHtml(block.image, ctx, 'media', 'aspect-ratio:4/3')
    const button = block.button ? buttonHtml(block.button.label, block.button.url, ctx, 'btn primary', '', editable(ctx, 'button.label', 'line')) : ''
    const text = block.text?.length ? `<div class="rt"${editable(ctx, 'text', 'rich')}>${richHtml(block.text, ctx)}</div>` : ''
    const body = `${block.title ? `<h4 class="h h3"${editable(ctx, 'title', 'line')}>${esc(block.title)}</h4>` : ''}${text}${button}`
    return `<div class="mx${block.side === 'end' ? ' side-end' : ''}">${img ? `<div class="mx-media">${img}</div>` : ''}<div class="mx-body">${body}</div></div>`
}

function contactHtml(block: ResolvedBlock & BlockOf<'contact'>, ctx: Ctx): string {
    const resolved = block.resolved?.contact ?? []
    const items = block.items.map((item, i) => {
        const raw = resolved[i]?.href ?? ''
        const href = /^(https:\/\/|mailto:|tel:)/i.test(raw) ? raw : ctx.draft ? '#' : ''
        const label = resolved[i]?.label || item.label || ''
        return { item, href, label, glyph: icon(CONTACT_ICON[item.kind] ?? 'globe') }
    })
    if (block.layout === 'list') {
        return `<div class="clist">${items
            .map(({ item, href, label, glyph }) => {
                const inner = `<span class="cicon">${glyph}</span><span class="ctext"><span class="clabel">${esc(label)}</span><span class="cvalue"><bdi dir="ltr">${esc(item.value)}</bdi></span></span>${href ? icon('chevron', 'chev') : ''}`
                return href ? `<a class="crow" href="${esc(href)}">${inner}</a>` : `<div class="crow">${inner}</div>`
            })
            .join('')}</div>`
    }
    return `<div class="pills">${items
        .filter(({ href }) => href)
        .map(({ href, label, glyph }) => `<a class="pill" href="${esc(href)}">${glyph}<span>${esc(label)}</span></a>`)
        .join('')}</div>`
}

const NOTE_TONES = ['info', 'success', 'warning', 'danger']

function blockHtml(block: ResolvedBlock, ctx: Ctx): string {
    switch (block.type) {
        case 'heading':
            return headingHtml(block, ctx)
        case 'text': {
            const text = richHtml(block.text, ctx)
            return `<div class="rt sz-${block.size ?? 'md'} ${alignOf(block.align, 'start')}${richText(block.text) ? '' : ' empty'}"${editable(ctx, 'text', 'rich')}>${text}</div>`
        }
        case 'button': {
            const color = colorOf(block.color)
            let style = ''
            if (color) {
                const css = colorCss(color)
                const value = colorValue(color, ctx.c)
                style = `--c:${css};--on:${isDark(value) ? '#FFFFFF' : 'var(--text)'}`
            }
            const variant = block.variant ?? 'primary'
            const button = buttonHtml(block.label, block.url, ctx, `btn ${variant}${block.full ? ' full' : ''}`, style, editable(ctx, 'label', 'line'))
            return button ? `<div class="bw ${alignOf(block.align, 'start')}">${button}</div>` : ''
        }
        case 'image': {
            const img = imageHtml(block.image, ctx, 'media', ratioStyle(block.ratio, null))
            if (!img) return ''
            const href = hrefOf(block.url, ctx)
            const width = block.width ? ` style="max-width:${Math.round(block.width)}px"` : ''
            const caption = block.caption ? `<figcaption class="cap"${editable(ctx, 'caption', 'line')}>${esc(block.caption)}</figcaption>` : ''
            return `<figure class="fig ${alignOf(block.align, 'center')}"${width}>${href ? `<a href="${esc(href)}">${img}</a>` : img}${caption}</figure>`
        }
        case 'hero': {
            const img = imageHtml(block.image, ctx, 'hero-img')
            if (!img) return ''
            const overlay = Math.min(90, Math.max(0, block.overlay ?? 35)) / 100
            const position = block.position ?? 'bottom'
            const shade = (a: number) => `rgba(0,0,0,${Math.round(a * 1000) / 1000})`
            // Darkest where the words are, so the picture stays bright elsewhere.
            const gradient =
                position === 'center'
                    ? shade(overlay)
                    : `linear-gradient(${position === 'top' ? 'to bottom' : 'to top'},${shade(overlay)} 0%,${shade(overlay * 0.6)} 45%,${shade(overlay * 0.12)} 100%)`
            const tag = ctx.opener === block ? 'h1' : 'h2'
            const button = block.button ? buttonHtml(block.button.label, block.button.url, ctx, 'btn hero-btn', '', editable(ctx, 'button.label', 'line')) : ''
            const body = [
                block.title ? `<${tag} class="hero-title"${editable(ctx, 'title', 'line')}>${esc(block.title)}</${tag}>` : '',
                block.subtitle ? `<p class="hero-sub"${editable(ctx, 'subtitle', 'lines')}>${lines(block.subtitle)}</p>` : '',
                button,
            ].join('')
            // On a phone its picture sets its height, up to the size asked: a wide
            // banner isn't blown up to fill a box taller than the screen is wide.
            // From 640px the size is its height, the picture covers it.
            return `<section class="hero h-${block.height ?? 'md'} p-${position} ${alignOf(block.align, 'start')}">${img}${overlay ? `<div class="shade" style="background:${gradient}"></div>` : ''}${body ? `<div class="hero-body">${body}</div>` : ''}</section>`
        }
        case 'gallery':
            return galleryHtml(block, ctx)
        case 'video':
            return videoHtml(block, ctx)
        case 'cards':
            return block.items.length ? cardsHtml(block, ctx) : ''
        case 'media-text':
            return mediaTextHtml(block, ctx)
        case 'faq':
            return block.items.length
                ? `<div class="faq">${block.items
                      .map(
                          (item, i) =>
                              `<details><summary><span${editable(ctx, `items.${i}.question`, 'line')}>${esc(item.question)}</span>${icon('down')}</summary><div class="rt ans"${editable(ctx, `items.${i}.answer`, 'rich')}>${richHtml(item.answer, ctx)}</div></details>`
                      )
                      .join('')}</div>`
                : ''
        case 'contact':
            return block.items.length ? contactHtml(block, ctx) : ''
        case 'event':
            return eventHtml(block, ctx)
        case 'quote':
            return `<figure class="quote">${icon('quote')}<blockquote><p${block.text ? '' : ' class="empty"'}${editable(ctx, 'text', 'lines')}>${lines(block.text)}</p></blockquote>${
                block.author ? `<figcaption>— <span${editable(ctx, 'author', 'line')}>${esc(block.author)}</span></figcaption>` : ''
            }</figure>`
        case 'stats': {
            const n = block.items.length
            if (!n) return ''
            const columns = n <= 3 ? n : n === 4 ? 2 : 3
            return `<div class="stats${n === 4 ? ' n4' : ''}" style="--n:${columns}">${block.items
                .map(
                    (item, i) =>
                        `<div class="stat"><span class="stat-v" dir="auto"${editable(ctx, `items.${i}.value`, 'line')}>${esc(item.value)}</span>${
                            item.label ? `<span class="stat-l"${editable(ctx, `items.${i}.label`, 'line')}>${esc(item.label)}</span>` : ''
                        }</div>`
                )
                .join('')}</div>`
        }
        case 'note': {
            const tone = NOTE_TONES.includes(block.tone ?? '') ? block.tone : 'info'
            return `<aside class="note ${tone}">${block.title ? `<p class="note-title"${editable(ctx, 'title', 'line')}>${esc(block.title)}</p>` : ''}<div class="rt${richText(block.text) ? '' : ' empty'}"${editable(ctx, 'text', 'rich')}>${richHtml(block.text, ctx)}</div></aside>`
        }
        case 'details':
            return block.rows.length
                ? `<table class="details"><tbody>${block.rows
                      .map(
                          (row, i) =>
                              `<tr><th scope="row"${editable(ctx, `rows.${i}.label`, 'line')}>${esc(row.label)}</th><td><bdi dir="auto"${editable(ctx, `rows.${i}.value`, 'lines')}>${lines(row.value)}</bdi></td></tr>`
                      )
                      .join('')}</tbody></table>`
                : ''
        case 'divider':
            return '<hr class="hr">'
        case 'spacer':
            return `<div class="sp" style="height:${SPACE[block.size ?? 'md'] ?? 20}px" aria-hidden="true"></div>`
    }
    return ''
}

/**
 * The block in its box: the space around it, its background and text color
 * (white on a dark background unless it says otherwise), its padding, its
 * corners, edge to edge or not.
 */
function boxed(block: ResolvedBlock, inner: string, ctx: Ctx, first: boolean, index: number): string {
    const style: BlockStyle = block.style ?? {}
    const classes = ['blk', `t-${block.type}`]
    const css: string[] = []

    const above = style.above ?? (block.type === 'heading' && !first ? 'md' : 'none')
    const below = style.below ?? (block.type === 'spacer' ? 'none' : 'md')
    if (SPACE[above]) classes.push(`sa-${above}`)
    if (SPACE[below]) classes.push(`sb-${below}`)

    const background = colorOf(style.background)
    const dark = background ? isDark(colorValue(background, ctx.c)) : false
    const ownColor = colorOf(style.color)
    const text = ownColor ? colorCss(ownColor) : dark ? '#FFFFFF' : ''
    const textValue = ownColor ? colorValue(ownColor, ctx.c) : '#FFFFFF'
    // A hero is the picture across the page unless it is asked to sit in a rounded box.
    const bleed = !!style.bleed || (block.type === 'hero' && !style.rounded)
    const padding = PADDING[style.padding ?? (background ? 'md' : 'none')] ?? 0

    if (background) {
        classes.push('filled')
        // The pills and round icons inside: a shade of the box's own accent, not the page's subtle color.
        css.push(`background:${colorCss(background)}`, '--soft:color-mix(in srgb,var(--acc) 12%,transparent)')
    }
    if (text) {
        // Links and secondary text follow the box's own color.
        css.push(`--fg:${text}`, `--mut:${soft(text, textValue, 0.75)}`, `--lnk:${text}`, `--line:${soft(text, textValue, 0.22)}`)
    }
    if (dark) css.push(`--acc:var(--fg)`, `--on-acc:${colorCss(background!)}`)
    if (padding || (bleed && background)) {
        classes.push('pad')
        // Edge to edge with a background: the content stays in the page's column.
        const x = bleed && background ? 'var(--gut)' : `${padding}px`
        css.push(`--py:${padding}px`, `--px:${x}`)
    }
    if (style.rounded) classes.push('rounded')
    if (bleed) classes.push('bleed')
    const font = fontOf(style.font)
    if (font) {
        const stack = fontStack(font, ctx.system)
        css.push(`--font-text:${stack}`, `--font-title:${stack}`)
    }
    if (bleed && !background && !style.rounded) classes.push('flush')

    const mark = ctx.input.marks ? ` data-block="${ctx.input.indexes?.[index] ?? index}"` : ''
    return `<div class="${classes.join(' ')}"${mark}${css.length ? ` style="${css.join(';')}"` : ''}>${inner}</div>`
}

function firstImage(blocks: PageBlock[]): string {
    for (const block of blocks) {
        const src = block.type === 'image' || block.type === 'hero' || block.type === 'media-text' ? block.image?.src : block.type === 'gallery' ? block.images?.[0]?.src : ''
        if (src && /^https:\/\//i.test(src)) return src
    }
    return ''
}

function description(input: RenderInput): string {
    if (input.summary) return input.summary
    for (const block of input.blocks) {
        if (block.type === 'text' || block.type === 'note') {
            const words = richText(block.text)
            if (words) return words
        }
    }
    const heading = input.blocks.find((b): b is BlockOf<'heading'> => b.type === 'heading')
    return heading ? spansText(heading.text).trim() : ''
}

export function render(input: RenderInput): string {
    const theme = input.theme ?? {}
    const c = paletteOf(theme)
    const system = input.rtl ? cssValue(theme.fontRtl, FONT_RTL) : cssValue(theme.font, FONT)
    const fonts = input.fonts ?? {}
    // Titles without a font of their own are in the text's.
    const textFont = fontStack(fontOf(fonts.text), system)
    const titleFont = fonts.title ? fontStack(fontOf(fonts.title), system) : textFont
    const radius = radiusOf(theme)
    const dir = input.rtl ? 'rtl' : 'ltr'
    const chrome = input.chrome !== false
    const ctx: Ctx = { input, c, draft: !!input.draft, lang: input.locale.split('-')[0], system }

    const blocks = resolveBlocks(input.blocks ?? [], { locale: input.locale, title: input.title, timezone: input.timezone })
    const lead = blocks[0]
    if (lead?.type === 'hero' && lead.title && blockHtml(lead, ctx)) ctx.opener = lead
    // Across the page, the cover starts at the very top.
    const flushTop = chrome || (!!ctx.opener && !ctx.opener.style?.rounded)
    let drawn = 0
    const body = blocks
        .map((block, i) => {
            let inner = blockHtml(block, ctx)
            if (!inner && ctx.draft && EMPTY[block.type]) inner = `<div class="ph-list">${esc(EMPTY[block.type]!)}</div>`
            if (!inner) return ''
            return boxed(block, inner, ctx, drawn++ === 0, i)
        })
        .filter(Boolean)
        .join('\n')

    const used = fontsIn(fonts, input.blocks ?? [])
    const fontLinks = used.length
        ? `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="${esc(googleFontsHref(used))}">\n`
        : ''

    const image = firstImage(input.blocks ?? [])
    const about = description(input).slice(0, 200)
    const tabTitle = input.title ? (input.brand && input.brand !== input.title ? `${input.title} · ${input.brand}` : input.title) : input.brand

    const logoHeight = Math.max(16, Math.min(80, Number(theme.logoHeight ?? 28) || 28))
    const logoSrc = theme.logoUrl && /^https?:\/\//i.test(theme.logoUrl) ? theme.logoUrl : ''
    const brand = logoSrc
        ? `<img src="${esc(logoSrc)}" alt="${esc(input.brand)}" style="height:${logoHeight}px">`
        : input.brand
          ? `<span>${esc(input.brand)}</span>`
          : ''
    const others = (input.languages ?? []).filter((l) => l.locale !== input.locale)
    const switcher = others.length
        ? `<nav class="langs">${others.map((l) => `<a href="${esc(l.href)}" hreflang="${esc(l.locale)}" lang="${esc(l.locale)}">${esc(NATIVE[l.locale] ?? l.locale.toUpperCase())}</a>`).join('')}</nav>`
        : ''
    const top = chrome && (brand || switcher) ? `<header class="top"><div class="brand">${brand}</div>${switcher}</header>` : ''
    const foot = chrome && input.brand ? `<footer class="foot">${esc(input.brand)}</footer>` : ''

    const meta = [
        about ? `<meta name="description" content="${esc(about)}">` : '',
        `<meta property="og:type" content="article">`,
        `<meta property="og:title" content="${esc(input.title || input.brand)}">`,
        about ? `<meta property="og:description" content="${esc(about)}">` : '',
        image ? `<meta property="og:image" content="${esc(image)}">` : '',
        input.brand ? `<meta property="og:site_name" content="${esc(input.brand)}">` : '',
        input.canonical ? `<meta property="og:url" content="${esc(input.canonical)}"><link rel="canonical" href="${esc(input.canonical)}">` : '',
        `<meta property="og:locale" content="${esc(input.locale)}">`,
        `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
        input.unlisted ? `<meta name="robots" content="noindex, nofollow">\n<meta name="referrer" content="no-referrer">` : '',
        ...(input.languages ?? []).map((l) => `<link rel="alternate" hreflang="${esc(l.locale)}" href="${esc(l.href)}">`),
    ]
        .filter(Boolean)
        .join('\n')

    const head = ctx.opener
        ? ''
        : [input.title ? `<h1 class="title">${esc(input.title)}</h1>` : '', input.summary ? `<p class="summary">${esc(input.summary)}</p>` : ''].join('')

    return `<!DOCTYPE html>
<html lang="${esc(input.locale)}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="format-detection" content="telephone=no">
<title>${esc(tabTitle)}</title>
${meta}
${fontLinks}<style>
:root{--font-text:${textFont};--font-title:${titleFont};--primary:${c.primary};--on-primary:${c.onPrimary};--text:${c.text};--muted:${c.muted};--bg:${c.background};--border:${c.border};--subtle:${c.subtle};--radius:${radius}px;--fg:var(--text);--mut:var(--muted);--lnk:var(--primary);--acc:var(--primary);--on-acc:var(--on-primary);--line:var(--border);--soft:var(--subtle);--shadow:0 1px 2px rgba(16,24,40,.05),0 8px 24px -8px rgba(16,24,40,.12)}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font-text);font-size:16px;line-height:1.6;overflow-wrap:break-word;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
[dir=rtl] *{letter-spacing:normal!important}
img,svg,video,iframe{display:block;max-width:100%}
a{color:var(--lnk);text-decoration-thickness:1px;text-underline-offset:3px}
h1,h2,h3,h4,p,figure,blockquote{margin:0}
.site{--gut:max(20px,calc((100vw - 640px)/2));display:flex;flex-direction:column;min-height:100vh;overflow-x:hidden;overflow-x:clip;container-type:inline-size}
@supports (width:1cqw){.site{--gut:max(20px,calc((100cqw - 640px)/2))}}
.page{flex:1;padding:${flushTop ? 0 : 20}px var(--gut) 48px}
.top{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:64px;padding:12px 0}
.brand{display:flex;align-items:center;min-width:0}
.brand img{width:auto;border-radius:0}
.brand span{font-weight:700;font-size:17px;letter-spacing:-.01em}
.langs{display:flex;gap:8px;flex-shrink:0}
.langs a{display:inline-flex;align-items:center;height:34px;padding:0 14px;border:1px solid var(--border);border-radius:999px;color:var(--text);font-size:14px;font-weight:600;text-decoration:none}
.title{margin-top:12px;font-size:30px;line-height:1.2;font-weight:700;letter-spacing:-.02em}
.top+.title{margin-top:12px}
.page>.title:first-child{margin-top:0}
.summary{margin-top:10px;color:var(--muted);font-size:17px;line-height:1.5}
.blocks{display:flex;flex-direction:column}
.title+.blocks,.summary+.blocks{margin-top:28px}
.top+.blocks{margin-top:8px}
.foot{padding:24px var(--gut) 40px;border-top:1px solid var(--border);color:var(--muted);font-size:13px;text-align:center}
.notice{margin:0;padding:10px 20px;background:#FEF3C7;color:#78350F;font-size:13px;line-height:1.4;font-weight:600;text-align:center}
.blk{--pull:var(--gut);--inset:var(--gut);min-width:0;color:var(--fg);font-family:var(--font-text)}
.title,.h,.hero-title{font-family:var(--font-title)}
.sa-sm{margin-top:8px}.sa-md{margin-top:20px}.sa-lg{margin-top:36px}.sa-xl{margin-top:56px}
.sb-sm{margin-bottom:8px}.sb-md{margin-bottom:20px}.sb-lg{margin-bottom:36px}.sb-xl{margin-bottom:56px}
.bleed{margin-inline:calc(-1*var(--gut));--pull:0px}
.pad{padding:var(--py) var(--px);--pull:var(--px);--inset:var(--px)}
.rounded{border-radius:var(--radius);overflow:hidden}
.al-start{text-align:start}.al-center{text-align:center}.al-end{text-align:end}
.empty{min-height:24px}
.h{font-weight:700;letter-spacing:-.015em;color:inherit}
.h1{font-size:30px;line-height:1.2;letter-spacing:-.02em}
.h2{font-size:23px;line-height:1.25}
.h3{font-size:19px;line-height:1.3;font-weight:600;letter-spacing:-.01em}
.rt ul,.rt ol{margin:0;padding-inline-start:22px}
.rt>:not(:first-child){margin-top:12px}
.rt li+li{margin-top:6px}
.rt li::marker{color:var(--acc)}
.sz-sm{font-size:14px;line-height:1.55}.sz-md{font-size:16px;line-height:1.6}.sz-lg{font-size:19px;line-height:1.55}
.bw{display:flex}.bw.al-center{justify-content:center}.bw.al-end{justify-content:flex-end}
.btn{--c:var(--acc);--on:var(--on-acc);display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;min-width:200px;max-width:100%;padding:12px 24px;border:2px solid transparent;border-radius:var(--radius);font-size:16px;font-weight:600;line-height:20px;text-align:center;text-decoration:none}
.btn.primary{background:var(--c);border-color:var(--c);color:var(--on)}
.btn.outline{border-color:var(--c);color:var(--c)}
.btn.soft{background:var(--subtle);background:color-mix(in srgb,var(--c) 12%,transparent);color:var(--c)}
.btn.full{width:100%}
.btn svg{width:18px;height:18px;flex-shrink:0}
.fig.al-center{margin-inline:auto}.fig.al-end{margin-inline-start:auto}
.fig>a{display:block}
.media{width:100%;height:auto;border-radius:var(--radius);background:var(--subtle)}
img.media{object-fit:cover}
.flush .media,.flush .gal.grid .media{border-radius:0}
.cap{margin-top:8px;color:var(--mut);font-size:13px;line-height:1.45;text-align:center}
.ph{display:flex;align-items:center;justify-content:center;width:100%;background:#ECEEF1;color:#A3A9B3}
.ph svg{width:36px;height:36px}
.ph-list{display:flex;align-items:center;justify-content:center;min-height:72px;padding:12px;border:1.5px dashed #D3D7DD;border-radius:var(--radius);color:#8A919C;font-size:14px}
.hero{position:relative;display:grid;min-height:160px;overflow:hidden;background:#1F2933;color:#FFFFFF;--most:320px}
.hero.h-sm{--most:220px}.hero.h-lg{--most:440px}
.hero>.hero-img,.hero>.hero-body{grid-area:1/1}
.hero-img{width:100%;height:auto;min-height:100%;max-height:var(--most);max-width:none;object-fit:cover}
.hero .ph{background:#C9CED6;color:#F4F5F7}
.hero .shade{position:absolute;inset:0}
.hero-body{position:relative;align-self:end;display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:24px}
.hero.p-top .hero-body{align-self:start}.hero.p-center .hero-body{align-self:center}
.bleed .hero-body{padding-inline:max(24px,calc(var(--gut) + 4px))}
.hero.al-center .hero-body{align-items:center}.hero.al-end .hero-body{align-items:flex-end}
.hero-title{font-size:30px;line-height:1.15;font-weight:700;letter-spacing:-.02em;text-shadow:0 1px 18px rgba(0,0,0,.18)}
.hero-sub{font-size:17px;line-height:1.5;opacity:.92}
.hero-btn{margin-top:10px;min-width:0;background:#FFFFFF;color:var(--primary)}
.gal.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.gal.grid.one,.gal.grid .wide{grid-column:1/-1}
.gal.one{grid-template-columns:1fr}
.gal.track{display:flex;align-items:flex-start;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;margin-inline:calc(-1*var(--pull));padding-inline-start:var(--inset);scroll-padding-inline:var(--inset)}
.gal.track::-webkit-scrollbar{display:none}
.gal.track::after{content:"";flex:0 0 max(1px,calc(var(--inset) - 12px))}
.gal.track .slide{flex:0 0 85%;max-width:520px;scroll-snap-align:start}
.vid{position:relative;display:block;aspect-ratio:16/9;overflow:hidden;background:#0E1116}
.vid iframe,.vid video,.vid img{position:absolute;inset:0;width:100%;height:100%;max-width:none;border:0;object-fit:cover}
.vid video{object-fit:contain;background:#000}
.play{position:absolute;top:50%;left:50%;display:flex;align-items:center;justify-content:center;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;background:#FFFFFF;color:var(--primary);box-shadow:0 8px 28px rgba(0,0,0,.28)}
.play svg{width:26px;height:26px;margin-left:3px}
.card{--fg:var(--text);--mut:var(--muted);--lnk:var(--primary);--acc:var(--primary);--on-acc:var(--on-primary);--line:var(--border);display:block;overflow:hidden;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);color:var(--text);text-decoration:none}
.cards{display:grid;gap:12px}
.cards.c2{grid-template-columns:1fr 1fr}
.c1 .card{display:flex;align-items:center;gap:14px;padding:14px}
.c1 .card-img{flex:0 0 96px;width:96px;height:96px;border-radius:max(4px,calc(var(--radius) - 4px));object-fit:cover}
.c1 .card-img.ph svg{width:28px;height:28px}
.card-body{flex:1;min-width:0}
.c2 .card-img{width:100%;aspect-ratio:4/3;object-fit:cover}
.c2 .card-body{padding:12px 14px 14px}
.card-title{font-size:16px;line-height:1.35;font-weight:600}
.card-text{margin-top:4px;color:var(--muted);font-size:14px;line-height:1.5}
.chev{flex-shrink:0;width:20px;height:20px;color:var(--mut)}
[dir=rtl] .chev,[dir=rtl] .quote>svg{transform:scaleX(-1)}
.mx{display:grid;gap:16px}
.mx-body{display:flex;flex-direction:column;align-items:flex-start;gap:12px;min-width:0}
.mx-body .rt{align-self:stretch}
.mx-body .btn{margin-top:4px}
.faq{border-top:1px solid var(--line)}
.faq details{border-bottom:1px solid var(--line)}
.faq summary{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 0;font-size:16px;font-weight:600;line-height:1.4;list-style:none;cursor:pointer}
.faq summary::-webkit-details-marker{display:none}
.faq summary svg{flex-shrink:0;width:20px;height:20px;color:var(--mut);transition:transform .2s}
.faq details[open] summary svg{transform:rotate(180deg)}
.faq .ans{padding-bottom:18px;font-size:15px;line-height:1.6}
.pills{display:flex;flex-wrap:wrap;gap:8px}
.pill{display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 18px;border-radius:999px;background:var(--soft);color:var(--acc);font-size:15px;font-weight:600;text-decoration:none;white-space:nowrap}
.pill svg{width:18px;height:18px}
.clist{border-top:1px solid var(--line)}
.crow{display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--line);color:var(--fg);text-decoration:none}
.cicon{display:flex;flex:0 0 40px;align-items:center;justify-content:center;height:40px;border-radius:50%;background:var(--soft);color:var(--acc)}
.cicon svg{width:19px;height:19px}
.ctext{display:flex;flex:1;flex-direction:column;min-width:0}
.clabel{font-size:15px;font-weight:600;line-height:1.35}
.cvalue{color:var(--mut);font-size:14px;line-height:1.4;overflow-wrap:anywhere}
.ev{padding:16px}
.ev-top{display:flex;align-items:flex-start;gap:14px}
.ev-badge{display:flex;flex:0 0 64px;flex-direction:column;align-items:center;justify-content:center;min-height:68px;padding:8px 0;border-radius:12px;background:var(--subtle);color:var(--primary);line-height:1}
.ev-mon{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.ev-day{margin-top:5px;font-size:26px;font-weight:700;letter-spacing:-.02em}
.ev-info{display:flex;flex:1;flex-direction:column;gap:4px;min-width:0;padding-top:2px}
.ev-title{font-size:17px;font-weight:600;line-height:1.35}
.ev-date{font-size:15px;line-height:1.45}
.ev-line{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:14px;line-height:1.45;text-decoration:none}
.ev-line svg{flex-shrink:0;width:16px;height:16px}
a.ev-line{color:var(--primary)}
.ev-cal{width:100%;min-height:44px;min-width:0;margin-top:16px;padding-block:10px;font-size:15px}
.quote>svg{width:34px;height:34px;margin-bottom:8px;color:var(--acc)}
.quote p{font-size:19px;line-height:1.5;font-weight:500}
.quote figcaption{margin-top:12px;color:var(--mut);font-size:14px}
.stats{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:22px 12px;text-align:center}
.stat-v{display:block;color:var(--acc);font-size:28px;font-weight:700;line-height:1.15;letter-spacing:-.02em}
.stat-l{display:block;margin-top:4px;color:var(--mut);font-size:13px;line-height:1.4}
.note{--fg:var(--ntx);--mut:var(--ntx);--lnk:var(--ntx);--acc:var(--bar);padding:14px 16px;border-inline-start:3px solid var(--bar);border-radius:8px;background:var(--nbg);color:var(--ntx);font-size:15px;line-height:1.55}
.note.info{--bar:var(--primary);--nbg:var(--subtle);--ntx:var(--text);--lnk:var(--primary)}
.note.success{--bar:#1E9E57;--nbg:#E8F7EE;--ntx:#14532D}
.note.warning{--bar:#F5A524;--nbg:#FFF8E6;--ntx:#6B4A00}
.note.danger{--bar:#E5484D;--nbg:#FDECEC;--ntx:#7F1D1D}
.note-title{margin-bottom:4px;font-weight:700}
.details{width:100%;border-collapse:collapse;font-size:15px;line-height:1.5}
.details th,.details td{padding:12px 0;border-bottom:1px solid var(--line);vertical-align:top}
.details tr:first-child th,.details tr:first-child td{border-top:1px solid var(--line)}
.details th{width:40%;padding-inline-end:12px;color:var(--mut);font-weight:400;text-align:start}
.details td{font-weight:600;text-align:end}
.hr{height:0;margin:0;border:0;border-top:1px solid var(--line)}
@media (min-width:640px){
.title{font-size:36px}
.hero{min-height:400px}.hero.h-sm{min-height:280px}.hero.h-lg{min-height:540px}
.hero-img{position:absolute;inset:0;height:100%;max-height:none}
.hero-title{font-size:40px}
.mx{grid-template-columns:1fr 1fr;align-items:center;gap:32px}
.mx.side-end .mx-media{order:2}
.stats.n4{--n:4!important}
.t-image.bleed img.media{max-height:560px}
.gal.track{margin-inline:0;padding-inline-start:0;scroll-padding-inline:0}
.gal.track::after{display:none}
.gal.track .slide{flex-basis:45%}
}
</style>
</head>
<body>
${input.notice ? `<p class="notice">${esc(input.notice)}</p>\n` : ''}<div class="site">
<main class="page">
${top}${head}
<div class="blocks">
${body}
</div>
</main>
${foot}
</div>
</body>
</html>
`
}
