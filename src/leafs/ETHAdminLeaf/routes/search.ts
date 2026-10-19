import etherial from 'etherial'
import type { Request, Response } from 'express'
import { Op } from 'sequelize'
import { Controller, Get } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'

import type { CollectionConfig } from '../features/CollectionConfig.js'
import { isSecretColumn } from '../features/access.js'

const getAdminLeaf = () => (etherial as any).eth_admin_leaf

/** Column names that hold a credential even when the collection did not flag them `secure`. */
const SECRET_NAME = /pass(word)?|secret|token|otp|api_?key|hash/i

/** Where a record's name usually lives, in the order the back-office reads them. */
const TITLE_FIELDS = ['name', 'title', 'label', 'subject', 'full_name', 'real_name', 'email', 'message']
const NAME_PAIRS: [string, string][] = [['first_name', 'last_name'], ['firstname', 'lastname']]

/** Collections searched at once: enough to answer fast, few enough to leave the pool to everyone else. */
const CONCURRENCY = 6

interface SearchHit {
    id: string | number
    title: string
    subtitle?: string
}

/** A value as one line of text: translated fields (`{ en, ar }`) show their English, then whatever they have. */
function asText(value: unknown): string {
    if (value === null || value === undefined) {
        return ''
    }
    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>
        const first = obj.en ?? Object.values(obj).find((v) => typeof v === 'string' && v)
        return typeof first === 'string' ? first.trim() : ''
    }
    return String(value).replace(/\s+/g, ' ').trim()
}

/** Columns of the model the search may read: real columns, never a secret. */
function readableColumns(collection: CollectionConfig): Set<string> {
    const attributes = Object.keys(collection.model?.rawAttributes ?? {})
    const secure = new Set((collection.fields ?? []).filter((f) => f.secure).map((f) => f.name))
    return new Set(attributes.filter((name) => !secure.has(name) && !isSecretColumn(name) && !SECRET_NAME.test(name)))
}

function titleOf(row: Record<string, unknown>, searchFields: string[]): { title: string; from: string[] } {
    for (const name of TITLE_FIELDS) {
        const text = asText(row[name])
        if (text) {
            return { title: text, from: [name] }
        }
    }
    for (const [first, last] of NAME_PAIRS) {
        const text = [asText(row[first]), asText(row[last])].filter(Boolean).join(' ')
        if (text) {
            return { title: text, from: [first, last] }
        }
    }
    for (const name of searchFields) {
        const text = asText(row[name])
        if (text) {
            return { title: text, from: [name] }
        }
    }
    return { title: '', from: [] }
}

async function searchCollection(collection: CollectionConfig, q: string, limit: number): Promise<SearchHit[]> {
    const readable = readableColumns(collection)
    const searchFields = (collection.views?.list?.search ?? []).filter((f) => readable.has(f))
    if (searchFields.length === 0) {
        return []
    }

    const primaryKey = collection.model.primaryKeyAttribute || 'id'
    const titleColumns = [...TITLE_FIELDS, ...NAME_PAIRS.flat()].filter((f) => readable.has(f))
    const attributes = Array.from(new Set([primaryKey, ...titleColumns, ...searchFields]))

    const rows = await collection.model.findAll({
        where: { [Op.or]: searchFields.map((field) => ({ [field]: { [Op.iLike]: `%${q}%` } })) },
        attributes,
        order: [[primaryKey, 'DESC']],
        limit,
        raw: true,
    })

    return rows.map((row: Record<string, unknown>) => {
        const { title, from } = titleOf(row, searchFields)
        // The field that matched, when it is not the title already: how one
        // tells two "John Smith" apart, and why a record came up at all.
        const needle = q.toLowerCase()
        const matched = searchFields.find((f) => !from.includes(f) && asText(row[f]).toLowerCase().includes(needle))
        const subtitle = matched ? asText(row[matched]) : undefined
        const id = row[primaryKey] as string | number
        return { id, title: title || `#${id}`, ...(subtitle && subtitle !== title ? { subtitle } : {}) }
    })
}

/** `fn` over `list`, `size` at a time, in order. */
async function mapPool<T, R>(list: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const out: R[] = new Array(list.length)
    let next = 0
    const worker = async () => {
        while (next < list.length) {
            const i = next++
            out[i] = await fn(list[i])
        }
    }
    await Promise.all(Array.from({ length: Math.min(size, list.length) }, worker))
    return out
}

@Controller()
export default class ETHAdminSearchController {
    /**
     * GET /admin/search?q=&limit=5
     *
     * One query over every collection the user may list whose list view
     * declares `search`, for the command palette: `{ results: [{ collection,
     * label, items: [{ id, title, subtitle? }] }] }`, collections with a match
     * only, in menu registration order. Secrets are neither searched nor sent.
     */
    @Get('/admin/search')
    @ShouldBeAuthenticated()
    async search(req: Request & { user: any }, res: Response): Promise<any> {
        const adminLeaf = getAdminLeaf()
        if (!adminLeaf || !(await adminLeaf.canAccessAdmin(req.user))) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : ''
        if (!q) {
            return (res as any).success?.({ status: 200, data: { results: [] } })
        }
        const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 20)

        const candidates = (adminLeaf.collections as CollectionConfig[]).filter(
            (c) => c.crud?.includes('list') && (c.views?.list?.search?.length ?? 0) > 0
        )
        const allowed = await Promise.all(candidates.map((c) => adminLeaf.checkAccess(req.user, c.name, 'list')))
        const searchable = candidates.filter((_, i) => allowed[i])

        const found = await mapPool(searchable, CONCURRENCY, async (collection) => {
            try {
                return await searchCollection(collection, q, limit)
            } catch (err: any) {
                // One collection whose search columns cannot be matched as text
                // (a JSON column…) must not take the whole palette down with it.
                console.error(`[ETHAdminLeaf] Global search error for ${collection.name}:`, err?.message ?? err)
                return []
            }
        })

        const results = searchable
            .map((collection, i) => ({
                collection: collection.name,
                label: collection.meta?.labelPlural || collection.meta?.label || collection.name,
                items: found[i],
            }))
            .filter((group) => group.items.length > 0)

        return (res as any).success?.({ status: 200, data: { results } })
    }
}

export const AvailableRouteMethods = ['search'] as const
