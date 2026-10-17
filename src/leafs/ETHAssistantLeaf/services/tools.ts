// ──────────────────────────────────────────────────────────────────────────
// The look-ups the assistant may make: describe a collection, count its
// records (by group, by day or month), list them, open one. Read-only, run as
// the staff member, on the fields `catalog.ts` lets through. Each answer says
// where to see the same thing in the back-office.
//
// Days are cut the way the back-office lists cut them, in the database's time
// zone, so that "42 bookings" here is 42 rows behind the link.
// ──────────────────────────────────────────────────────────────────────────

import etherial from 'etherial'
import { Op, fn, literal } from 'sequelize'

import type { ToolDefinition } from './anthropic.js'
import { ReadableCollection, ReadableField, describe, readable } from './catalog.js'
import { state } from './state.js'
import { timezoneOf } from './options.js'

const DAY = /^\d{4}-\d{2}-\d{2}$/
const OPS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'contains', 'is_null', 'not_null'] as const
const BUCKETS = ['day', 'week', 'month', 'year'] as const
const TEXT_TYPES = new Set(['string', 'text', 'email', 'url', 'phone'])
const MAX_ROWS = 25
const MAX_GROUPS = 40
/** What one look-up may hand back, in characters: past it, rows are dropped. */
const MAX_RESULT = 24_000

type FilterOp = (typeof OPS)[number]
type Bucket = (typeof BUCKETS)[number]

export interface Filter {
    field: string
    op?: FilterOp
    value?: unknown
}

/** A look-up that cannot run as asked: told to the assistant, which tries again. */
export class ToolError extends Error {}

/** What the back-office shows under the answer, one per look-up. */
export interface Step {
    tool: string
    label: string
    collection?: string
    count?: number
    link?: string
}

export interface ToolContext {
    user: any
    collections: Map<string, ReadableCollection>
    /** Collections read, for the log. */
    read: Set<string>
}

// ── Definitions ─────────────────────────────────────────────────────────────

const FILTERS_SCHEMA = {
    type: 'array',
    description:
        'All must match. Dates as YYYY-MM-DD are whole days: lte 2026-10-31 includes the 31st. Select fields take their value, not their label.',
    items: {
        type: 'object',
        properties: {
            field: { type: 'string' },
            op: { type: 'string', enum: [...OPS], description: 'Default eq. contains: text containing the value. in: value is a list.' },
            value: { description: 'Omitted for is_null and not_null.' },
        },
        required: ['field'],
    },
}

export const TOOLS: ToolDefinition[] = [
    {
        name: 'describe_collection',
        description: 'The fields of a collection: names, types, the values a choice can take, the collection a link points to. Call it before filtering a collection for the first time.',
        input_schema: {
            type: 'object',
            properties: { collection: { type: 'string', description: 'Its key, from the list of collections.' } },
            required: ['collection'],
        },
    },
    {
        name: 'count_records',
        description:
            'How many records match, optionally broken down by a field (a status, a type, a project) or by period of a date field. Use it for every "how many" question rather than listing rows.',
        input_schema: {
            type: 'object',
            properties: {
                collection: { type: 'string' },
                filters: FILTERS_SCHEMA,
                search: { type: 'string', description: "Text looked for in the collection's searchable fields, like the list's search box." },
                group_by: { type: 'string', description: 'A field to break the count down by.' },
                period: { type: 'string', enum: [...BUCKETS], description: 'With a date field in group_by: count per day, week (from Monday), month or year.' },
            },
            required: ['collection'],
        },
    },
    {
        name: 'query_records',
        description: `Records that match, with their total. At most ${MAX_ROWS} rows: to know how many, use count_records.`,
        input_schema: {
            type: 'object',
            properties: {
                collection: { type: 'string' },
                filters: FILTERS_SCHEMA,
                search: { type: 'string', description: "Text looked for in the collection's searchable fields." },
                sort: {
                    type: 'object',
                    properties: { field: { type: 'string' }, direction: { type: 'string', enum: ['asc', 'desc'] } },
                    required: ['field'],
                },
                limit: { type: 'integer', minimum: 1, maximum: MAX_ROWS, description: 'Default 10.' },
                fields: { type: 'array', items: { type: 'string' }, description: "The fields to return. Default: the list's columns." },
            },
            required: ['collection'],
        },
    },
    {
        name: 'get_record',
        description: 'One record, every readable field.',
        input_schema: {
            type: 'object',
            properties: { collection: { type: 'string' }, id: { description: 'Its id.' } },
            required: ['collection', 'id'],
        },
    },
]

// ── Running a look-up ───────────────────────────────────────────────────────

export async function runTool(name: string, input: any, context: ToolContext): Promise<{ result: unknown; step: Step }> {
    const collection = collectionOf(input?.collection, context)
    context.read.add(collection.name)
    switch (name) {
        case 'describe_collection':
            return {
                result: describe(collection, context.collections),
                step: { tool: name, label: `Read the fields of ${collection.labelPlural}`, collection: collection.name },
            }
        case 'count_records':
            return count(collection, input)
        case 'query_records':
            return query(collection, input)
        case 'get_record':
            return getRecord(collection, input?.id)
        default:
            throw new ToolError(`Unknown tool ${name}`)
    }
}

function collectionOf(name: unknown, context: ToolContext): ReadableCollection {
    const collection = typeof name === 'string' ? context.collections.get(name) : undefined
    if (!collection) throw new ToolError(`No readable collection "${String(name)}". Use a key from the list of collections.`)
    return collection
}

function fieldOf(collection: ReadableCollection, name: unknown): ReadableField {
    const field = collection.fields.find((f) => f.name === name)
    if (!field) throw new ToolError(`${collection.name} has no readable field "${String(name)}". Call describe_collection.`)
    return field
}

const sequelize = () => (etherial as any).database?.sequelize
const isPostgres = () => sequelize()?.getDialect?.() === 'postgres'
const columnOf = (collection: ReadableCollection, name: string): string => collection.model.rawAttributes?.[name]?.field || name

function shiftDay(day: string, days: number): string {
    const date = new Date(`${day}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + days)
    return date.toISOString().slice(0, 10)
}

/** A value as the column holds it; a choice may be named by its label. */
function coerce(field: ReadableField, value: unknown): unknown {
    if (value === null || value === undefined) throw new ToolError(`A value is needed for ${field.name}`)
    switch (field.type) {
        case 'integer':
        case 'number': {
            const n = Number(value)
            if (!Number.isFinite(n)) throw new ToolError(`${field.name} is a number, not "${String(value)}"`)
            return n
        }
        case 'boolean':
            if (value === true || value === 'true' || value === 1 || value === '1') return true
            if (value === false || value === 'false' || value === 0 || value === '0') return false
            throw new ToolError(`${field.name} is true or false`)
        case 'date':
        case 'datetime': {
            const s = String(value)
            if (!DAY.test(s) && Number.isNaN(Date.parse(s))) throw new ToolError(`${field.name} takes a date (YYYY-MM-DD), not "${s}"`)
            return s
        }
        case 'select': {
            const options = field.options ?? []
            const match =
                options.find((o) => String(o.value) === String(value)) ??
                options.find((o) => o.label.toLowerCase() === String(value).toLowerCase())
            if (!match && options.length) {
                throw new ToolError(`${field.name} is one of: ${options.map((o) => String(o.value)).join(', ')}`)
            }
            return match ? match.value : value
        }
        case 'relation': {
            const n = Number(value)
            return Number.isInteger(n) && String(value).trim() !== '' ? n : String(value)
        }
        default:
            return String(value)
    }
}

/** Sequelize's where for the filters and the search; dates by the day are whole days. */
function whereOf(collection: ReadableCollection, filters: Filter[] = [], search?: string): any {
    if (!Array.isArray(filters)) throw new ToolError('filters is a list')
    const like = isPostgres() ? Op.iLike : Op.like
    const and: any[] = []
    for (const filter of filters) {
        const field = fieldOf(collection, filter?.field)
        const op: FilterOp = filter.op ?? 'eq'
        if (!OPS.includes(op)) throw new ToolError(`Unknown op "${op}"`)
        const name = field.name
        const isDate = field.type === 'date' || field.type === 'datetime'
        const day = isDate && typeof filter.value === 'string' && DAY.test(filter.value) ? filter.value : null
        switch (op) {
            case 'is_null':
                and.push({ [name]: { [Op.is]: null } })
                break
            case 'not_null':
                and.push({ [name]: { [Op.not]: null } })
                break
            case 'in': {
                const values = Array.isArray(filter.value) ? filter.value : String(filter.value ?? '').split(',')
                if (!values.length) throw new ToolError('in takes a list of values')
                and.push({ [name]: { [Op.in]: values.slice(0, 200).map((v) => coerce(field, typeof v === 'string' ? v.trim() : v)) } })
                break
            }
            case 'contains':
                if (!TEXT_TYPES.has(field.type)) throw new ToolError(`contains works on text, and ${name} is ${field.type}`)
                and.push({ [name]: { [like]: `%${String(filter.value ?? '').replace(/[\\%_]/g, (c) => `\\${c}`)}%` } })
                break
            case 'eq':
                if (day && field.type === 'datetime') and.push({ [name]: { [Op.gte]: day, [Op.lt]: shiftDay(day, 1) } })
                else and.push({ [name]: coerce(field, filter.value) })
                break
            case 'ne':
                and.push({ [name]: { [Op.ne]: coerce(field, filter.value) } })
                break
            case 'gt':
                and.push(day && field.type === 'datetime' ? { [name]: { [Op.gte]: shiftDay(day, 1) } } : { [name]: { [Op.gt]: coerce(field, filter.value) } })
                break
            case 'lte':
                and.push(day && field.type === 'datetime' ? { [name]: { [Op.lt]: shiftDay(day, 1) } } : { [name]: { [Op.lte]: coerce(field, filter.value) } })
                break
            case 'gte':
                and.push({ [name]: { [Op.gte]: coerce(field, filter.value) } })
                break
            case 'lt':
                and.push({ [name]: { [Op.lt]: coerce(field, filter.value) } })
                break
        }
    }
    if (search) {
        if (!collection.search.length) throw new ToolError(`${collection.name} has no text search: filter a field with contains`)
        // As the list's search box does it, so the link finds the same rows.
        and.push({ [Op.or]: collection.search.map((name) => ({ [name]: { [like]: `%${search}%` } })) })
    }
    return and.length ? { [Op.and]: and } : {}
}

/**
 * The back-office list showing the same rows, when its filters can say it:
 * only fields the list filters on, equality on a choice, ranges of whole days
 * or of numbers. Anything else: no link rather than a wrong one.
 */
function linkOf(collection: ReadableCollection, filters: Filter[] = [], search?: string): string | undefined {
    if (search && !collection.search.length) return undefined
    const out: Record<string, any> = {}
    for (const filter of filters) {
        const field = collection.fields.find((f) => f.name === filter?.field)
        if (!field?.listFilter) return undefined
        const op = filter.op ?? 'eq'
        if (field.type === 'date' || field.type === 'datetime') {
            const value = String(filter.value ?? '')
            if (!DAY.test(value)) return undefined
            const range = out[field.name] ?? {}
            if (op === 'gte') range.from = value
            else if (op === 'gt') range.from = shiftDay(value, 1)
            else if (op === 'lte') range.to = value
            else if (op === 'lt') range.to = shiftDay(value, -1)
            else if (op === 'eq') Object.assign(range, { from: value, to: value })
            else return undefined
            out[field.name] = range
        } else if (field.type === 'integer' || field.type === 'number') {
            const value = Number(filter.value)
            if (!Number.isFinite(value)) return undefined
            const range = out[field.name] ?? {}
            const whole = field.type === 'integer' && Number.isInteger(value)
            if (op === 'gte') range.min = value
            else if (op === 'lte') range.max = value
            else if (op === 'gt' && whole) range.min = value + 1
            else if (op === 'lt' && whole) range.max = value - 1
            else if (op === 'eq') Object.assign(range, { min: value, max: value })
            else return undefined
            out[field.name] = range
        } else if (op === 'eq' && field.type !== 'multiselect') {
            if (field.name in out) return undefined
            try {
                out[field.name] = coerce(field, filter.value)
            } catch {
                return undefined
            }
        } else {
            return undefined
        }
    }
    for (const range of Object.values(out)) {
        if (range && typeof range === 'object' && range.from && range.to && range.from > range.to) return undefined
    }
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (Object.keys(out).length) params.set('filters', JSON.stringify(out))
    const qs = params.toString()
    return `/${collection.name}${qs ? `?${qs}` : ''}`
}

// ── Values as the assistant reads them ──────────────────────────────────────

function formatDate(value: unknown, withTime: boolean): string | null {
    if (value === null || value === undefined || value === '') return null
    const date = value instanceof Date ? value : new Date(String(value))
    if (Number.isNaN(date.getTime())) return String(value)
    if (!withTime) return typeof value === 'string' && DAY.test(value) ? value : date.toISOString().slice(0, 10)
    // In the project's zone: "the visit is at 10:00" means 10:00 there.
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezoneOf(state.config),
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date)
    const get = (type: string) => parts.find((p) => p.type === type)?.value
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

/** The names of the records a link field points to: one query per field. */
async function relationLabels(field: ReadableField, ids: unknown[]): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    const unique = [...new Set(ids.filter((id) => id !== null && id !== undefined && id !== ''))]
    if (!unique.length || !field.relation) return out
    // Named as the back-office names it, unless the project keeps that collection
    // from the assistant or the name is itself not for reading.
    const target = readable((etherial as any).eth_admin_leaf?.getCollection(field.relation.collection))
    const display = field.relation.displayField
    if (!target || !target.fields.some((f) => f.name === display)) return out
    const pk = target.model.primaryKeyAttribute || 'id'
    try {
        const rows = await target.model.findAll({ where: { [pk]: unique }, attributes: [pk, display], raw: true })
        for (const row of rows) if (row[display] !== null && row[display] !== undefined) out.set(String(row[pk]), String(row[display]))
    } catch {
        // A name we cannot read is shown as its id.
    }
    return out
}

async function present(collection: ReadableCollection, records: any[], names: string[], textLimit: number): Promise<Record<string, unknown>[]> {
    const fields = names.map((n) => fieldOf(collection, n))
    const plain = records.map((r) => (r?.get ? r.get({ plain: true }) : r))
    const labels = new Map<string, Map<string, string>>()
    for (const field of fields) {
        if (field.type === 'relation') labels.set(field.name, await relationLabels(field, plain.map((r) => r[field.name])))
    }
    return plain.map((row) => {
        const out: Record<string, unknown> = {}
        for (const field of fields) {
            const value = row[field.name]
            if (value === null || value === undefined || value === '') {
                out[field.name] = null
                continue
            }
            switch (field.type) {
                case 'datetime':
                    out[field.name] = formatDate(value, true)
                    break
                case 'date':
                    out[field.name] = formatDate(value, false)
                    break
                case 'select': {
                    const option = field.options?.find((o) => String(o.value) === String(value))
                    out[field.name] = option && option.label !== String(value) ? `${value} (${option.label})` : value
                    break
                }
                case 'relation': {
                    const label = labels.get(field.name)?.get(String(value))
                    out[field.name] = label ? `${label} (#${value})` : `#${value}`
                    break
                }
                case 'text':
                case 'string': {
                    const s = String(value)
                    out[field.name] = s.length > textLimit ? `${s.slice(0, textLimit)}…` : s
                    break
                }
                default:
                    out[field.name] = typeof value === 'object' ? JSON.stringify(value).slice(0, textLimit) : value
            }
        }
        return out
    })
}

// ── The look-ups ────────────────────────────────────────────────────────────

async function count(collection: ReadableCollection, input: any): Promise<{ result: unknown; step: Step }> {
    const where = whereOf(collection, input?.filters, input?.search)
    const link = linkOf(collection, input?.filters, input?.search)
    const total: number = await collection.model.count({ where })
    const step: Step = { tool: 'count_records', label: `Counted ${collection.labelPlural}`, collection: collection.name, count: total, link }
    if (!input?.group_by) return { result: { total, ...(link ? { link } : {}) }, step }

    const field = fieldOf(collection, input.group_by)
    const column = columnOf(collection, field.name)
    const quoted = sequelize().getQueryInterface().quoteIdentifier(column)
    step.label = `Counted ${collection.labelPlural} by ${field.label.toLowerCase()}`

    if (field.type === 'date' || field.type === 'datetime') {
        if (!isPostgres()) throw new ToolError('Counting by period needs Postgres')
        const period: Bucket = BUCKETS.includes(input.period) ? input.period : 'month'
        const rows: any[] = await collection.model.findAll({
            attributes: [
                [literal(`to_char(date_trunc('${period}', ${quoted}), 'YYYY-MM-DD')`), 'bucket'],
                [fn('COUNT', literal('*')), 'count'],
            ],
            where: { [Op.and]: [where, { [field.name]: { [Op.not]: null } }] },
            group: [literal('1') as any],
            order: [[literal('1') as any, 'ASC']],
            raw: true,
        })
        const kept = rows.slice(-120)
        const groups = kept.map((row) => {
            const from: string = row.bucket
            const to = period === 'day' ? from : period === 'week' ? shiftDay(from, 6) : period === 'month' ? lastOfMonth(from) : `${from.slice(0, 4)}-12-31`
            const value = period === 'month' ? from.slice(0, 7) : period === 'year' ? from.slice(0, 4) : from
            const groupLink = linkOf(collection, [...(input.filters ?? []), { field: field.name, op: 'gte', value: from }, { field: field.name, op: 'lte', value: to }], input.search)
            return { [period]: value, count: Number(row.count), ...(groupLink ? { link: groupLink } : {}) }
        })
        return { result: { total, period, groups, ...(rows.length > kept.length ? { note: `only the last ${kept.length} periods` } : {}), ...(link ? { link } : {}) }, step }
    }

    if (field.type === 'multiselect') throw new ToolError(`${field.name} holds several values: count with a contains filter instead`)
    const rows: any[] = await collection.model.findAll({
        attributes: [
            [literal(quoted), 'value'],
            [fn('COUNT', literal('*')), 'count'],
        ],
        where,
        group: [literal(quoted) as any],
        order: [[literal('2') as any, 'DESC']],
        limit: MAX_GROUPS,
        raw: true,
    })
    const labels = field.type === 'relation' ? await relationLabels(field, rows.map((r) => r.value)) : null
    const groups = rows.map((row) => {
        const value = row.value
        const option = field.options?.find((o) => String(o.value) === String(value))
        const label = value === null ? '(empty)' : (option?.label ?? labels?.get(String(value)) ?? undefined)
        const groupLink = value === null ? undefined : linkOf(collection, [...(input.filters ?? []), { field: field.name, op: 'eq', value }], input.search)
        return { value, ...(label !== undefined && String(label) !== String(value) ? { label } : {}), count: Number(row.count), ...(groupLink ? { link: groupLink } : {}) }
    })
    const shown = groups.reduce((sum, g) => sum + g.count, 0)
    return {
        result: { total, groups, ...(shown < total ? { others: total - shown } : {}), ...(link ? { link } : {}) },
        step,
    }
}

function lastOfMonth(first: string): string {
    const date = new Date(`${first}T00:00:00Z`)
    date.setUTCMonth(date.getUTCMonth() + 1, 0)
    return date.toISOString().slice(0, 10)
}

async function query(collection: ReadableCollection, input: any): Promise<{ result: unknown; step: Step }> {
    const where = whereOf(collection, input?.filters, input?.search)
    const link = linkOf(collection, input?.filters, input?.search)
    const limit = Math.min(Math.max(Number(input?.limit) || 10, 1), MAX_ROWS)
    const asked: string[] = Array.isArray(input?.fields) && input.fields.length ? input.fields : collection.listFields
    const pk: string = collection.model.primaryKeyAttribute || 'id'
    const names = [...new Set(asked.map((n) => fieldOf(collection, n).name))]
    const pkReadable = collection.fields.some((f) => f.name === pk)
    if (pkReadable && !names.includes(pk)) names.unshift(pk)

    let order: [string, string][]
    if (input?.sort?.field) {
        order = [[fieldOf(collection, input.sort.field).name, input.sort.direction === 'asc' ? 'ASC' : 'DESC']]
    } else {
        const attributes = collection.model.rawAttributes
        order = attributes.created_at ? [['created_at', 'DESC']] : [[pk, 'DESC']]
    }

    const [total, records] = await Promise.all([
        collection.model.count({ where }),
        collection.model.findAll({ where, attributes: [...new Set([pk, ...names])], order, limit }),
    ])
    let rows = await present(collection, records, names, 300)
    if (!pkReadable) rows = rows.map((row, i) => ({ [pk]: records[i].get(pk), ...row }))
    // Past the budget, the last rows go: the total still says how many there are.
    while (rows.length > 1 && JSON.stringify(rows).length > MAX_RESULT) rows = rows.slice(0, Math.ceil(rows.length * 0.7))
    return {
        result: { total, returned: rows.length, rows, ...(link ? { link } : {}) },
        step: { tool: 'query_records', label: `Looked through ${collection.labelPlural}`, collection: collection.name, count: total, link },
    }
}

/** One record, every readable field; null when it is not there. */
export async function readRecord(collection: ReadableCollection, id: unknown, textLimit = 2000): Promise<Record<string, unknown> | null> {
    if (id === null || id === undefined || id === '') return null
    const pk: string = collection.model.primaryKeyAttribute || 'id'
    const pkType = String(collection.model.rawAttributes?.[pk]?.type?.key ?? '')
    if (/INT/.test(pkType) && !/^\d+$/.test(String(id))) throw new ToolError(`An id of ${collection.name} is a whole number, not "${String(id)}"`)
    const record = await collection.model.findOne({
        where: { [pk]: id },
        attributes: [...new Set([pk, ...collection.fields.map((f) => f.name)])],
    })
    if (!record) return null
    const [row] = await present(collection, [record], collection.fields.map((f) => f.name), textLimit)
    return collection.fields.some((f) => f.name === pk) ? row : { [pk]: record.get(pk), ...row }
}

async function getRecord(collection: ReadableCollection, id: unknown): Promise<{ result: unknown; step: Step }> {
    const record = await readRecord(collection, id)
    if (!record) throw new ToolError(`No ${collection.label.toLowerCase()} #${String(id)}`)
    const link = `/${collection.name}/${encodeURIComponent(String(id))}`
    return {
        result: { record, link },
        step: { tool: 'get_record', label: `Opened ${collection.label} #${String(id)}`, collection: collection.name, link },
    }
}
