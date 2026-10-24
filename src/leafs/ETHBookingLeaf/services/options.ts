import etherial from 'etherial'
import type { LeafSync } from '../../../components/sync/index.js'
import { DEFAULT_WEEKEND } from './slots.js'

// ──────────────────────────────────────────────────────────────────────────
// What a project tells the booking leaf, and the defaults it falls back to.
// The leaf owns the engine, the rules and the back-office; the project owns
// its tables (it extends the leaf's base models), what a scheduler belongs to
// (a project), what an appointment is about (a unit) and how a customer is told.
// ──────────────────────────────────────────────────────────────────────────

export const SCHEDULERS_COLLECTION = 'schedulers'
export const WINDOWS_COLLECTION = 'scheduler-windows'
export const BLOCKS_COLLECTION = 'scheduler-blocks'
export const AGENTS_COLLECTION = 'agents'
export const APPOINTMENTS_COLLECTION = 'booking-appointments'
export const CALENDAR_PAGE = 'appointments-calendar'

/**
 * The field the shared back-office's slot picker reads the subject from (the
 * property at RETAL, where it was written). A project whose subject column has
 * another name adds a VIRTUAL `property_id` alias on its appointment model.
 */
export const BO_SUBJECT_FIELD = 'property_id'

/** The project's model names, as registered in Sequelize. */
export interface BookingModelNames {
    Scheduler: string
    SchedulerWindow: string
    SchedulerWindowHost: string
    SchedulerBlock: string
    Agent: string
    BookingAppointment: string
}

const DEFAULT_MODELS: BookingModelNames = {
    Scheduler: 'Scheduler',
    SchedulerWindow: 'SchedulerWindow',
    SchedulerWindowHost: 'SchedulerWindowHost',
    SchedulerBlock: 'SchedulerBlock',
    Agent: 'Agent',
    BookingAppointment: 'BookingAppointment',
}

/** What a customer is told about, through `notify`. */
export type BookingNoticeKind = 'confirmed' | 'rescheduled' | 'cancelled' | 'reminder_day_before' | 'reminder_soon'

export interface BookingNotice {
    kind: BookingNoticeKind
    /** The appointment, as saved. */
    appointment: any
    /** The zone to show its time in: the scheduler's, else the leaf's. */
    timezone: string
}

export interface ETHBookingLeafConfig {
    /** The zone the opening hours are written in: 'Asia/Dubai'. A scheduler may set its own. Default 'UTC'. */
    timezone?: string
    /**
     * The days a notice in working days skips, as `Date.getDay()` numbers:
     * [6, 0] Saturday and Sunday (the default), [5, 6] Friday and Saturday. A
     * scheduler may set its own.
     */
    weekend?: number[]
    /** The project's model names, when they differ from the defaults. */
    models?: Partial<BookingModelNames>
    /**
     * What a scheduler belongs to (a project): its column on the schedulers.
     * Without it, every scheduler is open to every customer.
     */
    scope?: {
        /** Column on the schedulers: 'project_id'. */
        field: string
        /** Its model, included when schedulers are read (the app shows its name): 'Project'. */
        model?: string
        /** Its back-office collection, for the relation field: 'projects'. */
        collection?: string
        displayField?: string
        secondaryField?: string
        /** 'Project'. */
        label?: string
        /** Under the scheduler's field in the back-office. */
        helpText?: string
    }
    /**
     * What an appointment is about (a unit): its column on the appointments.
     * The subject's own `scopeField` tells which schedulers govern it.
     */
    subject?: {
        /** Column on the appointments: 'unit_id'. */
        field: string
        /** Its model: 'Unit'. */
        model: string
        /** Column on the subject naming its scope: 'project_id'. */
        scopeField?: string
        /** Its back-office collection: 'units'. */
        collection?: string
        displayField?: string
        secondaryField?: string
        /** 'Unit'. */
        label?: string
        /** Said to staff when a subject has no scope: "Run the Salesforce sync." */
        noScopeHint?: string
    }
    /** The customers' model, back-office collection and the field naming them. Default 'User' / 'users' / 'email'. */
    customers?: { model?: string; collection?: string; displayField?: string }
    /**
     * Tells the customer: booked, moved, cancelled by someone else, and the
     * reminders. Runs in the background; its failure never fails the write.
     */
    notify?: (notice: BookingNotice) => unknown
    /**
     * Reminders through `notify`: the day before (24 hours ahead) and shortly
     * before (2 hours ahead by default). Each goes out once, and only while it
     * is still ahead: a booking made an hour before gets neither.
     * Default: off.
     */
    reminders?: { dayBefore?: boolean; soon?: boolean; soonHours?: number }
    /**
     * Tells staff in the back-office, once a day at `hour` (local), how many
     * appointments ended without being marked completed or no-show. Default: off.
     */
    overdue?: { hour?: number }
    /** Sends each appointment to an outside system (`components/sync`). */
    sync?: LeafSync
    /** The back-office the leaf registers. */
    admin?: {
        /** The sidebar group. Default 'Scheduling'. */
        group?: string
        /**
         * Changes a collection before it is registered (an action, a field, an
         * assistant of the project's): returns it, changed or replaced.
         */
        extend?: (name: string, collection: any) => any
    }
}

/** The running leaf's config, for its controllers, hooks and services. */
export const state: { config: ETHBookingLeafConfig } = { config: {} }

export const timezoneOf = (scheduler?: { timezone?: string | null } | null): string =>
    scheduler?.timezone || state.config.timezone || 'UTC'

export const weekendOf = (scheduler?: { weekend_days?: number[] | null } | null): number[] =>
    scheduler?.weekend_days ?? state.config.weekend ?? DEFAULT_WEEKEND

/** The project's models, resolved by name: they exist once the database ran. */
export function bookingModels(): Record<keyof BookingModelNames, any> {
    const names = { ...DEFAULT_MODELS, ...state.config.models }
    const registered = (etherial as any).database?.sequelize?.models ?? {}
    const resolved = {} as Record<keyof BookingModelNames, any>
    for (const [key, name] of Object.entries(names) as [keyof BookingModelNames, string][]) {
        const model = registered[name]
        if (!model) throw new Error(`[ETHBookingLeaf] No model "${name}": extend Base${key} in the project and register it`)
        resolved[key] = model
    }
    return resolved
}

/** A model of the project the config names (the scope's, the subject's), or null. */
export function projectModel(name?: string | null): any {
    if (!name) return null
    return (etherial as any).database?.sequelize?.models?.[name] ?? null
}

const lower = (label: string | undefined, fallback: string) => (label || fallback).toLowerCase()

/** "unit", "project": the words of the staff messages. */
export const subjectWord = () => lower(state.config.subject?.label, 'subject')
export const scopeWord = () => lower(state.config.scope?.label, 'project')

/** The name an association from `model` to `target` goes by ('unit', 'user'), or null. */
export function associationTo(model: any, target: any): string | null {
    if (!model || !target) return null
    for (const [as, association] of Object.entries<any>(model.associations ?? {})) {
        if (association.target === target) return as
    }
    return null
}

/** The attributes of `model` among `names`: an include asks only for columns that exist. */
export function attributesOf(model: any, names: string[]): string[] {
    const known = model?.rawAttributes ?? {}
    return names.filter((name) => name in known)
}
