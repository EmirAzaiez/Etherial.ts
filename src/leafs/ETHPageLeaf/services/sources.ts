import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

import { PageError } from './options.js'

// ──────────────────────────────────────────────────────────────────────────
// What a page can be made from besides the words: a page of a website the
// editor gives the link of, and PDFs (a brochure, a flyer, a letter). A link
// is opened here and only the page's content is kept — its words, headings,
// pictures and links, as Markdown — not the site around it (menus, forms,
// footer). A PDF is sent as it is: Claude reads its pages. A link is opened
// by the server, so only a public address is: never the server's own network.
// ──────────────────────────────────────────────────────────────────────────

/** A page of a website, read. */
export interface PageSource {
    url: string
    title: string
    /** Its content as Markdown: headings, paragraphs, lists, `![alt](src)`, `[text](href)`. */
    text: string
    /** Its pictures' addresses (https), the cover first: Claude may put them on the page. */
    images: string[]
}

/** A PDF, base64. */
export interface DocumentSource {
    name: string
    data: string
}

export const MAX_LINKS = 3
export const MAX_DOCUMENTS = 2
/** All the PDFs together, base64: the API takes 32 MB per request, screenshots and words included. */
const MAX_DOCUMENTS_SIZE = 20 * 1024 * 1024
/** A page or a PDF downloaded from a link. */
const MAX_DOWNLOAD = 15 * 1024 * 1024
const TIMEOUT = 15_000
const MAX_REDIRECTS = 5
/** About 10 000 tokens: a long article, without the rest of the site. */
const MAX_TEXT = 40_000
const MAX_IMAGES = 40
/** A site that answers a robot with a challenge page answers a browser with the page. */
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

/** The links to read, as the back-office sends them: https or http, each once. */
export function cleanLinks(value: unknown): string[] {
    if (!Array.isArray(value) || !value.length) return []
    const links = [...new Set(value.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean))]
    if (links.length > MAX_LINKS) throw new PageError(`${MAX_LINKS} links at most.`)
    for (const link of links) {
        let url: URL
        try {
            url = new URL(link)
        } catch {
            throw new PageError(`${link.slice(0, 80)} is not a link to a page.`)
        }
        if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new PageError(`${link.slice(0, 80)}: only a web page's link (https://…) can be read.`)
    }
    return links
}

/** The PDFs, as the back-office sends them: `[{ name, data }]`, data a data: URL or the base64 alone. */
export function cleanDocuments(value: unknown): DocumentSource[] {
    if (!Array.isArray(value) || !value.length) return []
    if (value.length > MAX_DOCUMENTS) throw new PageError(`${MAX_DOCUMENTS} PDFs at most.`)
    const documents = value.map((doc: any) => {
        const url = typeof doc?.data === 'string' ? /^data:([^;,]+);base64,([^]*)$/.exec(doc.data) : null
        const mediaType = String(url?.[1] ?? doc?.mediaType ?? 'application/pdf').toLowerCase()
        const data = url ? url[2] : typeof doc?.data === 'string' ? doc.data : ''
        const name = (typeof doc?.name === 'string' && doc.name.trim().slice(0, 120)) || 'document.pdf'
        if (mediaType !== 'application/pdf') throw new PageError(`${name} is not a PDF.`)
        // A PDF starts with "%PDF": "JVBERi" in base64.
        if (!data.startsWith('JVBERi') || !/^[A-Za-z0-9+/]+=*$/.test(data.slice(0, 200))) throw new PageError(`${name} could not be read: it is not a PDF.`)
        return { name, data }
    })
    if (documents.reduce((size, doc) => size + doc.data.length, 0) > MAX_DOCUMENTS_SIZE) throw new PageError('The PDFs are too large: 15 MB at most together.')
    return documents
}

// ── Opening a link ────────────────────────────────────────────────────────

function privateAddress(ip: string): boolean {
    if (isIP(ip) === 4) {
        const [a, b] = ip.split('.').map(Number)
        return (
            a === 0 ||
            a === 10 ||
            a === 127 ||
            (a === 100 && b >= 64 && b <= 127) ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            (a === 198 && (b === 18 || b === 19)) ||
            a >= 224
        )
    }
    const v6 = ip.toLowerCase()
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6)
    if (mapped) return privateAddress(mapped[1])
    return v6 === '::' || v6 === '::1' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith('ff')
}

/** Only a public site is opened: never the server's own network, its cloud's metadata. */
async function checkPublic(url: URL): Promise<void> {
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new PageError(`${url.href.slice(0, 80)}: only a web page's link (https://…) can be read.`, 422)
    if (url.username || url.password) throw new PageError('A link with a password in it cannot be read.', 422)
    const host = url.hostname.replace(/^\[|\]$/g, '')
    const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address)
    if (!addresses.length) throw new PageError(`${host} could not be found: check the link.`, 422)
    if (addresses.some(privateAddress)) throw new PageError(`${host} is not a public website: only a page on the web can be read.`, 422)
}

interface Download {
    url: URL
    type: string
    body: Buffer
}

async function download(link: string, signal?: AbortSignal): Promise<Download> {
    let url = new URL(link)
    const timeout = AbortSignal.timeout(TIMEOUT)
    const both = signal ? AbortSignal.any([signal, timeout]) : timeout
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        await checkPublic(url)
        let response: globalThis.Response
        try {
            response = await fetch(url, {
                redirect: 'manual',
                signal: both,
                headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5', 'accept-language': 'en,ar;q=0.8' },
            })
        } catch {
            if (signal?.aborted) throw new PageError('Stopped.', 499)
            if (timeout.aborted) throw new PageError(`${url.hostname} took too long to answer. Try again, or send a screenshot of the page.`, 422)
            throw new PageError(`${url.hostname} could not be reached: check the link.`, 422)
        }
        const location = response.headers.get('location')
        if (response.status >= 300 && response.status < 400 && location) {
            await response.body?.cancel().catch(() => undefined)
            url = new URL(location, url)
            continue
        }
        if (!response.ok || !response.body) {
            await response.body?.cancel().catch(() => undefined)
            const why =
                response.status === 404 || response.status === 410
                    ? 'the page is not there'
                    : response.status === 401 || response.status === 403
                      ? 'the site does not let it be read'
                      : `it answered ${response.status}`
            throw new PageError(`${url.hostname}${url.pathname === '/' ? '' : url.pathname} could not be read: ${why}. Check the link, or send a screenshot of the page.`, 422)
        }
        const chunks: Buffer[] = []
        let size = 0
        try {
            for await (const chunk of response.body as any as AsyncIterable<Uint8Array>) {
                size += chunk.length
                if (size > MAX_DOWNLOAD) {
                    await response.body.cancel().catch(() => undefined)
                    throw new PageError(`${url.hostname} sent more than 15 MB: too large to read.`, 422)
                }
                chunks.push(Buffer.from(chunk))
            }
        } catch (err) {
            if (err instanceof PageError) throw err
            if (signal?.aborted) throw new PageError('Stopped.', 499)
            throw new PageError(`${url.hostname} took too long to answer. Try again, or send a screenshot of the page.`, 422)
        }
        return { url, type: (response.headers.get('content-type') ?? '').toLowerCase(), body: Buffer.concat(chunks) }
    }
    throw new PageError(`${new URL(link).hostname} sends the link elsewhere too many times.`, 422)
}

/**
 * Opens a link: a web page is read into a `PageSource`, a PDF comes back as
 * a document to send as it is. Throws a PageError saying what to do when it
 * can't be read (not found, not public, a page drawn by scripts only).
 */
export async function readLink(link: string, signal?: AbortSignal): Promise<{ page: PageSource } | { document: DocumentSource }> {
    const { url, type, body } = await download(link, signal)
    if (type.includes('application/pdf') || body.subarray(0, 5).toString('latin1') === '%PDF-') {
        const name = decodeURIComponent(url.pathname.split('/').pop() || '') || `${url.hostname}.pdf`
        return { document: { name, data: body.toString('base64') } }
    }
    if (type && !/html|xml|text\/plain/.test(type)) throw new PageError(`${url.hostname}: this link is a file (${type.split(';')[0]}), not a page. Send a PDF or a screenshot instead.`, 422)
    const html = decodeHtml(body, type)
    const page = readablePage(html, url)
    const words = page.text.replace(/!?\[[^\]]*\]\([^)]*\)/g, ' ').replace(/[#\s-]+/g, ' ').trim()
    if (words.length < 150 && page.images.length < 2) {
        throw new PageError(`${url.hostname} shows almost nothing without a browser: send a screenshot of the page, or its PDF, instead.`, 422)
    }
    return { page }
}

function decodeHtml(body: Buffer, type: string): string {
    const declared = /charset=["']?([\w-]+)/i.exec(type)?.[1] ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(body.subarray(0, 4096).toString('latin1'))?.[1] ?? 'utf-8'
    try {
        return new TextDecoder(declared.toLowerCase()).decode(body)
    } catch {
        return new TextDecoder('utf-8').decode(body)
    }
}

// ── Reading a page ────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
    laquo: '«', raquo: '»', copy: '©', reg: '®', trade: '™', euro: '€', pound: '£', middot: '·', bull: '•', times: '×', deg: '°', shy: '',
}

function decodeEntities(text: string): string {
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
        if (entity[0] === '#') {
            const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
            return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole
        }
        return ENTITIES[entity] ?? ENTITIES[entity.toLowerCase()] ?? whole
    })
}

function attrOf(tag: string, name: string): string {
    const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)
    return m ? decodeEntities(m[1] ?? m[2] ?? m[3] ?? '').trim() : ''
}

function absolute(href: string, base: URL): string {
    try {
        return new URL(href, base).href
    } catch {
        return ''
    }
}

/** An image's best address: the widest of its srcset up to 2048 px, https. '' for an icon, a pixel, a vector. */
function imageSrc(tag: string, base: URL): string {
    const srcset = attrOf(tag, 'data-srcset') || attrOf(tag, 'data-lazy-srcset') || attrOf(tag, 'srcset')
    let best = ''
    let bestWidth = 0
    for (const candidate of srcset.split(/,\s+/)) {
        const [href, size] = candidate.trim().split(/\s+/)
        const width = Number(/^(\d+)w$/.exec(size ?? '')?.[1] ?? 0)
        if (href && width <= 2048 && width >= bestWidth) {
            best = href
            bestWidth = width
        }
    }
    const given = best || attrOf(tag, 'data-src') || attrOf(tag, 'data-lazy-src') || attrOf(tag, 'data-original') || attrOf(tag, 'src')
    if (!given || given.startsWith('data:')) return ''
    const width = Number(attrOf(tag, 'width')) || 0
    const height = Number(attrOf(tag, 'height')) || 0
    if (width && height && width < 120 && height < 120) return ''
    const src = absolute(given, base).replace(/^http:\/\//i, 'https://')
    if (!/^https:\/\//i.test(src) || /\.svg(\?|#|$)/i.test(src)) return ''
    return src
}

/**
 * Whether the page draws this picture itself (an `<img>`, a background), at any
 * of its sizes: WordPress names them photo-1024x445.jpg, photo-scaled.jpg.
 */
function showsPicture(html: string, src: string): boolean {
    const stem = (src.split(/[?#]/)[0].split('/').pop() ?? '').replace(/\.\w+$/, '').replace(/-(scaled|\d+x\d+)$/i, '')
    if (stem.length < 4) return true
    const body = /<body\b[^>]*>([\s\S]*)<\/body\s*>/i.exec(html)?.[1] ?? html
    return body.replace(/<script\b[\s\S]*?<\/script\s*>/gi, ' ').includes(stem)
}

/**
 * A page's content as Markdown, and its pictures: the site's `<main>` (or
 * its article, or its body without header and footer), without what is
 * not the page (scripts, menus, forms, sidebars, pop-ups). A line the
 * site repeats (a desktop and a phone version of a section) comes once.
 */
export function readablePage(html: string, pageUrl: URL): PageSource {
    const baseHref = attrOf(/<base\b[^>]*>/i.exec(html)?.[0] ?? '', 'href')
    const base = baseHref ? new URL(absolute(baseHref, pageUrl) || pageUrl.href) : pageUrl
    const metas = html.match(/<meta\b[^>]*>/gi) ?? []
    const meta = (key: string) => {
        for (const tag of metas) if ((attrOf(tag, 'property') || attrOf(tag, 'name')).toLowerCase() === key) return attrOf(tag, 'content')
        return ''
    }
    const title = meta('og:title') || decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '').replace(/\s+/g, ' ').trim()
    const description = meta('og:description') || meta('description')

    const clean = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|svg|template|canvas|select|textarea|button|object)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    const main = /<main\b[^>]*>([\s\S]*?)<\/main\s*>/i.exec(clean)?.[1] ?? /<article\b[^>]*>([\s\S]*)<\/article\s*>/i.exec(clean)?.[1]
    let content = main ?? (/<body\b[^>]*>([\s\S]*)<\/body\s*>/i.exec(clean)?.[1] ?? clean).replace(/<header\b[\s\S]*?<\/header\s*>/gi, ' ')
    content = content.replace(/<(nav|form|aside|dialog|footer)\b[\s\S]*?<\/\1\s*>/gi, ' ')

    const images: string[] = []
    const cover = absolute(meta('og:image'), base).replace(/^http:\/\//i, 'https://')
    if (/^https:\/\//i.test(cover) && !/\.svg(\?|#|$)/i.test(cover)) images.push(cover)
    const markdown = content
        // A video a page builder starts with a script (Elementor's video widget): its link, in the widget's settings.
        .replace(/<[a-z][^>]*\sdata-settings\s*=\s*"[^"]*(?:youtube|vimeo)_url[^"]*"[^>]*>/gi, (tag) => {
            const settings = attrOf(tag, 'data-settings')
            const type = /"video_type"\s*:\s*"(\w+)"/.exec(settings)?.[1] ?? 'youtube'
            const src = new RegExp(`"${type}_url"\\s*:\\s*"([^"]+)"`).exec(settings)?.[1]?.replace(/\\\//g, '/') ?? ''
            return /^https:\/\/([\w-]+\.)?(youtube\.com|youtu\.be|vimeo\.com)\//i.test(src) ? `${tag}\nVideo: ${src}\n` : tag
        })
        // A video from YouTube or Vimeo: its link.
        .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>|<iframe\b[^>]*>/gi, (tag) => {
            const src = absolute(attrOf(tag, 'data-src') || attrOf(tag, 'src'), base)
            return /youtube\.com|youtu\.be|vimeo\.com/i.test(src) ? `\nVideo: ${src}\n` : ' '
        })
        // A video file the page plays (its src, or its first <source>): its link.
        .replace(/<video\b[^>]*>[\s\S]*?<\/video\s*>|<video\b[^>]*>/gi, (tag) => {
            const src = absolute(attrOf(tag, 'src'), base).replace(/^http:\/\//i, 'https://')
            return /^https:\/\//i.test(src) ? `\nVideo: ${src}\n` : ' '
        })
        .replace(/<img\b[^>]*>/gi, (tag) => {
            const src = imageSrc(tag, base)
            if (!src) return ' '
            if (!images.includes(src) && images.length < MAX_IMAGES) images.push(src)
            return images.includes(src) ? `\n![${attrOf(tag, 'alt').replace(/[[\]]/g, '')}](${src})\n` : ' '
        })
        .replace(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi, (_whole, attrs: string, inner: string) => {
            const href = attrOf(` ${attrs}`, 'href')
            const link = /^(mailto|tel):/i.test(href) ? href : /^#|^javascript:/i.test(href) || !href ? '' : absolute(href, base)
            const text = inner.replace(/<(?!\/?(img)\b)[^>]+>/gi, ' ')
            return link && /^(https?|mailto|tel):/i.test(link) && text.trim() ? `[${text.trim()}](${link})` : inner
        })
        .replace(/<h([1-6])\b[^>]*>/gi, (_w, level: string) => `\n\n${'#'.repeat(Number(level))} `)
        .replace(/<\/h[1-6]\s*>/gi, '\n\n')
        .replace(/<li\b[^>]*>/gi, '\n- ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?(p|div|section|article|header|figure|figcaption|blockquote|table|tr|ul|ol|dl|dt|dd|address|main|span\s+class="[^"]*elementor-icon-list-text)\b[^>]*>/gi, '\n')
        .replace(/<\/?(td|th)\b[^>]*>/gi, ' ')
        .replace(/<[^>]+>/g, '')

    const lines: string[] = []
    const seen = new Set<string>()
    let size = 0
    let cut = false
    for (const raw of decodeEntities(markdown).split('\n')) {
        const line = raw.replace(/[ \t ]+/g, ' ').trim()
        if (!line || line === '-') continue
        // "- " alone, its words on the next line: one line.
        if (lines[lines.length - 1] === '-') lines.pop()
        const key = line.toLowerCase()
        if ((line.length >= 20 || line.startsWith('![')) && seen.has(key)) continue
        seen.add(key)
        if (size + line.length > MAX_TEXT) {
            cut = true
            break
        }
        size += line.length + 1
        lines.push(line.startsWith('#') ? `\n${line}` : line)
    }
    // The site's share picture is the page's cover only when the page shows it
    // too (a banner drawn as a background) or has no picture of its own: else
    // it is just the thumbnail of a shared link, a banner the page doesn't have.
    const coverShown = images[0] === cover && (images.length === 1 || showsPicture(html, cover))
    if (images[0] === cover && !coverShown) images.shift()
    let text = lines.join('\n').trim()
    // The site's summary of the page, when the page doesn't already start with it.
    const summary = description.replace(/\s*(\[…\]|\.\.\.|…)$/, '')
    const words = (t: string) => t.toLowerCase().replace(/!?\[[^\]]*\]\([^)]*\)/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    if (summary && !words(text).includes(words(summary).slice(0, 60))) text = `${summary}\n\n${text}`
    // The cover, when it is one: first, where Claude reads it.
    if (coverShown && !text.includes(`(${cover})`)) text = `![${title.replace(/[[\]]/g, '')}](${cover})\n\n${text}`
    if (cut) text += '\n\n(The page goes on; the rest was left out.)'
    return { url: pageUrl.href, title, text, images }
}
