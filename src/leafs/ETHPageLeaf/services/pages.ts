import { Op } from 'sequelize'

import { Page } from '../models/Page.js'
import { checkSlug, coverOf, normalizeHead, normalizeLocalized, normalizePageBlocks, slugify } from './blocks.js'
import { PageError, languageName, localesOf } from './options.js'
import { PageLike, publish, putPreview, takeDown } from './publish.js'
import { state } from './state.js'

// ──────────────────────────────────────────────────────────────────────────
// A page on its way to the table: checked, given an address, and published
// to the bucket before it is saved (see publish.ts).
// ──────────────────────────────────────────────────────────────────────────

const MAX_TITLE = 160
const MAX_SUMMARY = 300

/** What the HTML is made of: a write that touches none of it (the menu's order) leaves the bucket alone. */
const PUBLISHED_FIELDS = ['slug', 'title', 'summary', 'blocks', 'published', 'head', 'cover', 'logo']

/**
 * The old files of a page saved under a new address or unpublished, taken
 * down once the save went through. Keyed by the row: the save updates it in
 * place, so the after hook gets the same one (a bulk edit saves several).
 */
const staleFiles = new WeakMap<object, string[]>()

/** Pages with a preview link, written again once the save went through: the link shows the page as saved. */
const previewDue = new WeakSet<object>()

function has(data: Record<string, any>, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined
}

function bool(value: unknown): boolean {
    return value === true || value === 'true' || value === 1 || value === '1'
}

async function taken(slug: string, exceptId: number | null): Promise<boolean> {
    const where: any = { slug }
    if (exceptId) where.id = { [Op.ne]: exceptId }
    return !!(await Page.findOne({ where, attributes: ['id'] }))
}

/** `opening-hours`, else `opening-hours-2`, `-3`…: a duplicate gets an address of its own. */
async function freeSlug(slug: string): Promise<string> {
    if (!(await taken(slug, null))) return slug
    for (let n = 2; n < 100; n++) {
        const next = `${slug.slice(0, 76)}-${n}`
        if (!(await taken(next, null))) return next
    }
    throw new PageError(`Too many pages are at ${slug}: choose another address.`)
}

function checkPublishable(page: PageLike) {
    const fallback = localesOf(state.config)[0]
    if (!page.title?.[fallback]) throw new PageError(`Give the page a title in ${languageName(fallback)}.`)
    if (page.published && !page.blocks?.[fallback]?.length) {
        throw new PageError(`Add at least one block in ${languageName(fallback)} before publishing the page.`)
    }
}

export async function prepareCreate(data: Record<string, any>) {
    const locales = localesOf(state.config)
    // The leaf's own columns only come in with a duplicate (a form can't write
    // them): the copy is a draft, not a second page on the web.
    const duplicate = has(data, 'html') || has(data, 'published_slug')
    const title = normalizeLocalized(data.title, 'title', locales, MAX_TITLE)
    const summary = normalizeLocalized(data.summary, 'summary', locales, MAX_SUMMARY)
    const blocks = normalizePageBlocks(data.blocks, locales)
    const wanted = has(data, 'slug') && data.slug !== null && data.slug !== '' ? checkSlug(data.slug) : slugify(title[locales[0]] ?? '') || 'page'
    const slug = await freeSlug(wanted)
    const next: PageLike = { slug, title, summary, blocks, published: !duplicate && bool(data.published), head: normalizeHead(data.head), cover: coverOf(data.cover), logo: coverOf(data.logo) }
    checkPublishable(next)

    const { columns } = await publish(next, null)
    // A copy is not shared by the original's preview link.
    return { ...data, ...next, ...columns, preview_key: null }
}

export async function prepareUpdate(record: Page, data: Record<string, any>) {
    if (!PUBLISHED_FIELDS.some((key) => has(data, key))) return data

    const locales = localesOf(state.config)
    const out: Record<string, any> = { ...data }
    if (has(data, 'title')) out.title = normalizeLocalized(data.title, 'title', locales, MAX_TITLE)
    if (has(data, 'summary')) out.summary = normalizeLocalized(data.summary, 'summary', locales, MAX_SUMMARY)
    if (has(data, 'blocks')) out.blocks = normalizePageBlocks(data.blocks, locales)
    if (has(data, 'published')) out.published = bool(data.published)
    if (has(data, 'head')) out.head = normalizeHead(data.head)
    if (has(data, 'cover')) out.cover = coverOf(data.cover)
    if (has(data, 'logo')) out.logo = coverOf(data.logo)
    if (has(data, 'slug')) {
        out.slug = checkSlug(data.slug)
        if (out.slug !== record.slug && (await taken(out.slug, record.id))) throw new PageError(`Another page is already at ${out.slug}.`)
    }

    const previous = record.get({ plain: true }) as PageLike
    const next: PageLike = {
        slug: out.slug ?? previous.slug,
        title: out.title ?? previous.title,
        summary: out.summary ?? previous.summary,
        blocks: out.blocks ?? previous.blocks,
        published: out.published ?? previous.published,
        head: 'head' in out ? out.head : previous.head,
        cover: 'cover' in out ? out.cover : previous.cover,
        logo: 'logo' in out ? out.logo : previous.logo,
    }
    checkPublishable(next)

    const { columns, stale } = await publish(next, previous)
    if (stale.length) staleFiles.set(record, stale)
    if (record.preview_key) previewDue.add(record)
    return { ...out, ...columns }
}

/** After the save: the files of the old address go, the preview link shows the new version. */
export async function afterUpdate(saved: Page) {
    const stale = staleFiles.get(saved)
    if (stale) {
        staleFiles.delete(saved)
        takeDown(stale)
    }
    if (previewDue.has(saved)) {
        previewDue.delete(saved)
        // A bucket that refuses leaves the link on the version before: the save went through all the same.
        await putPreview(saved.get({ plain: true }) as PageLike, saved.preview_key!).catch((err) =>
            console.error('[ETHPageLeaf] A preview link could not be written again:', err?.message ?? err)
        )
    }
}
