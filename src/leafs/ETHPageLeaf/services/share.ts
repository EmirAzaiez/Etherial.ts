import crypto from 'node:crypto'

import { Page } from '../models/Page.js'
import { COLLECTION, PageError } from './options.js'
import { PageLike, previewKeyOf, publicBase, putPreview, retirePreview, writtenLocales } from './publish.js'

// ──────────────────────────────────────────────────────────────────────────
// A page's preview link: for people to read a draft before it is on the web.
// Its files are in the bucket (see publish.ts), written again on each save of
// the page: the link always shows it as last saved. Stopping it ends the
// link; a new one is another key.
// ──────────────────────────────────────────────────────────────────────────

/** How a page is shared, for the back-office. */
export interface PageLinks {
    published: boolean
    /** Its HTML in the bucket, language by language: the public links, once published. */
    web: Record<string, string>
    /** Its preview link in each language it is written in; null while it has none. */
    preview: Record<string, string> | null
}

/** The page asked for, with the collection whose rights apply to it: the news it is the content of, else the Pages. */
export async function pageToShare(id: unknown): Promise<{ page: Page | null; collection: string }> {
    const page = /^\d+$/.test(String(id)) ? await Page.findByPk(Number(id)) : null
    return { page, collection: page?.owner ?? COLLECTION }
}

export function linksOf(page: Page | null): PageLinks {
    if (!page) throw new PageError('Not found.', 404)
    const key = page.preview_key
    return {
        published: page.published,
        web: page.published ? { ...(page.html ?? {}) } : {},
        preview: key ? Object.fromEntries(writtenLocales(page.blocks).map((l) => [l, `${publicBase()}/${previewKeyOf(key, l)}`])) : null,
    }
}

/** A bucket that refuses: the link is not made, or not stopped. */
async function inBucket(write: () => Promise<void>, what: string) {
    try {
        await write()
    } catch (err: any) {
        if (err instanceof PageError) throw err
        console.error(`[ETHPageLeaf] ${what}:`, err?.message ?? err)
        throw new PageError(`${what}: the bucket did not take it. Try again.`, 502)
    }
}

/**
 * The page's preview link: made the first time, the same one after. Its files
 * are written again on each click, so one lost in the bucket comes back.
 * `silent`: sharing is not an edit of the page.
 */
export async function startPreview(page: Page | null): Promise<PageLinks> {
    if (!page) return linksOf(page)
    const key = page.preview_key ?? crypto.randomBytes(18).toString('base64url')
    await inBucket(() => putPreview(page.get({ plain: true }) as PageLike, key), 'The preview link could not be made')
    if (!page.preview_key) await page.update({ preview_key: key }, { silent: true })
    return linksOf(page)
}

/** Its preview link stopped: whoever has it gets "This link no longer works". The files first: a link still showing the page is not stopped. */
export async function stopPreview(page: Page | null): Promise<PageLinks> {
    if (page?.preview_key) {
        await inBucket(() => retirePreview(page.preview_key!), 'The preview link could not be stopped')
        await page.update({ preview_key: null }, { silent: true })
    }
    return linksOf(page)
}
