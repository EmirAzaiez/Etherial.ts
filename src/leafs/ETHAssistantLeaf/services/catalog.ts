// ──────────────────────────────────────────────────────────────────────────
// What the assistant may read: the back-office collections the staff member
// can open, and in each, the plain fields the schema declares, with the
// sub-lists its form edits inline (a scheduler's openings, a page's gallery).
// Never a secure field, a password, a token, a JSON blob or a file — and
// never anything the schema does not name.
// ──────────────────────────────────────────────────────────────────────────

import etherial from 'etherial'

import { state } from './state.js'
import { REQUESTS_COLLECTION } from './options.js'

const adminLeaf = () => (etherial as any).eth_admin_leaf

/** Types read as they are: text, numbers, dates and times, choices, links to another record, a text in each language. */
const READABLE_TYPES = new Set([
    'string',
    'text',
    'richtext',
    'number',
    'integer',
    'boolean',
    'date',
    'datetime',
    'time',
    'email',
    'url',
    'phone',
    'select',
    'multiselect',
    'relation',
    'translations',
])
/** Items read per sub-list: past it, the count says how many more. */
export const MAX_ITEMS = 50
/** Name parts that give a secret away, whatever the schema says of the field. */
const SENSITIVE_PARTS = new Set(['password', 'passwd', 'pwd', 'secret', 'token', 'otp', 'hash', 'salt', 'cvv', 'pin'])

export interface ReadableField {
    name: string
    label: string
    type: string
    options?: { value: unknown; label: string }[]
    relation?: { collection: string; displayField: string }
    /** The back-office list can filter on it: a link can carry the filter. */
    listFilter: boolean
    /** A translations field's languages. */
    locales?: string[]
    /** Computed by the model, not a column: read, never filtered or sorted on. */
    virtual?: boolean
}

/**
 * A list the record's form edits inline — a hasMany: the items are rows of
 * another table, each pointing back at the record.
 */
export interface SubList {
    name: string
    label: string
    /** The items' collection, when they have one. */
    collection?: string
    model: any
    foreignKey: string
    orderField?: string
    /** How many items the form allows. */
    min?: number
    max?: number
    /** The item fields read: a many-to-many among them (`belongsToMany`) holds the ids it links to. */
    fields: ReadableField[]
    /** The item fields as the schema declares them: required, readonly, defaults. */
    definitions: any[]
}

export interface ReadableCollection {
    name: string
    label: string
    labelPlural: string
    description?: string
    model: any
    fields: ReadableField[]
    /** Fields the list's search box looks in. */
    search: string[]
    /** Fields shown by default when rows are listed. */
    listFields: string[]
    subLists: SubList[]
}

function isSensitive(name: string): boolean {
    const lower = name.toLowerCase()
    if (lower.includes('password') || lower.includes('api_key') || lower.includes('apikey')) return true
    return lower.split(/[^a-z0-9]+/).some((part) => SENSITIVE_PARTS.has(part))
}

function allowedByProject(name: string): boolean {
    if (name === REQUESTS_COLLECTION) return false
    const allow = state.config.collections
    if (!allow) return true
    return typeof allow === 'function' ? !!allow(name) : allow.includes(name)
}

const humanize = (name: string) => name.replace(/_id$/, '').replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

/** The declared fields a model holds and the assistant may read. */
function readableFields(definitions: any[], attributes: any, excluded: Set<string>, listFilters: Set<string>): ReadableField[] {
    const fields: ReadableField[] = []
    const seen = new Set<string>()
    for (const field of definitions) {
        if (!field?.name || seen.has(field.name) || !attributes[field.name]) continue
        if (field.secure || excluded.has(field.name) || isSensitive(field.name) || !READABLE_TYPES.has(field.type)) continue
        if (field.type === 'relation' && !field.relation?.collection) continue
        const locales: unknown = field.translations?.locales
        if (field.type === 'translations' && (!Array.isArray(locales) || !locales.length)) continue
        seen.add(field.name)
        fields.push({
            name: field.name,
            label: field.label || humanize(field.name),
            type: field.type,
            ...(field.options?.length ? { options: field.options.map((o: any) => ({ value: o.value, label: String(o.label ?? o.value) })) } : {}),
            ...(field.type === 'relation' ? { relation: { collection: field.relation.collection, displayField: field.relation.displayField || 'id' } } : {}),
            listFilter: listFilters.has(field.name),
            ...(field.type === 'translations' ? { locales: (locales as unknown[]).map(String) } : {}),
            ...(attributes[field.name]?.type?.key === 'VIRTUAL' ? { virtual: true } : {}),
        })
    }
    return fields
}

/**
 * A record's sub-lists, with their item fields resolved as the admin leaf
 * resolves them: the items' collection, narrowed to the names the hasMany
 * lists, or definitions given inline.
 */
function subListsOf(config: any): SubList[] {
    const out: SubList[] = []
    for (const field of config.fields ?? []) {
        const hm = field?.type === 'hasMany' ? field.hasMany : undefined
        if (!hm?.foreignKey || field.secure || isSensitive(field.name)) continue
        if ((state.config.excludeFields?.[config.name] ?? []).includes(field.name)) continue
        const child = hm.collection ? adminLeaf()?.getCollection(hm.collection) : undefined
        if (hm.collection && !allowedByProject(hm.collection)) continue
        const model = hm.model || child?.model
        const attributes = model?.rawAttributes
        if (!attributes) continue

        let definitions: any[] = child?.fields ?? []
        if (Array.isArray(hm.fields) && hm.fields.length) {
            definitions = typeof hm.fields[0] === 'string' ? definitions.filter((f: any) => hm.fields.includes(f.name)) : hm.fields
        }
        const orderField = hm.orderField
        const own = definitions.filter((f: any) => f?.name && f.name !== hm.foreignKey && f.name !== orderField)
        const excluded = new Set<string>(hm.collection ? state.config.excludeFields?.[hm.collection] ?? [] : [])
        const fields = readableFields(own, attributes, excluded, new Set())
        // An item's own many-to-many: the ids it links to, not a column.
        for (const def of own) {
            const link = def.type === 'belongsToMany' ? def.belongsToMany : undefined
            if (!link?.collection || link.pivotFields?.length || def.secure || excluded.has(def.name) || !model.associations?.[def.name]) continue
            fields.push({
                name: def.name,
                label: def.label || humanize(def.name),
                type: 'belongsToMany',
                relation: { collection: link.collection, displayField: link.displayField || 'id' },
                listFilter: false,
            })
        }
        if (!fields.length) continue
        out.push({
            name: field.name,
            label: field.label || humanize(field.name),
            ...(hm.collection ? { collection: hm.collection } : {}),
            model,
            foreignKey: hm.foreignKey,
            ...(orderField && attributes[orderField] ? { orderField } : {}),
            ...(typeof hm.min === 'number' ? { min: hm.min } : {}),
            ...(typeof hm.max === 'number' ? { max: hm.max } : {}),
            fields,
            definitions: own,
        })
    }
    return out
}

/** A collection's readable side, whoever asks; null when nothing in it may be read. */
export function readable(config: any): ReadableCollection | null {
    const model = config?.model
    const attributes = model?.rawAttributes
    if (!attributes || !allowedByProject(config.name)) return null

    const excluded = new Set<string>(state.config.excludeFields?.[config.name] ?? [])
    const listFilters = new Set<string>(config.views?.list?.filters ?? [])
    const fields = readableFields(config.fields ?? [], attributes, excluded, listFilters)
    const seen = new Set(fields.map((f) => f.name))
    // The id and the dates rows are stamped with: asked about all the time,
    // rarely declared.
    const stamps: [string, string, string][] = [
        ['id', 'ID', 'integer'],
        ['created_at', 'Created', 'datetime'],
        ['updated_at', 'Updated', 'datetime'],
    ]
    for (const [name, label, type] of stamps) {
        if (attributes[name] && !seen.has(name) && !excluded.has(name)) fields.push({ name, label, type, listFilter: listFilters.has(name) })
    }
    if (!fields.some((f) => f.name !== 'id')) return null

    const names = new Set(fields.map((f) => f.name))
    const listFields = (config.views?.list?.fields ?? []).filter((n: string) => names.has(n))
    return {
        name: config.name,
        label: config.meta?.label || humanize(config.name),
        labelPlural: config.meta?.labelPlural || config.meta?.label || humanize(config.name),
        description: config.meta?.description,
        model,
        fields,
        search: (config.views?.list?.search ?? []).filter((n: string) => names.has(n)),
        listFields: listFields.length ? listFields : fields.slice(0, 6).map((f) => f.name),
        subLists: subListsOf(config),
    }
}

/**
 * The collections this staff member may read through the assistant: listed
 * in the back-office, and open to their role the way a record page is.
 * Collections a role only looks up in pickers are left out.
 */
export async function collectionsFor(user: any): Promise<Map<string, ReadableCollection>> {
    const leaf = adminLeaf()
    const out = new Map<string, ReadableCollection>()
    for (const config of leaf?.collections ?? []) {
        if (config.crud && !config.crud.includes('list')) continue
        const collection = readable(config)
        if (!collection) continue
        if (!(await leaf.checkAccess(user, config.name, 'show'))) continue
        out.set(config.name, collection)
    }
    return out
}

/** One line per collection, for the assistant to know where to look. */
export function catalogText(collections: Map<string, ReadableCollection>): string {
    return [...collections.values()]
        .map((c) => `- ${c.name}: ${c.labelPlural}${c.description ? ` — ${c.description}` : ''}`)
        .join('\n')
}

function describeField(f: ReadableField, collections: Map<string, ReadableCollection>) {
    return {
        name: f.name,
        label: f.label,
        type: f.type,
        ...(f.options ? { values: f.options.map((o) => (String(o.value) === o.label ? o.value : `${o.value} (${o.label})`)) } : {}),
        ...(f.relation
            ? {
                  links_to: f.relation.collection,
                  // Its records are named, as in the list; opening them is another matter.
                  ...(collections.has(f.relation.collection) ? {} : { note: 'shown by name; that collection itself cannot be read' }),
              }
            : {}),
        ...(f.locales ? { languages: f.locales } : {}),
        ...(f.virtual || f.type === 'translations' ? { filterable: false } : {}),
    }
}

/** What describe_collection answers: enough to filter and group without guessing. */
export function describe(collection: ReadableCollection, collections: Map<string, ReadableCollection>) {
    return {
        collection: collection.name,
        label: collection.labelPlural,
        ...(collection.description ? { description: collection.description } : {}),
        searchable_text: collection.search.length ? collection.search : undefined,
        fields: collection.fields.map((f) => describeField(f, collections)),
        ...(collection.subLists.length
            ? {
                  // Read with the record (get_record), not filtered on.
                  sub_lists: collection.subLists.map((list) => ({
                      name: list.name,
                      label: list.label,
                      item_fields: list.fields.map((f) => describeField(f, collections)),
                  })),
              }
            : {}),
    }
}
