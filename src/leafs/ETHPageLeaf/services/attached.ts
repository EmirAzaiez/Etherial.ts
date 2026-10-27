import etherial from 'etherial'

import { Page } from '../models/Page.js'
import { normalizeLocalized, normalizePageBlocks } from './blocks.js'
import { PAGE_TYPE, PageError, PageFieldOptions, localesOf } from './options.js'
import { afterUpdate, prepareCreate, prepareUpdate } from './pages.js'
import { takeDownPage } from './publish.js'
import { state } from './state.js'

// ──────────────────────────────────────────────────────────────────────────
// A page that is the content of a record of another collection (a news):
// its blocks are written in that record's form, like a file in a media field,
// and it is saved, copied and deleted with the record. Its title is the
// record's. It is published as soon as it has blocks in the default language,
// is never in the app's menu nor in the back-office's Pages, and opens like
// any page from its link.
// ──────────────────────────────────────────────────────────────────────────

interface SaveContext {
    collection: string
    record: any | null
    data: Record<string, any>
}

function optionsOf(field: any): PageFieldOptions & { title: string } {
    return { title: 'title', ...(field?.page ?? {}) }
}

function valueOf(record: any, name: string): any {
    return record?.get ? record.get(name) : record?.[name]
}

/** The page the record owns; one it only points at (a page of the list) is never written from it. */
async function ownPage(record: any, name: string, collection: string): Promise<Page | null> {
    const id = valueOf(record, name)
    if (!id) return null
    const page = await Page.findByPk(id)
    return page?.owner === collection ? page : null
}

/** The blocks the form wrote: `{ blocks }`. Anything else (the id it loaded) leaves them as they are. */
function blocksIn(value: unknown): unknown {
    return value && typeof value === 'object' && !Array.isArray(value) && 'blocks' in value ? (value as any).blocks : undefined
}

/** A column of the record, when this save writes it. */
function written(data: Record<string, any>, name: string | undefined): unknown {
    return name && Object.prototype.hasOwnProperty.call(data, name) ? data[name] : undefined
}

/** Keys in order: the database gives a JSON column back with its keys sorted its own way. */
function stable(value: unknown): string {
    return JSON.stringify(value ?? {}, (_key, v) =>
        v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v
    )
}

const same = (a: unknown, b: unknown) => stable(a) === stable(b)

/**
 * The field's `beforeSave`: the page written with the record, its id for the
 * column. A record without a page gets one with its first block; the title
 * follows the record's. Only what changed is published again.
 */
export async function savePageField(value: unknown, field: any, context: SaveContext): Promise<number | null> {
    const options = optionsOf(field)
    const locales = localesOf(state.config)
    const current = valueOf(context.record, field.name) ?? null
    const page = await ownPage(context.record, field.name, context.collection)

    const rawBlocks = blocksIn(value)
    const blocks = rawBlocks === undefined ? undefined : normalizePageBlocks(rawBlocks, locales)
    const title = written(context.data, options.title)
    const summary = written(context.data, options.summary)
    // Compared before they are checked: the length limits are the save's to tell.
    const loose = (text: unknown, name: string) => normalizeLocalized(text, name, locales, Infinity)

    if (!page) {
        if (!blocks || !Object.values(blocks).some((list) => list.length)) return current
        const data = await prepareCreate({ title, summary, blocks, published: !!blocks[locales[0]]?.length })
        const created = await Page.create({ ...data, owner: context.collection, in_menu: false } as any)
        return created.id
    }

    const changes: Record<string, any> = {}
    if (title !== undefined && !same(loose(title, 'title'), page.title)) changes.title = title
    if (summary !== undefined && !same(loose(summary, 'summary'), page.summary)) changes.summary = summary
    if (blocks && !same(blocks, page.blocks)) {
        changes.blocks = blocks
        changes.published = !!blocks[locales[0]]?.length
    }
    if (!Object.keys(changes).length) return page.id

    await page.update(await prepareUpdate(page, changes))
    await afterUpdate(page)
    return page.id
}

/** The field's `duplicate`: the copy of a record gets a copy of its page, not a share of it. */
export async function copyPageField(value: unknown, field: any, context: SaveContext): Promise<number | null> {
    const page = await ownPage({ [field.name]: value }, field.name, context.collection)
    if (!page) return (value as number) ?? null
    const data = await prepareCreate({ title: page.title, summary: page.summary, blocks: page.blocks, published: page.published })
    const copy = await Page.create({ ...data, owner: context.collection, in_menu: false } as any)
    return copy.id
}

/** The field's `afterDelete`: the record's page goes with it, its HTML too. */
export async function deletePageField(value: unknown, field: any, context: { collection: string }): Promise<void> {
    const page = await ownPage({ [field.name]: value }, field.name, context.collection)
    if (!page) return
    await page.destroy()
    takeDownPage(page)
}

/**
 * The page of a record, for its form in the back-office: null when it has
 * none yet. Whoever may open the record may read it, Pages or not.
 */
export async function attachedPage(collectionName: string, id: string, fieldName: string) {
    const collection = (etherial as any).eth_admin_leaf?.getCollection(collectionName)
    const field = collection?.fields?.find((f: any) => f.name === fieldName && f.type === PAGE_TYPE)
    if (!field) throw new PageError('No page field there.', 404)
    const record = await collection.model.findByPk(id)
    if (!record) throw new PageError('Not found.', 404)
    const page = await ownPage(record, fieldName, collectionName)
    if (!page) return null
    return { id: page.id, slug: page.slug, blocks: page.blocks, published: page.published, html: page.html }
}
