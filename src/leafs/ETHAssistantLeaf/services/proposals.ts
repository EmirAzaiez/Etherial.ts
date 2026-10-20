// ──────────────────────────────────────────────────────────────────────────
// Changes the assistant may prepare: edit a record, create one, run an
// action, edit several records at once. None of them writes. Each checks
// what the staff member could do themselves — the collection, their rights,
// the fields their form lets them set, the records — works out what would
// change, and hands it to the back-office as a proposal, a card with Confirm
// and Cancel. Confirming calls the back-office's own endpoints, so the hooks,
// the validation, the permissions and the audit apply as for a change made
// by hand. The assistant only hears that the card is waiting.
//
// Only with the leaf's `proposals` on.
// ──────────────────────────────────────────────────────────────────────────

import etherial from 'etherial'
import { randomBytes } from 'crypto'
import { Op } from 'sequelize'

import type { ToolDefinition } from './anthropic.js'
import { MAX_ITEMS, ReadableCollection, ReadableField, SubList } from './catalog.js'
import { maxRecordsOf, timezoneOf } from './options.js'
import { state } from './state.js'
import { Filter, Step, ToolContext, ToolError, clockOf, formatDate, linkedIds, relationLabels, subListRows, whereOf } from './tools.js'
import { FLOW_TOOL, proposeFlow } from './flows.js'

const adminLeaf = () => (etherial as any).eth_admin_leaf

/** What a sentence can set, besides sub-lists. Files and JSON stay in the form. */
const SETTABLE_TYPES = new Set([
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
/** Set as a whole list: several choices, or the records a many-to-many links to. */
const LIST_TYPES = new Set(['multiselect', 'belongsToMany'])
/** Stamped by the database, never set. */
const STAMPS = new Set(['id', 'created_at', 'updated_at', 'deleted_at', 'createdAt', 'updatedAt', 'deletedAt'])
const DAY = /^\d{4}-\d{2}-\d{2}$/
const CLOCK = /^(\d{1,2})[:h](\d{2})(?::\d{2})?$/
const WALL_CLOCK = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** Cards one answer may hold: past it, the person should decide on those first. */
const MAX_PROPOSALS = 5
const MAX_SUMMARY = 240
const SHOWN_TEXT = 300
/** Lines one sub-list adds to a card: past it, one line says how many more. */
const MAX_ITEM_LINES = 12

export type ProposalKind = 'update' | 'create' | 'action' | 'bulk_update' | 'flow'

export interface ProposalChange {
    /** The field; a sub-list's lines, one per item, share its name. */
    field: string
    label: string
    /** As the back-office shows it: a choice's label, a linked record's name. Null when empty (and on a create or an action). */
    before: string | null
    after: string | null
}

/** One change waiting for the staff member's decision (contract C7). */
export interface Proposal {
    id: string
    kind: ProposalKind
    collection: string
    recordId?: string | number
    recordIds?: (string | number)[]
    action?: string
    /** What confirming sends: the fields to set, or the action's form. */
    data?: Record<string, unknown>
    diff?: ProposalChange[]
    summary: string
    /** "Edit Booking #12": what the card is headed with. */
    title: string
    collectionLabel: string
    actionLabel?: string
    /** A destructive action: the card's button says so. */
    tone?: 'default' | 'danger'
    /** The records touched, named, for an action or a bulk edit. */
    records?: { id: string | number; label: string }[]
    /** The record's page; for an automation, the builder. */
    link?: string
    /** What the staff member should check before saving: an automation's open points. */
    notes?: string[]
    /**
     * Record id → when it was last written, as the proposal read it. Confirm
     * sends it as `If-Match`: a record someone changed since is refused (409)
     * rather than overwritten with a diff that no longer holds.
     */
    versions?: Record<string, string>
}

// ── Definitions ─────────────────────────────────────────────────────────────

const VALUES_DESCRIPTION = [
    'Field name → new value. A choice takes its value or its label; a multiple choice, a list of them. null empties a field.',
    "A date is YYYY-MM-DD, a date and time YYYY-MM-DD HH:mm in the project's time zone, a time of day HH:mm. A rich text is HTML.",
    'A text in several languages (languages in describe_collection) takes an object, language → text: on an edit, a language left out keeps its text; on a new record, give every language.',
    'A link takes the id of the record it points to; a list of links (lists_of_links) takes the ids of every record it should point to, and replaces the whole list. Find ids with query_records first.',
    "A sub-list (sub_lists) takes its items as they should be, in order: an item already there is named by its id, as get_record gives it, with only the fields that change ({ id } alone keeps it as it is); an item without an id is added; an item left out is removed. Read the record's items with get_record first.",
].join(' ')

const SUMMARY_SCHEMA = {
    type: 'string',
    description: "One short sentence, in the staff member's language, saying what this does and why: shown on the card.",
}

export const PROPOSAL_TOOLS: ToolDefinition[] = [
    {
        name: 'propose_update',
        description:
            'Prepare a change to one record, for the staff member to review and confirm. Changes nothing by itself: the staff member sees the fields before and after, and decides. Only the fields they can edit in its form can be set.',
        input_schema: {
            type: 'object',
            properties: {
                collection: { type: 'string' },
                id: { description: 'The id of the record to change.' },
                changes: { type: 'object', description: VALUES_DESCRIPTION },
                summary: SUMMARY_SCHEMA,
            },
            required: ['collection', 'id', 'changes'],
        },
    },
    {
        name: 'propose_create',
        description: 'Prepare a new record, for the staff member to review and confirm. Creates nothing by itself.',
        input_schema: {
            type: 'object',
            properties: {
                collection: { type: 'string' },
                values: { type: 'object', description: VALUES_DESCRIPTION },
                summary: SUMMARY_SCHEMA,
            },
            required: ['collection', 'values'],
        },
    },
    {
        name: 'propose_action',
        description:
            "Prepare one of a collection's actions (describe_collection lists them) on one or several records, with what its form asks for, for the staff member to confirm. Runs nothing by itself.",
        input_schema: {
            type: 'object',
            properties: {
                collection: { type: 'string' },
                action: { type: 'string', description: 'Its key, from describe_collection.' },
                ids: { type: 'array', items: {}, description: 'The records to run it on.' },
                data: { type: 'object', description: "The action's form: field name → value." },
                summary: SUMMARY_SCHEMA,
            },
            required: ['collection', 'action', 'ids'],
        },
    },
    {
        name: 'propose_bulk_update',
        description:
            'Prepare the same change to several records, chosen by id or by filters (as in query_records), for the staff member to confirm. Changes nothing by itself.',
        input_schema: {
            type: 'object',
            properties: {
                collection: { type: 'string' },
                ids: { type: 'array', items: {}, description: 'The records to change. Or give filters instead.' },
                filters: { type: 'array', items: { type: 'object' }, description: 'As in query_records: every record that matches is changed.' },
                search: { type: 'string' },
                changes: { type: 'object', description: VALUES_DESCRIPTION },
                summary: SUMMARY_SCHEMA,
            },
            required: ['collection', 'changes'],
        },
    },
]

export const isProposalTool = (name: string) => name === FLOW_TOOL.name || PROPOSAL_TOOLS.some((t) => t.name === name)

/** The tools this person may prepare changes with. */
export const proposalToolsFor = (context: ToolContext): ToolDefinition[] => (context.flows ? [...PROPOSAL_TOOLS, FLOW_TOOL] : PROPOSAL_TOOLS)

/** What describe_collection adds when proposals are on: what this person may prepare there. */
export async function writableSide(collection: ReadableCollection, context: ToolContext) {
    const leaf = adminLeaf()
    const config = leaf?.getCollection(collection.name)
    if (!config) return {}
    const crud: string[] = config.crud ?? []
    const [canUpdate, canCreate] = await Promise.all([
        crud.includes('update') && leaf.checkAccess(context.user, config.name, 'update'),
        crud.includes('create') && leaf.checkAccess(context.user, config.name, 'create'),
    ])
    const settable = canUpdate || canCreate ? await settableFields(collection, config, context.user) : new Map<string, Settable>()
    const fields = [...settable.values()].filter((f) => f.type !== 'hasMany').map((f) => f.name)
    // Not among the fields read: describe_collection would not tell them otherwise.
    const links = [...settable.values()]
        .filter((f) => f.type === 'belongsToMany')
        .map((f) => ({ name: f.name, label: f.label, links_to: f.relation!.collection, takes: 'a list of ids' }))
    const subLists = [...settable.values()]
        .filter((f) => f.type === 'hasMany')
        .map((f) => ({
            name: f.name,
            label: f.label,
            item_fields: [...f.itemFields!.keys()],
            ...(requiredOf(f).length ? { required_on_new_items: requiredOf(f).map((d: any) => d.name) } : {}),
        }))
    const actions: { key: string; label: string; form?: string[] }[] = []
    for (const name of config.actions ?? []) {
        const serialized = leaf.actions?.serialize?.(name)
        if (!serialized || serialized.meta?.category === 'security') continue
        if (!(await leaf.checkAccess(context.user, config.name, name))) continue
        actions.push({
            key: name,
            label: serialized.meta?.label ?? name,
            ...(serialized.form?.length ? { form: serialized.form.map((f: any) => (f.options?.length ? `${f.name} (${f.options.map((o: any) => o.value).join(' | ')})` : f.name)) } : {}),
        })
    }
    return {
        can_prepare: {
            edit: !!canUpdate,
            create: !!canCreate,
            ...(fields.length ? { settable_fields: fields } : {}),
            ...(links.length ? { lists_of_links: links } : {}),
            ...(subLists.length ? { sub_lists: subLists } : {}),
            ...(actions.length ? { actions } : {}),
        },
    }
}

// ── Running a proposal ──────────────────────────────────────────────────────

export async function runProposal(name: string, input: any, context: ToolContext): Promise<{ result: unknown; step: Step }> {
    const proposals = context.proposals
    if (!proposals) throw new ToolError('Preparing changes is turned off: say where in the back office it is done.')
    if (proposals.length >= MAX_PROPOSALS) throw new ToolError(`${MAX_PROPOSALS} changes are already waiting: let the staff member decide on those first.`)

    if (name === FLOW_TOOL.name) {
        if (!context.flows) throw new ToolError('This staff member cannot build automations: tell them so.')
        const { proposal, step } = await proposeFlow(input, context)
        proposals.push(proposal)
        return {
            result: {
                proposal: proposal.id,
                status: 'waiting for the staff member',
                steps: proposal.diff?.map((c) => `${c.label}: ${c.after}`),
                ...(proposal.notes?.length ? { to_check: proposal.notes } : {}),
                note: 'Nothing is saved. The staff member now sees a card that puts this automation in the builder; they check it there, then save it and turn it on. Say in one or two sentences what it does and what they should check (to_check), and never say it is done or running.',
            },
            step,
        }
    }

    const collection = context.collections.get(input?.collection)
    if (!collection) throw new ToolError(`No readable collection "${String(input?.collection)}". Use a key from the list of collections.`)
    const config = adminLeaf()?.getCollection(collection.name)
    if (!config) throw new ToolError(`${collection.labelPlural} cannot be changed from the back office`)
    context.read.add(collection.name)

    let proposal: Proposal
    switch (name) {
        case 'propose_update':
            proposal = await proposeUpdate(collection, config, input, context)
            break
        case 'propose_create':
            proposal = await proposeCreate(collection, config, input, context)
            break
        case 'propose_action':
            proposal = await proposeAction(collection, config, input, context)
            break
        case 'propose_bulk_update':
            proposal = await proposeBulkUpdate(collection, config, input, context)
            break
        default:
            throw new ToolError(`Unknown tool ${name}`)
    }
    proposals.push(proposal)

    const count = proposal.recordIds?.length
    return {
        result: {
            proposal: proposal.id,
            status: 'waiting for the staff member',
            ...(proposal.diff?.length ? { changes: proposal.diff.map((c) => `${c.label}: ${c.before ?? 'empty'} → ${c.after ?? 'empty'}`) } : {}),
            ...(count ? { records: count } : {}),
            note: 'Nothing has changed yet. The staff member now sees this as a card with Confirm and Cancel. Say in one sentence what you prepared and ask them to check it and confirm. Never say it is done.',
        },
        step: { tool: name, label: proposal.title, collection: collection.name, ...(proposal.link ? { link: proposal.link } : {}) },
    }
}

async function proposeUpdate(collection: ReadableCollection, config: any, input: any, context: ToolContext): Promise<Proposal> {
    await allowed(config, context.user, 'update', `edit ${collection.labelPlural.toLowerCase()}`)
    const record = await recordOf(collection, config, input?.id)
    const settable = await settableFields(collection, config, context.user)
    const asked = input?.changes && typeof input.changes === 'object' ? Object.keys(input.changes) : []
    const before = { ...plain(record), ...(await linksOf(record, settable, asked)), ...(await itemsNow(record, collection, settable, asked)) }
    // A text in several languages is merged into what the form shows, unsaved edits included.
    const form = context.form && context.form.collection === collection.name && context.form.id === String(input.id) ? context.form.values : undefined
    const data = await valuesOf(collection, settable, input?.changes, 'changes', before, form)

    const changed = Object.keys(data).filter((name) => !same(settable.get(name)!, before[name], data[name]))
    if (!changed.length) throw new ToolError(`Nothing would change: ${collection.label} #${input.id} already has these values.`)
    const kept = Object.fromEntries(changed.map((name) => [name, data[name]]))

    const id = before[pkOf(collection)]
    const title = `Edit ${collection.label} ${nameOf(collection, before)}`
    return {
        id: proposalId(),
        kind: 'update',
        collection: collection.name,
        collectionLabel: collection.label,
        recordId: id,
        data: kept,
        diff: await diffOf(settable, changed, [before], kept),
        summary: summaryOf(input?.summary, title),
        title,
        link: `/${collection.name}/${encodeURIComponent(String(id))}`,
        ...versionsOf(collection, [before]),
    }
}

async function proposeCreate(collection: ReadableCollection, config: any, input: any, context: ToolContext): Promise<Proposal> {
    await allowed(config, context.user, 'create', `create ${collection.labelPlural.toLowerCase()}`)
    const settable = await settableFields(collection, config, context.user)
    const data = await valuesOf(collection, settable, input?.values, 'values')

    // What the form would refuse to save, said now rather than on Confirm.
    const shown = formFields(config, 'create')
    const missing = (config.fields ?? []).filter(
        (f: any) => f?.required && !f.readonly && f.defaultValue === undefined && (!shown || shown.has(f.name)) && isEmpty(data[f.name])
    )
    const unsettable = missing.filter((f: any) => !settable.has(f.name))
    if (unsettable.length) {
        throw new ToolError(
            `A new ${collection.label.toLowerCase()} needs ${unsettable.map((f: any) => f.label || f.name).join(', ')}, which only its form can fill in: send the staff member to /${collection.name}/create`
        )
    }
    if (missing.length) throw new ToolError(`Required: ${missing.map((f: any) => f.name).join(', ')}`)
    const names = Object.keys(data).filter((name) => !isEmpty(data[name]))
    if (!names.length) throw new ToolError('Give the values of the new record')

    const title = `New ${collection.label.toLowerCase()}`
    return {
        id: proposalId(),
        kind: 'create',
        collection: collection.name,
        collectionLabel: collection.label,
        data,
        diff: (await diffOf(settable, names, [], data)).map((c) => ({ ...c, before: null })),
        summary: summaryOf(input?.summary, title),
        title,
    }
}

async function proposeAction(collection: ReadableCollection, config: any, input: any, context: ToolContext): Promise<Proposal> {
    const leaf = adminLeaf()
    const name = String(input?.action ?? '')
    const action = (config.actions ?? []).includes(name) ? leaf.actions?.get?.(name) : undefined
    if (!action) throw new ToolError(`${collection.labelPlural} have no action "${name}". describe_collection lists them.`)
    const serialized = leaf.actions.serialize(name)
    const label: string = serialized?.meta?.label ?? name
    // A generated password or key is shown once, to whoever runs it, on the record's page.
    if (serialized?.meta?.category === 'security') throw new ToolError(`"${label}" is run from the record's page, by hand.`)
    await allowed(config, context.user, name, `run "${label}"`)

    const ids = idsOf(input?.ids)
    const danger = serialized?.meta?.color === 'danger'
    // As the list does with a selection: a dangerous action goes one record at a time.
    if (danger && ids.length > 1) throw new ToolError(`"${label}" is run on one record at a time.`)
    const rows = await recordsOf(collection, config, ids)

    const form: any[] = serialized?.form ?? []
    const data: Record<string, unknown> = {}
    const given = input?.data && typeof input.data === 'object' && !Array.isArray(input.data) ? input.data : {}
    for (const [key, value] of Object.entries(given)) {
        const field = form.find((f) => f.name === key)
        if (!field) throw new ToolError(`"${label}" has no field "${key}"${form.length ? `: its form takes ${form.map((f) => f.name).join(', ')}` : ''}`)
        data[key] = optionValue(field, value)
    }
    if (action.form) {
        try {
            await action.form.validate(data, { abortEarly: false })
        } catch (err: any) {
            throw new ToolError(`"${label}" would refuse this: ${(err?.errors ?? [err?.message]).join('; ')}`)
        }
    }

    const records = rows.map((row) => ({ id: row[pkOf(collection)], label: nameOf(collection, row) }))
    const one = records.length === 1
    const title = one ? `${label}: ${collection.label} ${records[0].label}` : `${label}: ${records.length} ${collection.labelPlural.toLowerCase()}`
    return {
        id: proposalId(),
        kind: 'action',
        collection: collection.name,
        collectionLabel: collection.label,
        action: name,
        actionLabel: label,
        ...(one ? { recordId: records[0].id } : {}),
        recordIds: records.map((r) => r.id),
        data,
        diff: Object.entries(data).map(([key, value]) => {
            const field = form.find((f) => f.name === key)
            const option = field?.options?.find((o: any) => String(o.value) === String(value))
            return { field: key, label: field?.label ?? key, before: null, after: value === null || value === undefined || value === '' ? null : String(option?.label ?? value) }
        }),
        summary: summaryOf(input?.summary, serialized?.meta?.description || title),
        title,
        tone: danger ? 'danger' : 'default',
        records,
        ...(one ? { link: `/${collection.name}/${encodeURIComponent(String(records[0].id))}` } : {}),
    }
}

async function proposeBulkUpdate(collection: ReadableCollection, config: any, input: any, context: ToolContext): Promise<Proposal> {
    await allowed(config, context.user, 'update', `edit ${collection.labelPlural.toLowerCase()}`)
    const settable = await settableFields(collection, config, context.user)
    const data = await valuesOf(collection, settable, input?.changes, 'changes', {}, undefined, true)
    const lists = Object.keys(data).filter((name) => ['belongsToMany', 'hasMany', 'translations'].includes(settable.get(name)!.type))
    if (lists.length) throw new ToolError(`${lists.map((name) => settable.get(name)!.label).join(', ')} is changed one record at a time, with propose_update`)
    const max = maxRecordsOf(state.config)

    let rows: Record<string, any>[]
    if (Array.isArray(input?.ids) && input.ids.length) {
        rows = await recordsOf(collection, config, idsOf(input.ids))
    } else if ((Array.isArray(input?.filters) && input.filters.length) || input?.search) {
        const where = { [Op.and]: [whereOf(collection, input.filters as Filter[], input.search), notDeleted(config)] }
        const total: number = await collection.model.count({ where })
        if (!total) throw new ToolError(`No ${collection.labelPlural.toLowerCase()} match these filters`)
        if (total > max) throw new ToolError(`${total} ${collection.labelPlural.toLowerCase()} match: at most ${max} can be changed at once. Narrow the filters.`)
        const found = await collection.model.findAll({ where, order: [[pkOf(collection), 'ASC']], limit: max })
        rows = found.map(plain)
    } else {
        throw new ToolError('Say which records: ids, or filters')
    }

    // Records that already hold the new values are left out: confirming them would change nothing.
    const names = Object.keys(data)
    const touched = rows.filter((row) => names.some((name) => !same(settable.get(name)!, row[name], data[name])))
    if (!touched.length) throw new ToolError(`Nothing would change: these ${collection.labelPlural.toLowerCase()} already have these values.`)
    const changed = names.filter((name) => touched.some((row) => !same(settable.get(name)!, row[name], data[name])))
    const kept = Object.fromEntries(changed.map((name) => [name, data[name]]))

    const records = touched.map((row) => ({ id: row[pkOf(collection)], label: nameOf(collection, row) }))
    const left = rows.length - touched.length
    const title = `Edit ${records.length} ${(records.length === 1 ? collection.label : collection.labelPlural).toLowerCase()}`
    return {
        id: proposalId(),
        kind: 'bulk_update',
        collection: collection.name,
        collectionLabel: collection.label,
        recordIds: records.map((r) => r.id),
        data: kept,
        diff: await diffOf(settable, changed, touched, kept),
        summary: summaryOf(input?.summary, left ? `${title} (${left} already had these values)` : title),
        title,
        records,
        ...versionsOf(collection, touched),
    }
}

// ── What this person may set ────────────────────────────────────────────────

/** Throws unless the collection and the role allow it, as the endpoint itself would. */
async function allowed(config: any, user: any, method: string, what: string): Promise<void> {
    const crudMethod = method === 'update' || method === 'create'
    if (crudMethod && !(config.crud ?? []).includes(method)) throw new ToolError(`${config.meta?.labelPlural ?? config.name} cannot be ${method === 'update' ? 'edited' : 'created'} from the back office`)
    if (!(await adminLeaf().checkAccess(user, config.name, method))) throw new ToolError(`This staff member may not ${what}: tell them so.`)
}

let warnedFallback = false

/** A field a proposal may set; a sub-list with the item fields it may set. */
type Settable = ReadableField & { list?: SubList; itemFields?: Map<string, ReadableField> }

/** The fields a form view shows, when it names them; null when it shows every editable field. */
function formFields(config: any, view: 'create' | 'edit'): Set<string> | null {
    const form = config.views?.[view]
    if (form?.sections?.length) return new Set(form.sections.flatMap((s: any) => s.fields ?? []))
    if (form?.fields?.length) return new Set(form.fields)
    return null
}

/** A sub-list's item fields that a new item cannot go without. */
const requiredOf = (field: Settable): any[] => field.list!.definitions.filter((d: any) => (d.required || d.validation?.required) && !d.readonly)

/**
 * The fields a proposal may set: those the person's own form may write — the
 * admin leaf's `writableFields`, which knows roles and protected columns —
 * that the assistant can also read, and that a sentence can say.
 */
async function settableFields(collection: ReadableCollection, config: any, user: any): Promise<Map<string, Settable>> {
    const leaf = adminLeaf()
    let writable: Set<string>
    if (typeof leaf?.writableFields === 'function') {
        writable = await leaf.writableFields(config, user)
    } else {
        // An admin leaf older than its writableFields: what the form shows as editable.
        if (!warnedFallback) {
            warnedFallback = true
            console.warn('[ETHAssistantLeaf] The admin leaf has no writableFields(): proposals fall back to the declared, non-readonly fields')
        }
        writable = new Set((config.fields ?? []).filter((f: any) => f?.name && !f.readonly && !f.hidden && !f.secure).map((f: any) => f.name))
    }
    const pk = pkOf(collection)
    const out = new Map<string, Settable>()
    for (const field of collection.fields) {
        if (field.name === pk || STAMPS.has(field.name) || !SETTABLE_TYPES.has(field.type) || !writable.has(field.name)) continue
        out.set(field.name, field)
    }
    // A many-to-many (a segment's projects) is no column the assistant reads,
    // but a list of ids the form sets: it may set it too. Not with data on the
    // link itself (pivot fields), which only the form shows.
    const excluded = new Set<string>(state.config.excludeFields?.[config.name] ?? [])
    for (const field of config.fields ?? []) {
        const link = field?.type === 'belongsToMany' ? field.belongsToMany : undefined
        if (!link?.collection || link.pivotFields?.length || field.secure || excluded.has(field.name) || !writable.has(field.name)) continue
        out.set(field.name, {
            name: field.name,
            label: field.label || field.name,
            type: 'belongsToMany',
            relation: { collection: link.collection, displayField: link.displayField || 'id' },
            listFilter: false,
        })
    }
    // A sub-list, item by item: what its rows hold, but for what only the form can fill in (files).
    for (const list of collection.subLists) {
        if (!writable.has(list.name)) continue
        const itemFields = new Map<string, ReadableField>()
        for (const field of list.fields) {
            const definition = list.definitions.find((d: any) => d.name === field.name)
            if (definition?.readonly || STAMPS.has(field.name)) continue
            if (field.type === 'belongsToMany' || SETTABLE_TYPES.has(field.type)) itemFields.set(field.name, field)
        }
        if (itemFields.size) out.set(list.name, { name: list.name, label: list.label, type: 'hasMany', listFilter: false, list, itemFields })
    }
    return out
}

/**
 * The values asked for, as the endpoint takes them; throws on the first that
 * cannot be. `before` holds the record's values, its sub-lists' items among
 * them; `form`, what its open form shows.
 */
async function valuesOf(
    collection: ReadableCollection,
    settable: Map<string, Settable>,
    raw: unknown,
    key: string,
    before: Record<string, any> = {},
    form?: Record<string, unknown>,
    bulk = false
): Promise<Record<string, unknown>> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ToolError(`${key} is an object: field name → value`)
    const entries = Object.entries(raw as Record<string, unknown>)
    if (!entries.length) throw new ToolError(`${key} is empty`)
    const out: Record<string, unknown> = {}
    for (const [name, value] of entries) {
        const field = settable.get(name)
        if (!field) {
            const known = collection.fields.some((f) => f.name === name) || collection.subLists.some((l) => l.name === name)
            throw new ToolError(
                known
                    ? `${name} cannot be set here: ${settable.size ? `settable fields are ${[...settable.keys()].join(', ')}` : 'nothing in this collection can be'}. Say it is done in the form.`
                    : `${collection.name} has no field "${name}". Call describe_collection.`
            )
        }
        if (bulk && field.type === 'hasMany') continue
        out[name] =
            field.type === 'hasMany'
                ? await itemsOfList(field, value, before[name] ?? [])
                : field.type === 'translations'
                  ? textsOf(field, value, isTexts(form?.[name]) ? form![name] : before[name], !bulk && before[pkOf(collection)] !== undefined)
                  : await valueOf(field, value)
    }
    return out
}

const isTexts = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

/**
 * A text in several languages, as one object with every language: the model
 * may replace them all at once. On an edit, a language not given keeps the
 * text it has now; on a new record, it stays out.
 */
function textsOf(field: ReadableField, value: unknown, current: unknown, merge: boolean): Record<string, string> {
    const locales = field.locales ?? []
    let given: unknown = value
    if (typeof value === 'string' && value.trim().startsWith('{')) {
        try {
            given = JSON.parse(value)
        } catch {
            // Plain text: refused below.
        }
    }
    const shape = `{ ${locales.map((l) => `"${l}": "…"`).join(', ')} }`
    if (given === null) return Object.fromEntries(locales.map((l) => [l, '']))
    if (!isTexts(given)) throw new ToolError(`${field.name} takes a text per language: ${shape}`)
    const unknown = Object.keys(given).filter((l) => !locales.includes(l))
    if (unknown.length) throw new ToolError(`${field.name} has no language ${unknown.join(', ')}: it takes ${shape}`)
    const out: Record<string, string> = {}
    for (const locale of locales) {
        if (locale in given) {
            const text = given[locale]
            out[locale] = text === null || text === undefined ? '' : String(text)
        } else if (merge) {
            const text = isTexts(current) ? current[locale] : undefined
            out[locale] = text === null || text === undefined ? '' : String(text)
        }
    }
    return out
}

/** A sub-list's items now, for the sub-lists among `names`: what an edit starts from. */
async function itemsNow(record: any, collection: ReadableCollection, settable: Map<string, Settable>, names: string[]): Promise<Record<string, Record<string, any>[]>> {
    const out: Record<string, Record<string, any>[]> = {}
    for (const name of names) {
        const list = settable.get(name)?.list
        if (!list) continue
        const { rows, total } = await subListRows(list, record.get(pkOf(collection)), MAX_ITEMS + 1)
        if (total > MAX_ITEMS) throw new ToolError(`${list.label} holds ${total} items: too many to edit from here. Say it is done in the record's form.`)
        out[name] = rows
    }
    return out
}

/**
 * A sub-list as the endpoint takes it: the items kept, changed or added, in
 * their new order, then the ones removed, flagged `_deleted` — an item left
 * out of the payload would be kept as it is.
 */
async function itemsOfList(field: Settable, value: unknown, rows: Record<string, any>[]): Promise<Record<string, unknown>[]> {
    const list = field.list!
    const itemFields = field.itemFields!
    const pk: string = list.model.primaryKeyAttribute || 'id'
    const byId = new Map(rows.map((row) => [String(row[pk]), row]))
    const given = itemsOf(value)
    const out: Record<string, unknown>[] = []
    const kept = new Set<string>()

    for (const [index, raw] of given.entries()) {
        const where = `${list.label}, item ${index + 1}`
        if (!isTexts(raw)) throw new ToolError(`${where}: an item is an object, item field → value, with the id of one already there`)
        const id = raw.id === undefined || raw.id === null || raw.id === '' ? undefined : String(raw.id)
        const existing = id === undefined ? undefined : byId.get(id)
        if (id !== undefined && !existing) throw new ToolError(`${where}: this record has no item #${id} in ${list.label}. get_record lists them; an item without an id is a new one.`)
        if (id !== undefined && kept.has(id)) throw new ToolError(`${where}: item #${id} is listed twice`)
        if (id !== undefined) kept.add(id)

        const item: Record<string, unknown> = existing ? { id: existing[pk] } : {}
        for (const [key, v] of Object.entries(raw)) {
            if (key === 'id' || key === pk) continue
            const itemField = itemFields.get(key)
            if (!itemField) throw new ToolError(`${where}: no settable field "${key}". Its items take ${[...itemFields.keys()].join(', ')}.`)
            let next: unknown
            try {
                next = itemField.type === 'translations' ? textsOf(itemField, v, existing?.[key], !!existing) : await valueOf(itemField, v)
            } catch (err) {
                if (err instanceof ToolError) throw new ToolError(`${where}: ${err.message}`)
                throw err
            }
            // On an item already there, only what changes.
            if (!existing || !same(itemField, existing[key], next)) item[key] = next
        }
        if (!existing) {
            // A new item starts from the defaults, as one added in the form.
            for (const definition of list.definitions) {
                if (definition.defaultValue !== undefined && item[definition.name] === undefined && itemFields.has(definition.name)) item[definition.name] = definition.defaultValue
            }
        }
        for (const definition of requiredOf(field)) {
            const missing = existing ? definition.name in item && blank(item[definition.name]) : blank(item[definition.name]) && definition.defaultValue === undefined
            if (!missing) continue
            throw new ToolError(
                itemFields.has(definition.name)
                    ? `${where}: ${definition.label || definition.name} is required`
                    : `${where}: a new item needs ${definition.label || definition.name}, which only the form can fill in. Say it is added in the record's form.`
            )
        }
        out.push(item)
    }

    if (list.max !== undefined && out.length > list.max) throw new ToolError(`${list.label} holds at most ${list.max} items, not ${out.length}`)
    if (list.min !== undefined && out.length < list.min) throw new ToolError(`${list.label} needs at least ${list.min} items, not ${out.length}`)
    const removed = rows.filter((row) => !kept.has(String(row[pk]))).map((row) => ({ id: row[pk], _deleted: true }))
    return [...out, ...removed]
}

async function valueOf(field: ReadableField, value: unknown): Promise<unknown> {
    if (LIST_TYPES.has(field.type)) return listValueOf(field, value)
    if (value === null || value === undefined || (value === '' && !['string', 'text', 'richtext'].includes(field.type))) return null
    switch (field.type) {
        case 'time': {
            const match = CLOCK.exec(String(value).trim())
            if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) throw new ToolError(`${field.name} is a time of day, HH:mm, not "${String(value)}"`)
            return `${match[1].padStart(2, '0')}:${match[2]}`
        }
        case 'integer':
        case 'number': {
            const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
            if (!Number.isFinite(n) || (field.type === 'integer' && !Number.isInteger(n))) throw new ToolError(`${field.name} is ${field.type === 'integer' ? 'a whole number' : 'a number'}, not "${String(value)}"`)
            return n
        }
        case 'boolean':
            if (value === true || value === 'true' || value === 1 || value === '1') return true
            if (value === false || value === 'false' || value === 0 || value === '0') return false
            throw new ToolError(`${field.name} is true or false`)
        case 'date': {
            const s = String(value).trim()
            if (DAY.test(s)) return s
            const parsed = Date.parse(s)
            if (Number.isNaN(parsed)) throw new ToolError(`${field.name} takes a date (YYYY-MM-DD), not "${s}"`)
            return formatDate(new Date(parsed), false)
        }
        case 'datetime':
            return instantOf(field, String(value).trim()).toISOString()
        case 'select': {
            const options = field.options ?? []
            const match =
                options.find((o) => String(o.value) === String(value)) ?? options.find((o) => o.label.toLowerCase() === String(value).toLowerCase())
            if (!match && options.length) throw new ToolError(`${field.name} is one of: ${options.map((o) => `${o.value} (${o.label})`).join(', ')}`)
            return match ? match.value : value
        }
        case 'relation': {
            const id = String(value).trim()
            const target = adminLeaf()?.getCollection(field.relation!.collection)?.model
            if (target) {
                const pkType = String(target.rawAttributes?.[target.primaryKeyAttribute || 'id']?.type?.key ?? '')
                if (/INT/.test(pkType) && !/^\d+$/.test(id)) throw new ToolError(`${field.name} takes the id of a ${field.relation!.collection} record (a whole number), not "${id}": find it with query_records`)
                if (!(await target.findByPk(id, { attributes: [target.primaryKeyAttribute || 'id'] }))) throw new ToolError(`No ${field.relation!.collection} #${id}`)
            }
            return /^\d+$/.test(id) ? Number(id) : id
        }
        case 'email': {
            const s = String(value).trim()
            if (!EMAIL.test(s)) throw new ToolError(`${field.name} is an email address, not "${s}"`)
            return s
        }
        default:
            return String(value)
    }
}

/** A whole list, as the form sends it: null or nothing empties it. */
async function listValueOf(field: ReadableField, value: unknown): Promise<unknown[]> {
    const given = itemsOf(value)
    if (field.type === 'multiselect') {
        const options = field.options ?? []
        const values = given.map((v) => {
            const match = options.find((o) => String(o.value) === String(v)) ?? options.find((o) => o.label.toLowerCase() === String(v).toLowerCase())
            if (!match && options.length) throw new ToolError(`${field.name} takes values among: ${options.map((o) => (String(o.value) === o.label ? o.value : `${o.value} (${o.label})`)).join(', ')}`)
            return match ? match.value : String(v)
        })
        return [...new Set(values)]
    }
    const collection = field.relation!.collection
    const ids = [...new Set(given.map((v) => String(v).trim()))]
    if (ids.some((id) => !/^\d+$/.test(id))) throw new ToolError(`${field.name} takes the ids of ${collection} records (whole numbers): find them with query_records`)
    const target = adminLeaf()?.getCollection(collection)?.model
    if (target && ids.length) {
        const pk = target.primaryKeyAttribute || 'id'
        const found: any[] = await target.findAll({ where: { [pk]: { [Op.in]: ids } }, attributes: [pk], raw: true })
        const missing = ids.filter((id) => !found.some((row) => String(row[pk]) === id))
        if (missing.length) throw new ToolError(`No ${collection} ${missing.map((id) => `#${id}`).join(', ')}`)
    }
    return ids.map(Number)
}

/** The items of a list value: an array, JSON text holding one, or a single value. */
function itemsOf(value: unknown): unknown[] {
    if (value === null || value === undefined || value === '') return []
    if (typeof value === 'string' && value.startsWith('[')) {
        try {
            const parsed = JSON.parse(value)
            if (Array.isArray(parsed)) return parsed
        } catch {
            // Plain text that happens to start with a bracket.
        }
    }
    return (Array.isArray(value) ? value : [value]).filter((v) => v !== null && v !== undefined && v !== '')
}

const isEmpty = (value: unknown) => value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
/** Empty, or a text in several languages with none written. */
const blank = (value: unknown) => isEmpty(value) || (isTexts(value) && Object.values(value).every(isEmpty))

/** What a record's many-to-many fields among `names` hold now, read through their association. */
async function linksOf(record: any, settable: Map<string, ReadableField>, names: string[]): Promise<Record<string, unknown[]>> {
    const out: Record<string, unknown[]> = {}
    for (const name of names) {
        if (settable.get(name)?.type !== 'belongsToMany') continue
        // The admin leaf names the association after the field: it saves through the same setter.
        const get = record[`get${name.charAt(0).toUpperCase()}${name.slice(1)}`]
        if (typeof get !== 'function') throw new ToolError(`${settable.get(name)!.label} is changed in the record's form`)
        const linked: any[] = await get.call(record, { joinTableAttributes: [] })
        out[name] = linked.map((row) => row.get?.(row.constructor?.primaryKeyAttribute || 'id') ?? row.id)
    }
    return out
}

/** "2026-10-20 10:00" is read in the project's zone; a time with its own offset as it says. */
function instantOf(field: ReadableField, s: string): Date {
    const wall = WALL_CLOCK.exec(s)
    if (wall) return zoned(wall[1], Number(wall[2]), Number(wall[3]), Number(wall[4] ?? 0))
    if (DAY.test(s)) return zoned(s, 0, 0, 0)
    const parsed = Date.parse(s)
    if (Number.isNaN(parsed)) throw new ToolError(`${field.name} takes a date and time (YYYY-MM-DD HH:mm), not "${s}"`)
    return new Date(parsed)
}

function zoned(day: string, hour: number, minute: number, second: number): Date {
    const [y, m, d] = day.split('-').map(Number)
    const wall = Date.UTC(y, m - 1, d, hour, minute, second)
    // The zone's offset at that moment, checked once more across a clock change.
    let instant = wall - offsetAt(wall)
    const again = offsetAt(instant)
    if (wall - again !== instant) instant = wall - again
    return new Date(instant)
}

function offsetAt(ms: number): number {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezoneOf(state.config),
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).formatToParts(new Date(ms))
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - Math.floor(ms / 1000) * 1000
}

/** An action form's choice may be named by its label too. */
function optionValue(field: any, value: unknown): unknown {
    if (!field?.options?.length || value === null || value === undefined) return value
    const match =
        field.options.find((o: any) => String(o.value) === String(value)) ??
        field.options.find((o: any) => String(o.label).toLowerCase() === String(value).toLowerCase())
    if (!match) throw new ToolError(`${field.name} is one of: ${field.options.map((o: any) => o.value).join(', ')}`)
    return match.value
}

// ── The records ─────────────────────────────────────────────────────────────

const pkOf = (collection: ReadableCollection): string => collection.model.primaryKeyAttribute || 'id'
const plain = (record: any): Record<string, any> => (record?.get ? record.get({ plain: true }) : record)

/** `{ versions }` from the column the model stamps on each write; nothing for a model without one. */
function versionsOf(collection: ReadableCollection, rows: Record<string, any>[]): { versions?: Record<string, string> } {
    const column = (collection.model as any)._timestampAttributes?.updatedAt
    if (!column) return {}
    const versions: Record<string, string> = {}
    for (const row of rows) {
        const value = row[column]
        const date = value instanceof Date ? value : value ? new Date(value) : null
        if (date && !Number.isNaN(date.getTime())) versions[String(row[pkOf(collection)])] = date.toISOString()
    }
    return Object.keys(versions).length ? { versions } : {}
}

/** Soft-deleted rows are not edited: the list shows them only on request. */
function notDeleted(config: any): any {
    if (!config.softDelete?.enabled) return {}
    return { [config.softDelete.deletedAtField || 'deleted_at']: { [Op.is]: null } }
}

function idOf(raw: unknown): string {
    const id = String(raw ?? '').trim()
    // The back-office's record routes take numeric ids only.
    if (!/^\d+$/.test(id)) throw new ToolError(`An id is a whole number, not "${id}"`)
    return id
}

function idsOf(raw: unknown): string[] {
    if (!Array.isArray(raw) || !raw.length) throw new ToolError('ids is a list of record ids')
    const ids = [...new Set(raw.map(idOf))]
    const max = maxRecordsOf(state.config)
    if (ids.length > max) throw new ToolError(`At most ${max} records at once, not ${ids.length}`)
    return ids
}

async function recordOf(collection: ReadableCollection, config: any, raw: unknown): Promise<any> {
    const id = idOf(raw)
    const record = await collection.model.findOne({ where: { [Op.and]: [{ [pkOf(collection)]: id }, notDeleted(config)] } })
    if (!record) throw new ToolError(`No ${collection.label.toLowerCase()} #${id}`)
    return record
}

async function recordsOf(collection: ReadableCollection, config: any, ids: string[]): Promise<Record<string, any>[]> {
    const pk = pkOf(collection)
    const found = await collection.model.findAll({ where: { [Op.and]: [{ [pk]: { [Op.in]: ids } }, notDeleted(config)] }, order: [[pk, 'ASC']] })
    const rows = found.map(plain)
    const missing = ids.filter((id) => !rows.some((row: any) => String(row[pk]) === id))
    if (missing.length) throw new ToolError(`No ${collection.label.toLowerCase()} ${missing.map((id) => `#${id}`).join(', ')}`)
    return rows
}

const NAME_FIELDS = ['name', 'title', 'label', 'full_name', 'fullname', 'subject', 'reference', 'code', 'email']

/** "#12 (Sara Ali)": its id, and a readable name when it has one. */
function nameOf(collection: ReadableCollection, row: Record<string, any>): string {
    const id = row[pkOf(collection)]
    const readableNames = new Set(collection.fields.map((f) => f.name))
    const pick = (name: string) => (readableNames.has(name) && row[name] !== null && row[name] !== undefined && String(row[name]).trim() ? String(row[name]).trim() : '')
    const person = [pick('firstname') || pick('first_name'), pick('lastname') || pick('last_name')].filter(Boolean).join(' ')
    const name = NAME_FIELDS.map(pick).find(Boolean) || person
    return name ? `#${id} (${name.length > 60 ? `${name.slice(0, 60)}…` : name})` : `#${id}`
}

// ── Before and after ────────────────────────────────────────────────────────

function same(field: Settable, before: unknown, after: unknown): boolean {
    if (field.type === 'hasMany') {
        // Nothing changed, removed, added or moved.
        const rows = Array.isArray(before) ? before : []
        const items = Array.isArray(after) ? (after as Record<string, unknown>[]) : []
        const pk: string = field.list!.model.primaryKeyAttribute || 'id'
        return items.length === rows.length && items.every((item, i) => !item._deleted && Object.keys(item).length === 1 && String(item.id) === String(rows[i]?.[pk]))
    }
    if (field.type === 'translations') {
        const a = isTexts(before) ? before : {}
        const b = isTexts(after) ? after : {}
        return (field.locales ?? []).every((l) => !(l in b) || String(a[l] ?? '') === String(b[l] ?? ''))
    }
    if (LIST_TYPES.has(field.type)) {
        const a = itemsOf(before).map(String).sort()
        const b = itemsOf(after).map(String).sort()
        return a.length === b.length && a.every((v, i) => v === b[i])
    }
    const empty = (v: unknown) => v === null || v === undefined || v === ''
    if (empty(before) || empty(after)) return empty(before) && empty(after)
    switch (field.type) {
        case 'datetime':
            return new Date(String(before instanceof Date ? before.toISOString() : before)).getTime() === new Date(String(after)).getTime()
        case 'date':
            return formatDate(before, false) === after
        case 'boolean':
            return Boolean(before === 'false' ? false : before) === after
        case 'integer':
        case 'number':
            return Number(before) === Number(after)
        case 'time':
            return clockOf(before) === clockOf(after)
        default:
            return String(before) === String(after)
    }
}

/** A value as the back-office shows it. */
function shown(field: ReadableField, value: unknown, names: Map<string, string>): string | null {
    if (value === null || value === undefined || value === '') return null
    switch (field.type) {
        case 'boolean':
            return value === true || value === 1 || value === '1' || value === 'true' ? 'Yes' : 'No'
        case 'select':
            return field.options?.find((o) => String(o.value) === String(value))?.label ?? String(value)
        case 'relation':
            return names.get(String(value)) ?? `#${value}`
        case 'multiselect':
        case 'belongsToMany': {
            const items = itemsOf(value).map((v) =>
                field.type === 'multiselect' ? field.options?.find((o) => String(o.value) === String(v))?.label ?? String(v) : names.get(String(v)) ?? `#${v}`
            )
            const s = items.join(', ')
            return !s ? null : s.length > SHOWN_TEXT ? `${s.slice(0, SHOWN_TEXT)}…` : s
        }
        case 'date':
            return formatDate(value, false)
        case 'datetime':
            return formatDate(value, true)
        case 'time':
            return clockOf(value)
        case 'translations': {
            if (!isTexts(value)) return null
            const s = (field.locales ?? Object.keys(value))
                .filter((l) => !isEmpty(value[l]))
                .map((l) => `${l.toUpperCase()}: ${String(value[l])}`)
                .join(' · ')
            return !s ? null : s.length > SHOWN_TEXT ? `${s.slice(0, SHOWN_TEXT)}…` : s
        }
        case 'richtext': {
            const s = String(value)
                .replace(/<[^>]+>/g, ' ')
                .replace(/&nbsp;/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
            return !s ? null : s.length > SHOWN_TEXT ? `${s.slice(0, SHOWN_TEXT)}…` : s
        }
        default: {
            const s = typeof value === 'object' ? JSON.stringify(value) : String(value)
            return s.length > SHOWN_TEXT ? `${s.slice(0, SHOWN_TEXT)}…` : s
        }
    }
}

/**
 * One line per field: what it holds now and what it would hold. Across
 * several records, "before" counts the values they hold: "Pending ×3, Open ×2".
 */
async function diffOf(settable: Map<string, Settable>, names: string[], rows: Record<string, any>[], data: Record<string, unknown>): Promise<ProposalChange[]> {
    const out: ProposalChange[] = []
    for (const name of names) {
        const field = settable.get(name)!
        if (field.type === 'hasMany') {
            out.push(...(await itemsDiff(field, rows.length === 1 ? rows[0][name] ?? [] : [], data[name] as Record<string, unknown>[])))
            continue
        }
        const labels =
            field.type === 'relation' || field.type === 'belongsToMany'
                ? await relationLabels(field, [data[name], ...rows.map((r) => r[name])].flatMap(itemsOf))
                : new Map<string, string>()
        let before: string | null = null
        if (rows.length === 1) {
            before = shown(field, rows[0][name], labels)
        } else if (rows.length > 1) {
            const counts = new Map<string, number>()
            for (const row of rows) {
                const value = shown(field, row[name], labels) ?? 'empty'
                counts.set(value, (counts.get(value) ?? 0) + 1)
            }
            const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
            before = sorted
                .slice(0, 4)
                .map(([value, n]) => `${value} ×${n}`)
                .join(', ')
            if (sorted.length > 4) before += ', …'
        }
        out.push({ field: name, label: field.label, before, after: shown(field, data[name], labels) })
    }
    return out
}

/**
 * A sub-list's lines: an item added (its values), changed (the fields that
 * change), removed (what it held); one line when only the order changes.
 */
async function itemsDiff(field: Settable, rows: Record<string, any>[], items: Record<string, unknown>[]): Promise<ProposalChange[]> {
    const list = field.list!
    const itemFields = [...field.itemFields!.values()]
    const pk: string = list.model.primaryKeyAttribute || 'id'
    const byId = new Map(rows.map((row) => [String(row[pk]), row]))
    const labels = new Map<string, Map<string, string>>()
    for (const f of itemFields) {
        if (f.type !== 'relation' && f.type !== 'belongsToMany') continue
        labels.set(f.name, await relationLabels(f, [...rows, ...items].flatMap((item) => (f.type === 'relation' ? [item[f.name]] : linkedIds(item[f.name])))))
    }
    const text = (item: Record<string, unknown>, only?: string[]) => {
        const s = itemFields
            .filter((f) => !only || only.includes(f.name))
            .map((f) => {
                const value = shown(f, f.type === 'belongsToMany' ? linkedIds(item[f.name]) : item[f.name], labels.get(f.name) ?? new Map())
                return value === null ? (only ? `${f.label}: empty` : '') : `${f.label}: ${value}`
            })
            .filter(Boolean)
            .join(' · ')
        return !s ? null : s.length > SHOWN_TEXT ? `${s.slice(0, SHOWN_TEXT)}…` : s
    }

    const lines: ProposalChange[] = []
    const kept = items.filter((item) => !item._deleted)
    kept.forEach((item, i) => {
        const label = `${list.label} ${i + 1}`
        const existing = item.id === undefined ? undefined : byId.get(String(item.id))
        if (!existing) {
            lines.push({ field: field.name, label: `${label} (new)`, before: null, after: text(item) })
            return
        }
        const changed = Object.keys(item).filter((key) => key !== 'id')
        if (changed.length) lines.push({ field: field.name, label, before: text(existing, changed), after: text(item, changed) })
    })
    for (const item of items.filter((item) => item._deleted)) {
        const existing = byId.get(String(item.id))
        if (existing) lines.push({ field: field.name, label: `${list.label} (removed)`, before: text(existing), after: null })
    }
    if (!lines.length) {
        // Only the order changes.
        lines.push({ field: field.name, label: list.label, before: 'Current order', after: 'New order' })
    }
    if (lines.length > MAX_ITEM_LINES) {
        const more = lines.length - (MAX_ITEM_LINES - 1)
        lines.splice(MAX_ITEM_LINES - 1, lines.length, { field: field.name, label: list.label, before: null, after: `${more} more changes` })
    }
    return lines
}

function summaryOf(given: unknown, fallback: string): string {
    const text = typeof given === 'string' ? given.trim().replace(/\s+/g, ' ') : ''
    if (!text) return fallback
    return text.length > MAX_SUMMARY ? `${text.slice(0, MAX_SUMMARY)}…` : text
}

const proposalId = () => `p_${randomBytes(6).toString('hex')}`
