import etherial from 'etherial'
import type { LeafSync } from '../../../components/sync/index.js'

// ──────────────────────────────────────────────────────────────────────────
// What a project tells the case leaf, and the defaults it falls back to.
// The leaf owns the conversation, the clocks (SLA), the history and the
// back-office; the project owns its tables (it extends the base models), what
// a case is about (a unit), how a customer is told and its app routes.
// ──────────────────────────────────────────────────────────────────────────

export const CASES_COLLECTION = 'cases'
export const COMMENTS_COLLECTION = 'case-comments'
export const CANNED_REPLIES_COLLECTION = 'case-canned-replies'
export const SLA_POLICIES_COLLECTION = 'case-sla-policies'
export const EVENTS_COLLECTION = 'case-events'

/** The routes the back-office's conversation panel calls. */
export const ADMIN_PREFIX = '/admin/cases'

/** The project's model names, as registered in Sequelize. */
export interface CaseModelNames {
    Case: string
    CaseComment: string
}

const DEFAULT_MODELS: CaseModelNames = { Case: 'Case', CaseComment: 'CaseComment' }

/** A value of a select (kind, category, priority) and how the back-office shows it. */
export interface CaseOption {
    value: string
    label: string
    color?: string
}

const options = (values: [string, string, string?][]): CaseOption[] =>
    values.map(([value, label, color]) => ({ value, label, ...(color ? { color } : {}) }))

export const DEFAULT_KINDS = options([
    ['MAINTENANCE', 'Maintenance'],
    ['COMPLAINT', 'Complaint'],
    ['GENERAL_INQUIRY', 'General inquiry'],
])

export const DEFAULT_PRIORITIES = options([
    ['LOW', 'Low', 'gray'],
    ['MEDIUM', 'Medium', 'blue'],
    ['HIGH', 'High', 'orange'],
    ['URGENT', 'Urgent', 'red'],
])

export const DEFAULT_CATEGORIES = options([
    ['PLUMBING', 'Plumbing'],
    ['ELECTRICAL', 'Electrical'],
    ['HVAC', 'Air conditioning'],
    ['ELEVATOR', 'Elevator'],
    ['APPLIANCE', 'Appliances'],
    ['STRUCTURAL', 'Structural'],
    ['CLEANING', 'Cleaning'],
    ['LANDSCAPING', 'Landscaping'],
    ['SECURITY', 'Security'],
    ['ACCESS', 'Access'],
    ['PARKING', 'Parking'],
    ['NOISE', 'Noise'],
    ['AMENITY', 'Amenities'],
    ['HANDOVER_SNAG', 'Handover snag'],
    ['WARRANTY', 'Warranty'],
    ['BILLING', 'Billing'],
    ['DOCUMENTS', 'Documents'],
    ['OTHER', 'Other'],
])

/** What a customer is told about, through `notify`. */
export type CaseNoticeKind = 'reply' | 'resolved' | 'closed'

export interface CaseNotice {
    kind: CaseNoticeKind
    /** The case, as saved. */
    case: any
    /** The reply, for `reply`. */
    comment?: any
}

/** A case to open: the columns of the project's model, `user_id` and `subject` at least. */
export interface CaseDraft {
    user_id: number | null
    subject: string
    description?: string | null
    kind?: string
    category?: string
    priority?: string
    /** APP, BACKOFFICE, SURVEY… Default 'APP'. */
    channel?: string
    [column: string]: unknown
}

/** The staff alerts in the back-office's bell. */
export interface CaseAlerts {
    /** A case is opened (not by staff). Default on. */
    created?: boolean
    /** The customer answers: to the assignee, else to whoever may handle cases. Default on. */
    customerReply?: boolean
    /** Someone else assigns a case to you. Default on. */
    assigned?: boolean
    /** A case goes past its first-answer or resolution time. Default on. */
    overdue?: boolean
}

export interface ETHCaseLeafConfig {
    /** The project's model names, when they differ from the defaults. */
    models?: Partial<CaseModelNames>
    /** The kinds of case ('MAINTENANCE'…). The SLA policies and canned replies are narrowed by them. */
    kinds?: CaseOption[]
    categories?: CaseOption[]
    priorities?: CaseOption[]
    /** The status names and colors staff read, when they differ from the leaf's. */
    statuses?: Partial<Record<string, { label?: string; color?: string }>>
    /** The customers' model, back-office collection and the field naming them. Default 'User' / 'users' / 'email'. */
    customers?: { model?: string; collection?: string; displayField?: string }
    /**
     * What a case is about (a unit): its column on the cases, declared by the
     * project's model. Shown in the back-office and in the conversation.
     */
    subject?: {
        /** Column on the cases: 'unit_id'. */
        field: string
        /** Its model: 'Unit'. */
        model?: string
        /** Its back-office collection: 'units'. */
        collection?: string
        displayField?: string
        /** 'Unit'. */
        label?: string
    }
    /** The name a staff reply is signed with in the app. Default: their first name, else "Customer care". */
    staffName?: (user: any) => string
    /** CASE-000123 on every case written without one. `false` leaves the reference to the project. */
    reference?: { prefix?: string; digits?: number } | false
    /**
     * Tells the customer: a staff reply, their case resolved, closed. Awaited;
     * its failure is logged and never fails the write. A write passing
     * `{ notify: false }` tells nobody (the customer did it themselves).
     */
    notify?: (notice: CaseNotice) => unknown
    /**
     * A case handled elsewhere (read from a CRM): returns why, and staff can
     * neither answer it nor change it here; no clock, no alert. Null otherwise.
     */
    readOnly?: (kase: any) => string | null | undefined
    /** The staff alerts; `false` turns them all off. Each is on by default. */
    alerts?: false | CaseAlerts
    /**
     * Files on staff messages: 'all' (the default), 'internal' (internal notes
     * only, while the app does not show them on replies) or false.
     */
    staffAttachments?: 'all' | 'internal' | false
    /** The media folders staff upload into (ETHMediaLeaf rules). Default ['case-attachments']. */
    attachmentFolders?: string[]
    /** Sends each case to an outside system (`components/sync`). */
    sync?: LeafSync
    /** Sends each message that is not internal (`components/sync`). */
    syncComments?: LeafSync
    /**
     * Opens a case from a survey answer (ETHSurveyLeaf): returns the case to
     * open, or null. Called once, when the answer comes in. Default: off.
     */
    fromSurvey?: (response: any) => CaseDraft | null | undefined | Promise<CaseDraft | null | undefined>
    /** The back-office the leaf registers. */
    admin?: {
        /** The sidebar group. Default 'Support'. */
        group?: string
        /** How staff call a case and its customer: 'Request' / 'Requests' / 'Owner'. Default 'Case' / 'Cases' / 'Customer'. */
        words?: { case?: string; cases?: string; customer?: string }
        /** Changes a collection before it is registered: returns it, changed or replaced. */
        extend?: (name: string, collection: any) => any
    }
}

/** The running leaf's config, for its controllers, hooks and services. */
export const state: { config: ETHCaseLeafConfig } = { config: {} }

/** The project's models, resolved by name: they exist once the database ran. */
export function caseModels(): Record<keyof CaseModelNames, any> {
    const names = { ...DEFAULT_MODELS, ...state.config.models }
    const registered = (etherial as any).database?.sequelize?.models ?? {}
    const resolved = {} as Record<keyof CaseModelNames, any>
    for (const [key, name] of Object.entries(names) as [keyof CaseModelNames, string][]) {
        const model = registered[name]
        if (!model) throw new Error(`[ETHCaseLeaf] No model "${name}": extend Base${key} in the project and register it`)
        resolved[key] = model
    }
    return resolved
}

/** A model of the project the config names (the customers', the subject's), or null. */
export function projectModel(name?: string | null): any {
    if (!name) return null
    return (etherial as any).database?.sequelize?.models?.[name] ?? null
}

export const kindsOf = () => state.config.kinds ?? DEFAULT_KINDS
export const categoriesOf = () => state.config.categories ?? DEFAULT_CATEGORIES
export const prioritiesOf = () => state.config.priorities ?? DEFAULT_PRIORITIES

export function customersOf() {
    const customers = state.config.customers ?? {}
    return { model: customers.model ?? 'User', collection: customers.collection ?? 'users', displayField: customers.displayField ?? 'email' }
}

/** The label of `value` among `list`, or the value itself. */
export const labelIn = (list: CaseOption[], value: string | null | undefined): string =>
    (value && list.find((o) => o.value === value)?.label) || value || ''

export function alertOn(kind: keyof CaseAlerts): boolean {
    const alerts = state.config.alerts
    if (alerts === false) return false
    return alerts?.[kind] !== false
}

/** Why staff cannot handle this case here, or null. */
export function readOnlyReason(kase: any): string | null {
    if (!kase || !state.config.readOnly) return null
    try {
        return state.config.readOnly(kase) || null
    } catch {
        return null
    }
}

export function staffNameOf(user: any): string {
    if (state.config.staffName) return state.config.staffName(user)
    return String(user?.first_name ?? user?.firstname ?? '').trim() || 'Customer care'
}

export function referenceOf(id: number): string | null {
    const reference = state.config.reference
    if (reference === false) return null
    return `${reference?.prefix ?? 'CASE-'}${String(id).padStart(reference?.digits ?? 6, '0')}`
}

/** Whether staff may put files on this message. */
export function attachmentsAllowed(internal: boolean): boolean {
    const allowed = state.config.staffAttachments ?? 'all'
    return allowed === 'all' || (allowed === 'internal' && internal)
}

export const attachmentFolders = () => state.config.attachmentFolders ?? ['case-attachments']

export function wordsOf() {
    const words = state.config.admin?.words ?? {}
    const kase = words.case ?? 'Case'
    return { case: kase, cases: words.cases ?? `${kase}s`, customer: words.customer ?? 'Customer' }
}
