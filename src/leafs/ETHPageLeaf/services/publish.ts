import etherial from 'etherial'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { Op } from 'sequelize'

import { Page } from '../models/Page.js'
import { PageBlocks, PageError, PageHead, PageImage, ResolvedBlock, defaultLocaleOf, folderOf, localesOf, localize, rtlOf } from './options.js'
import { photoOf } from './blocks.js'
import { render } from './render.js'
import { resolveBlocks } from './resolve.js'
import { pageFonts, pageHead } from './settings.js'
import { state } from './state.js'

// ──────────────────────────────────────────────────────────────────────────
// The HTML of a page in the bucket: one file per language that has blocks,
// `<folder>/<slug>/<locale>.html`, public, cached a minute. Written when the
// page is saved published, taken down when it is unpublished, moved or
// deleted. The API never serves it: a shared link goes to the bucket.
//
// A page's preview link is in the bucket too, for a draft to be read before it
// is on the web: `<folder>/preview/<key>/<locale>.html`, written again on each
// save, never cached nor indexed. Stopped, its files say the link no longer
// works (see share.ts).
// ──────────────────────────────────────────────────────────────────────────

/** What publishing reads of a page: the saved row, or the row about to be saved. */
export interface PageLike {
    slug: string
    title: Record<string, string>
    summary: Record<string, string>
    blocks: PageBlocks
    published: boolean
    /** How it opens, its own choices: the rest is every page's. */
    head?: PageHead | null
    /** The photo across the top: its record's cover. */
    cover?: PageImage | null
    /** Its record's logo, on the edge of a `sheet` head or over the cover with the head's `logo`. */
    logo?: PageImage | null
    html?: Record<string, string> | null
    published_slug?: string | null
    published_at?: Date | null
    preview_key?: string | null
}

/** A page in one language, as the app and the web get it. */
export interface PageIn {
    /** The language it is written in: the one asked for, or the default when that one has no blocks. */
    locale: string
    dir: 'ltr' | 'rtl'
    title: string
    summary: string
    /** With what each one needs worked out in this language (`resolved`): an event's date, a video's player. */
    blocks: ResolvedBlock[]
}

function mediaLeaf(): any {
    const media = (etherial as any).eth_media_leaf
    if (!media?.s3 || !media?.bucket) throw new PageError('Pages need the media leaf: their HTML and images go to its bucket.', 500)
    return media
}

/** Where the bucket's public files are read from: the CDN, else the bucket itself. */
export function publicBase(): string {
    const media = mediaLeaf()
    if (media.config?.cdn_url) return String(media.config.cdn_url).replace(/\/$/, '')
    return `${String(media.config.server).replace(/\/$/, '')}/${media.bucket}`
}

export function keyOf(slug: string, locale: string): string {
    return `${folderOf(state.config)}/${slug}/${locale}.html`
}

/** The languages with blocks of their own, the default one first (always: a page has at least it). */
export function writtenLocales(blocks: PageBlocks): string[] {
    const locales = localesOf(state.config)
    const written = locales.filter((l) => blocks?.[l]?.length)
    return written.length ? written : [locales[0]]
}

export function pageIn(page: Pick<PageLike, 'title' | 'summary' | 'blocks'>, asked: string): PageIn {
    const config = state.config
    const fallback = defaultLocaleOf(config)
    const locales = localesOf(config)
    const own = locales.includes(asked) && page.blocks?.[asked]?.length
    // A language without blocks reads the default one: a title in Arabic over English blocks would be half a page.
    const locale = own ? asked : (writtenLocales(page.blocks)[0] ?? fallback)
    const title = localize(page.title, locale, fallback)
    return {
        locale,
        dir: rtlOf(config, locale) ? 'rtl' : 'ltr',
        title,
        summary: localize(page.summary, locale, fallback),
        blocks: resolveBlocks(page.blocks?.[locale] ?? [], { locale, title, timezone: config.timezone, mapsKey: config.maps?.key }),
    }
}

async function put(key: string, html: string, cacheControl = state.config.cacheControl ?? 'public, max-age=60'): Promise<void> {
    const media = mediaLeaf()
    await media.s3.send(
        new PutObjectCommand({
            Bucket: media.bucket,
            Key: key,
            Body: html,
            ContentType: 'text/html; charset=utf-8',
            CacheControl: cacheControl,
            ACL: 'public-read',
        })
    )
}

function keysOf(page: Pick<PageLike, 'published_slug' | 'html'> | null): string[] {
    if (!page?.published_slug) return []
    const locales = new Set([...localesOf(state.config), ...Object.keys(page.html ?? {})])
    return [...locales].map((l) => keyOf(page.published_slug!, l))
}

/** Every language of the page, rendered as the bucket gets it. */
export function renderAll(page: PageLike): { locale: string; key: string; url: string; html: string }[] {
    const config = state.config
    const fallback = defaultLocaleOf(config)
    const base = publicBase()
    const locales = writtenLocales(page.blocks)
    const languages = locales.map((l) => ({ locale: l, href: `${l}.html` }))
    const fonts = pageFonts()
    const head = pageHead(page.head)
    return locales.map((locale) => {
        const content = pageIn(page, locale)
        const key = keyOf(page.slug, locale)
        const url = `${base}/${key}`
        const html = render({
            ...content,
            rtl: content.dir === 'rtl',
            theme: config.theme ?? {},
            brand: localize(config.theme?.brandName, locale, fallback),
            // Next to this one in the bucket, in the same language.
            pageHref: (slug) => `../${slug}/${locale}.html`,
            languages,
            canonical: url,
            timezone: config.timezone,
            fonts,
            head,
            cover: photoOf(page),
            logo: page.logo ?? null,
            maps: config.maps,
        })
        return { locale, key, url, html }
    })
}

/**
 * Puts the page's HTML where it belongs before the row is saved: the columns
 * to save with it, and the files of its old address to take down once it is.
 * A bucket that refuses fails the save, so the back-office never shows a page
 * as published while the web has the old one.
 */
export async function publish(next: PageLike, previous: PageLike | null) {
    const files = next.published ? renderAll(next) : []
    await Promise.all(files.map((f) => put(f.key, f.html)))

    const kept = new Set(files.map((f) => f.key))
    return {
        columns: {
            html: Object.fromEntries(files.map((f) => [f.locale, f.url])),
            published_slug: next.published ? next.slug : null,
            published_at: next.published ? (previous?.published ? (previous.published_at ?? new Date()) : new Date()) : null,
        },
        stale: keysOf(previous).filter((key) => !kept.has(key)),
    }
}

/**
 * Files no page uses any more, deleted in the background: a slow bucket holds
 * neither a save nor a delete. A failure only leaves a file behind (the media
 * leaf logs it).
 */
export function takeDown(keys: string[]): void {
    if (!keys.length) return
    const media = (etherial as any).eth_media_leaf
    if (!media?.deleteFile) return
    void Promise.all(keys.map((key) => media.deleteFile(key)))
}

/** A page deleted: its files go, its preview link says it no longer works. */
export function takeDownPage(page: Pick<PageLike, 'published_slug' | 'html' | 'preview_key'>): void {
    takeDown(keysOf(page))
    if (page.preview_key) retirePreview(page.preview_key).catch((err) => console.error('[ETHPageLeaf] A preview link could not be stopped:', err?.message ?? err))
}

// ── The preview link

/** A draft says so above it, in its language: the link may be forwarded. */
const NOTICE: Record<string, string> = {
    en: 'Preview: this page is not published. Only people with this link can see it.',
    ar: 'معاينة: هذه الصفحة غير منشورة، ولا يراها إلا من لديه هذا الرابط.',
    fr: 'Aperçu : cette page n’est pas publiée. Seules les personnes qui ont ce lien la voient.',
}

const GONE: Record<string, [string, string]> = {
    en: ['This link no longer works', 'Ask the person who sent it for a new one.'],
    ar: ['هذا الرابط لم يعد يعمل', 'اطلب رابطاً جديداً ممن أرسله إليك.'],
    fr: ['Ce lien ne marche plus', 'Demandez-en un nouveau à la personne qui vous l’a envoyé.'],
}

/** Read again on every visit: whoever has the link sees the last save. */
const PREVIEW_CACHE = 'no-store'

export function previewKeyOf(key: string, locale: string): string {
    return `${folderOf(state.config)}/preview/${key}/${locale}.html`
}

/**
 * The page under its preview link as saved, in every language of the project
 * (one it isn't written in reads the default one): a line above a draft says
 * so, search engines are kept out.
 */
function renderPreview(page: PageLike, key: string): { key: string; html: string }[] {
    const config = state.config
    const fallback = defaultLocaleOf(config)
    const languages = writtenLocales(page.blocks).map((l) => ({ locale: l, href: `${l}.html` }))
    const fonts = pageFonts()
    const head = pageHead(page.head)
    return localesOf(config).map((asked) => {
        const content = pageIn(page, asked)
        const lang = content.locale.split('-')[0]
        return {
            key: previewKeyOf(key, asked),
            html: render({
                ...content,
                rtl: content.dir === 'rtl',
                theme: config.theme ?? {},
                brand: localize(config.theme?.brandName, content.locale, fallback),
                // Another page opens where it is on the web.
                pageHref: (slug) => `../../${slug}/${content.locale}.html`,
                languages,
                timezone: config.timezone,
                fonts,
                head,
                cover: photoOf(page),
            logo: page.logo ?? null,
            maps: config.maps,
                unlisted: true,
                notice: page.published ? undefined : (NOTICE[lang] ?? NOTICE.en),
            }),
        }
    })
}

/** The page written under its preview link: when the link is made, and on each save after. */
export async function putPreview(page: PageLike, key: string): Promise<void> {
    await Promise.all(renderPreview(page, key).map((f) => put(f.key, f.html, PREVIEW_CACHE)))
}

/** A preview link stopped: its files say it no longer works, in their language. */
export async function retirePreview(key: string): Promise<void> {
    await Promise.all(localesOf(state.config).map((l) => put(previewKeyOf(key, l), goneHtml(l), PREVIEW_CACHE)))
}

function goneHtml(locale: string): string {
    const lang = locale.split('-')[0]
    const [title, text] = GONE[lang] ?? GONE.en
    const dir = lang === 'ar' ? 'rtl' : 'ltr'
    return `<!DOCTYPE html>
<html lang="${GONE[lang] ? lang : 'en'}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title}</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Tahoma,Arial,sans-serif;color:#111827;text-align:center}h1{margin:0;font-size:22px}p{margin:8px 0 0;color:#6B7280}</style>
</head>
<body><div><h1>${title}</h1><p>${text}</p></div></body>
</html>
`
}

/** Every published page written into the bucket again, and every preview link: after a change of theme or of fonts. */
export async function republishAll(): Promise<number> {
    const pages = await Page.findAll({ where: { published: true } })
    for (const page of pages) {
        const row = page.get({ plain: true }) as any
        const { columns, stale } = await publish(row, row)
        await page.update(columns)
        takeDown(stale)
    }
    const shared = await Page.findAll({ where: { preview_key: { [Op.ne]: null } } })
    for (const page of shared) await putPreview(page.get({ plain: true }) as PageLike, page.preview_key!)
    return pages.length
}

// Changes in a row (both fonts picked one after the other) are written once.
let timer: ReturnType<typeof setTimeout> | null = null
let running = false
let again = false

/** `republishAll` in a few seconds, in the background: what the back-office's settings call when they change. */
export function republishSoon(why: string): void {
    if (timer) clearTimeout(timer)
    timer = setTimeout(async () => {
        timer = null
        if (running) return void (again = true)
        running = true
        try {
            const count = await republishAll()
            console.log(`[ETHPageLeaf] ${why}: ${count} published page${count === 1 ? '' : 's'} written again`)
        } catch (err: any) {
            console.error(`[ETHPageLeaf] ${why}: the pages could not be written again:`, err?.message ?? err)
        } finally {
            running = false
            if (again) {
                again = false
                republishSoon(why)
            }
        }
    }, 3000)
}
