// ──────────────────────────────────────────────────────────────────────────
// The bridge to ETHAdminLeaf.
//
// Every project that runs the admin panel has already described its domain
// once: which models are exposed, what their fields are called, which of them
// point at another collection. That description is exactly what an automation
// builder needs, so this leaf reads it rather than asking for it again.
//
// The practical consequence: register a collection in the back-office and it
// becomes automatable — triggers, record fields, relation walking and all —
// without a line of flow-specific code.
// ──────────────────────────────────────────────────────────────────────────

import etherial from 'etherial'

import type { CollectionConfig } from '../../ETHAdminLeaf/features/CollectionConfig.js'
import type { FieldDefinition } from '../../ETHAdminLeaf/features/ActionRegistry.js'
import type { OutputField } from '../types.js'

/** The admin leaf, or null when the project runs without one. */
export function adminLeaf(): any | null {
    return (etherial as any).eth_admin_leaf ?? null
}

export function listCollections(): CollectionConfig[] {
    const leaf = adminLeaf()
    if (!leaf) return []
    return leaf.collections ?? []
}

export function getCollection(name: string): CollectionConfig | null {
    const leaf = adminLeaf()
    if (!leaf) return null
    return leaf.getCollection?.(name) ?? null
}

/** The Sequelize model behind a collection. */
export function getModel(name: string): any | null {
    const collection = getCollection(name)
    return collection?.model ?? null
}

export function collectionLabel(collection: CollectionConfig): string {
    return collection.meta?.label || humanize(collection.name)
}

export function collectionLabelPlural(collection: CollectionConfig): string {
    return collection.meta?.labelPlural || collectionLabel(collection)
}

export function humanize(value: string): string {
    return value
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, (c) => c.toUpperCase())
        .trim()
}

// ─── Field mapping ────────────────────────────────────────────────────────

const TYPE_MAP: Record<string, OutputField['type']> = {
    string: 'string',
    text: 'string',
    email: 'string',
    url: 'string',
    phone: 'string',
    select: 'string',
    number: 'number',
    integer: 'number',
    boolean: 'boolean',
    date: 'date',
    datetime: 'date',
    json: 'object',
    media: 'object',
    image: 'object',
    file: 'object',
    array: 'array',
    multiselect: 'array',
}

function outputType(field: FieldDefinition): OutputField['type'] {
    if (field.type === 'relation') return 'number'
    return TYPE_MAP[field.type as string] ?? 'string'
}

/**
 * Fields a collection's records expose to templates.
 *
 * Relations are walked one level: `{{record.customer.email}}` is the single
 * most useful thing an automation ever asks for — you notify the person
 * attached to the thing that happened, not the thing itself — and stopping at
 * one level keeps the picker finite on a schema where everything eventually
 * points at everything.
 *
 * `hasMany` and `belongsToMany` are left out: they are not on the instance, and
 * a step that needs the children has `data.find` for it.
 */
export function collectionOutputFields(name: string, depth = 1): OutputField[] {
    const collection = getCollection(name)
    if (!collection) return []

    const fields: OutputField[] = [{ key: 'id', label: 'ID', type: 'number' }]

    for (const field of collection.fields ?? []) {
        if (field.type === 'hasMany' || field.type === 'belongsToMany') continue

        const entry: OutputField = {
            key: field.name,
            label: field.label || humanize(field.name),
            type: outputType(field),
        }

        if (field.type === 'relation' && field.relation?.collection) {
            entry.collection = field.relation.collection
            if (depth > 0) {
                // The related record hangs off the foreign key itself, so
                // `{{record.customer_id.email}}` would be the honest path — and
                // nobody would ever write it. The relation is therefore also
                // exposed under its bare name.
                const related = collectionOutputFields(field.relation.collection, depth - 1)
                if (related.length > 0) {
                    fields.push({
                        key: relationKey(field.name),
                        label: field.label || humanize(field.name),
                        type: 'object',
                        collection: field.relation.collection,
                        fields: related,
                    })
                }
            }
        }

        fields.push(entry)
    }

    fields.push(
        { key: 'created_at', label: 'Created at', type: 'date' },
        { key: 'updated_at', label: 'Updated at', type: 'date' }
    )

    // `id` and the timestamps are added whether or not the collection declares
    // them; a collection that does would otherwise offer each of them twice in
    // every picker, with no way to tell the two entries apart.
    const seen = new Set<string>()
    return fields.filter((field) => {
        if (seen.has(field.key)) return false
        seen.add(field.key)
        return true
    })
}

/** `customer_id` → `customer`; anything else is left alone. */
export function relationKey(fieldName: string): string {
    return fieldName.endsWith('_id') ? fieldName.slice(0, -3) : `${fieldName}_record`
}

/**
 * The dates of a collection, as options for a picker.
 *
 * Two sources, and the second one matters: a project is free to give a date
 * column a form widget of its own — DARWAEMAR fills `appointments.starts_at`
 * with a slot picker rather than a calendar — and reading the admin `type`
 * alone would hide the single most useful date in the schema behind the fact
 * that it is entered in an unusual way. The column's own Sequelize type is the
 * honest answer, so the declared fields are completed with it.
 */
export function dateFieldOptions(name: string): { value: string; label: string }[] {
    const collection = getCollection(name)
    if (!collection) return []

    const declared = new Map((collection.fields ?? []).map((field) => [field.name, field]))
    const options: { value: string; label: string }[] = []
    const seen = new Set<string>()

    const add = (key: string, label?: string) => {
        if (seen.has(key)) return
        seen.add(key)
        options.push({ value: key, label: label || declared.get(key)?.label || humanize(key) })
    }

    for (const field of collection.fields ?? []) {
        if (field.type === 'date' || field.type === 'datetime') add(field.name)
    }

    const model = getModel(name)
    const attributes = model?.getAttributes?.() ?? model?.rawAttributes ?? {}
    for (const [key, attribute] of Object.entries<any>(attributes)) {
        const type = String(attribute?.type?.key ?? attribute?.type ?? '').toUpperCase()
        if (type.startsWith('DATE')) add(key)
    }

    // Always offered, even on a model that declares neither: the timestamps are
    // there, and "created more than three days ago" is half of what these
    // triggers get used for.
    add('created_at', 'Created at')
    add('updated_at', 'Updated at')

    return options
}

/** The same, as the field definitions themselves — declared ones only. */
export function dateFields(name: string): FieldDefinition[] {
    const collection = getCollection(name)
    if (!collection) return []
    return (collection.fields ?? []).filter((f) => f.type === 'date' || f.type === 'datetime')
}

// ─── Hydration ────────────────────────────────────────────────────────────

/**
 * Turns a model instance into the plain object templates read.
 *
 * Two things happen here that matter downstream: Dates and Decimals become
 * values JSON can hold (a run row is JSON, and a run that cannot be written is
 * a run that cannot be read back), and each relation is loaded once and exposed
 * under its bare name.
 */
export async function hydrateRecord(
    collectionName: string | undefined,
    instance: any
): Promise<Record<string, any>> {
    if (!instance) return {}

    const plain = typeof instance.get === 'function' ? instance.get({ plain: true }) : { ...instance }
    const record: Record<string, any> = {}

    for (const [key, value] of Object.entries(plain)) {
        record[key] = normalize(value)
    }

    if (!collectionName) return record

    const collection = getCollection(collectionName)
    if (!collection) return record

    for (const field of collection.fields ?? []) {
        if (field.type !== 'relation' || !field.relation?.collection) continue

        const foreignKey = plain[field.name]
        if (foreignKey === null || foreignKey === undefined) continue

        const key = relationKey(field.name)
        // Already included by the caller's query — no reason to ask again.
        if (plain[key] && typeof plain[key] === 'object') {
            record[key] = normalizeAll(plain[key])
            continue
        }

        const relatedModel = getModel(field.relation.collection)
        if (!relatedModel) continue

        try {
            const related = await relatedModel.findByPk(foreignKey)
            record[key] = related ? normalizeAll(related.get({ plain: true })) : null
        } catch {
            // A broken relation is not a reason to lose the whole run; the
            // template resolves to an empty string and the step log says so.
            record[key] = null
        }
    }

    return record
}

function normalize(value: any): any {
    if (value instanceof Date) return value.toISOString()
    if (value && typeof value === 'object' && typeof value.toJSON === 'function') {
        return value.toJSON()
    }
    // Sequelize DECIMAL arrives as a string; a template that compares it to a
    // number would silently take the wrong branch.
    if (typeof value === 'string' && /^-?\d+\.\d+$/.test(value)) {
        const asNumber = Number(value)
        return Number.isFinite(asNumber) ? asNumber : value
    }
    return value
}

function normalizeAll(source: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {}
    for (const [key, value] of Object.entries(source || {})) out[key] = normalize(value)
    return out
}
