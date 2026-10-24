import { Op, UniqueConstraintError } from 'sequelize'

import { BookingAppointmentStatus } from '../models/BookingAppointment.js'
import { bookingModels, projectModel, scopeWord, state, subjectWord, timezoneOf, weekendOf } from './options.js'
import {
    BookingBlock,
    BookingHost,
    BookingWindow,
    BusyInterval,
    ComputeSlotsInput,
    Slot,
    SlotPolicy,
    computeSlots,
    openHostsAt,
    zonedDayKey,
    zonedTimeToUtc,
    zonedParts,
} from './slots.js'

/**
 * Reads the database and builds the engine's input. The engine (`slots.ts`)
 * never touches Sequelize; everything that does is here, so a booking replays
 * the exact computation right before it writes.
 */

/** The diary is read a day wider on each side: an appointment that runs over midnight still counts. */
const DIARY_MARGIN_MS = 24 * 3600 * 1000

/**
 * What decides the schedulers: the scope's id (a project's), or a record
 * holding it (a unit, `{ project_id }`), read from the subject's `scopeField`
 * or the scope's `field`.
 */
export type BookingScope = number | null | undefined | Record<string, any>

export function scopeIdOf(scope: BookingScope): number | null {
    if (scope === null || scope === undefined) return null
    if (typeof scope === 'number') return scope
    const field = state.config.subject?.scopeField ?? state.config.scope?.field
    return field ? (scope[field] ?? null) : null
}

/** The schedulers this scope offers, before any is judged open or closed. */
async function schedulersOf(scope: BookingScope): Promise<any[] | null> {
    const { Scheduler } = bookingModels()
    const scopeConfig = state.config.scope
    let where = {}
    if (scopeConfig) {
        const id = scopeIdOf(scope)
        if (!id) return null
        where = { [scopeConfig.field]: id }
    }
    const scopeModel = projectModel(scopeConfig?.model)
    return Scheduler.findAll({
        where,
        include: scopeModel ? [{ model: scopeModel }] : [],
        order: [
            ['label', 'ASC'],
            ['id', 'ASC'],
        ],
    })
}

/** Whether a scheduler takes bookings today. */
function isSchedulerOpen(scheduler: any, options: { now?: Date; forMobile?: boolean } = {}): boolean {
    if (!scheduler.active) return false
    if (options.forMobile !== false && !scheduler.show_in_mobile_app) return false

    const today = zonedDayKey(options.now ?? new Date(), timezoneOf(scheduler))
    // `YYYY-MM-DD` strings order like the dates they name.
    return !(scheduler.ends_on && today > scheduler.ends_on)
}

/**
 * The reasons to meet open to this scope, in a stable order (label, then id)
 * so the list doesn't move under the customer's finger. Left out: switched
 * off, hidden from the app, or past their last day. Nothing about
 * `starts_on`: booking in August for September is what a visit period allows;
 * the engine offers no day before it.
 */
export async function resolveSchedulers(scope: BookingScope, options: { now?: Date; forMobile?: boolean } = {}): Promise<any[]> {
    const schedulers = await schedulersOf(scope)
    return (schedulers ?? []).filter((scheduler) => isSchedulerOpen(scheduler, options))
}

/**
 * One scheduler, if it governs this scope and is open. Every route taking a
 * `scheduler_id` from a phone goes through here: a guessed id would otherwise
 * reach another project's scheduler.
 */
export async function resolveSchedulerById(scope: BookingScope, schedulerId: any, options: { now?: Date; forMobile?: boolean } = {}): Promise<any | null> {
    const id = Number(schedulerId)
    if (!Number.isInteger(id) || id <= 0) return null
    const schedulers = await resolveSchedulers(scope, options)
    return schedulers.find((scheduler) => scheduler.id === id) ?? null
}

/** A name to read in a staff message, never a bare id. */
export function schedulerLabel(scheduler: any): string {
    return scheduler.label || `Scheduler #${scheduler.id}`
}

/** A scheduler, and what closes it today if it is closed. */
export interface StaffScheduler {
    scheduler: any
    closedReason: string | null
}

/** "This unit's project", "This calendar": who owns the schedulers, in staff messages. */
const ownerPhrase = () => (state.config.scope ? `This ${subjectWord()}'s ${scopeWord()}` : 'The calendar')

/**
 * The same schedulers seen from the back-office: found first, judged after.
 * The app only needs them gone; staff need the reason ("it opens on the
 * 19th"), or a closed scheduler reads as a bug. A closed one stays usable, to
 * book outside the rules; finding none can't be forced: there are no rules.
 * `show_in_mobile_app` closes the app, not the back-office.
 */
export async function resolveSchedulersForStaff(scope: BookingScope, options: { now?: Date } = {}): Promise<{ schedulers: StaffScheduler[]; missingReason: string | null }> {
    const rows = await schedulersOf(scope)

    if (!rows) {
        const hint = state.config.subject?.noScopeHint
        return {
            schedulers: [],
            missingReason: `This ${subjectWord()} is attached to no ${scopeWord()} yet, so no scheduler can govern it.${hint ? ` ${hint}` : ''}`,
        }
    }

    if (rows.length === 0) {
        return {
            schedulers: [],
            missingReason: `${ownerPhrase()} has no scheduler yet — create one under Scheduling to decide its opening hours.`,
        }
    }

    return {
        schedulers: rows.map((scheduler) => {
            const name = schedulerLabel(scheduler)
            const today = zonedDayKey(options.now ?? new Date(), timezoneOf(scheduler))

            if (!scheduler.active) {
                return { scheduler, closedReason: `"${name}" is deactivated, so it offers nothing.` }
            }
            // `starts_on` closes nothing: it says when visits start, not when bookings open.
            if (scheduler.ends_on && today > scheduler.ends_on) {
                return { scheduler, closedReason: `"${name}" held its last visit on ${scheduler.ends_on}, so its calendar is over.` }
            }
            return { scheduler, closedReason: null }
        }),
        missingReason: null,
    }
}

/**
 * The scheduler the back-office works on. Without `schedulerId`, a scope with
 * one scheduler doesn't ask; with several, picking one would book the wrong
 * team with the wrong notice: it says so instead of guessing.
 */
export async function resolveSchedulerForStaff(scope: BookingScope, schedulerId?: any, options: { now?: Date } = {}): Promise<{ scheduler: any | null; closedReason: string | null }> {
    const { schedulers, missingReason } = await resolveSchedulersForStaff(scope, options)

    if (missingReason) return { scheduler: null, closedReason: missingReason }

    const asked = Number(schedulerId)

    if (Number.isInteger(asked) && asked > 0) {
        const found = schedulers.find((entry) => entry.scheduler.id === asked)
        return (
            found ?? {
                scheduler: null,
                closedReason: state.config.scope
                    ? `That reason belongs to another ${scopeWord()} — pick one of this ${subjectWord()}'s.`
                    : 'That reason no longer exists — pick another one.',
            }
        )
    }

    if (schedulers.length === 1) return schedulers[0]

    return {
        scheduler: null,
        closedReason: `${ownerPhrase()} offers ${schedulers.length} reasons to meet (${schedulers
            .map((entry) => schedulerLabel(entry.scheduler))
            .join(', ')}) — pick the one this appointment is for.`,
    }
}

export function policyOf(scheduler: any): SlotPolicy {
    return {
        leadTimeDays: scheduler.lead_time_days,
        leadTimeWorkingDays: scheduler.lead_time_working_days,
        horizonDays: scheduler.horizon_days,
        // The scheduler's dates bound the visits, nothing else: "from 10
        // September to 10 October" never meant "book only in September".
        visitsFrom: scheduler.starts_on || null,
        visitsTo: scheduler.ends_on || null,
        weekend: weekendOf(scheduler),
    }
}

/**
 * Whether this start falls outside the visit period, and why. The engine
 * offers nothing there, so only an appointment forced by hand lands there;
 * "nothing is open at that time" would send staff looking for hours or a
 * holiday when the whole calendar is elsewhere.
 */
export function visitPeriodIssue(scheduler: any, start: Date): string | null {
    const day = zonedDayKey(start, timezoneOf(scheduler))
    const name = schedulerLabel(scheduler)

    if (scheduler.starts_on && day < scheduler.starts_on) {
        return `"${name}" holds no visit before ${scheduler.starts_on}, and this one falls on ${day}.`
    }
    if (scheduler.ends_on && day > scheduler.ends_on) {
        return `"${name}" holds no visit after ${scheduler.ends_on}, and this one falls on ${day}.`
    }
    return null
}

/**
 * Everything the engine needs for a scheduler over a range. Blocks and the
 * diary are read a day wider on each side: a holiday on the 3rd closes the
 * 3rd even when asked from 08:00, and an appointment started at 23:30 the day
 * before bites into the next one.
 *
 * `excludeAppointmentId` leaves one appointment out of the diary: the one
 * being moved must not forbid itself the next slot, nor its own time.
 */
export async function loadEngineInput(
    scheduler: any,
    range: { from: Date; to: Date; now: Date; excludeAppointmentId?: number }
): Promise<Omit<ComputeSlotsInput, 'from' | 'to' | 'limit'>> {
    const { SchedulerWindow, SchedulerWindowHost, SchedulerBlock, Agent, BookingAppointment } = bookingModels()
    const tz = timezoneOf(scheduler)

    const windowRows: any[] = await SchedulerWindow.findAll({
        where: { scheduler_id: scheduler.id },
        order: [['start_minute', 'ASC']],
    })

    // Each window's staff in one query. An inactive agent keeps their
    // assignments, they just take no more appointments.
    const assignmentRows: any[] = windowRows.length
        ? await SchedulerWindowHost.findAll({
              where: { scheduler_window_id: { [Op.in]: windowRows.map((w) => w.id) } },
              include: [{ model: Agent, where: { active: true }, required: true }],
          })
        : []

    const assignments = new Map<number, number[]>()
    for (const row of assignmentRows) {
        const list = assignments.get(row.scheduler_window_id)
        if (list) list.push(row.agent_id)
        else assignments.set(row.scheduler_window_id, [row.agent_id])
    }

    // The scheduler's staff is the union of its windows'. The capacity comes
    // from the agent: one who receives three customers at once stays offered
    // while they hold fewer than three.
    const capacities = new Map<number, number>()
    for (const row of assignmentRows) {
        if (row.agent) capacities.set(row.agent_id, row.agent.max_concurrent_appointments)
    }

    const hosts: BookingHost[] = [...new Set(assignmentRows.map((row) => row.agent_id as number))].map((id) => ({
        id,
        capacity: capacities.get(id) ?? 1,
    }))

    if (hosts.length === 0) {
        return { tz, hosts: [], windows: [], blocks: [], busy: [], policy: policyOf(scheduler), now: range.now }
    }

    const agentIds = hosts.map((h) => h.id)
    const diaryFrom = new Date(range.from.getTime() - DIARY_MARGIN_MS)
    const diaryTo = new Date(range.to.getTime() + DIARY_MARGIN_MS)

    const [blockRows, busyRows]: [any[], any[]] = await Promise.all([
        SchedulerBlock.findAll({
            where: {
                day: { [Op.between]: [zonedDayKey(diaryFrom, tz), zonedDayKey(diaryTo, tz)] },
                // `null` on either side means "applies to all".
                [Op.and]: [
                    { [Op.or]: [{ scheduler_id: scheduler.id }, { scheduler_id: null }] },
                    { [Op.or]: [{ agent_id: { [Op.in]: agentIds } }, { agent_id: null }] },
                ],
            },
        }),
        BookingAppointment.findAll({
            where: {
                agent_id: { [Op.in]: agentIds },
                status: BookingAppointmentStatus.SCHEDULED,
                starts_at: { [Op.between]: [diaryFrom, diaryTo] },
                ...(range.excludeAppointmentId ? { id: { [Op.ne]: range.excludeAppointmentId } } : {}),
            },
            attributes: ['id', 'agent_id', 'starts_at', 'ends_at', 'scheduler_id'],
        }),
    ])

    // A "Tuesday and Thursday" row becomes one window per day: the engine
    // reasons on a single day.
    const windows: BookingWindow[] = windowRows.flatMap((w) =>
        (w.weekdays as number[]).map((weekday) => ({
            weekday,
            start_minute: w.start_minute,
            end_minute: w.end_minute,
            duration_minutes: w.duration_minutes,
            slot_step_minutes: w.slot_step_minutes,
            gap_minutes: w.gap_minutes,
            max_per_day: w.max_per_day ?? null,
            host_ids: assignments.get(w.id) ?? [],
        }))
    )

    const blocks: BookingBlock[] = blockRows.map((b) => ({
        host_id: b.agent_id ?? null,
        // DATEONLY comes back as `YYYY-MM-DD` on Postgres; a stray Date would shift the day.
        day: typeof b.day === 'string' ? b.day : zonedDayKey(new Date(b.day), tz),
        start_minute: b.start_minute ?? null,
        end_minute: b.end_minute ?? null,
    }))

    const busy: BusyInterval[] = busyRows.map((a) => ({
        host_id: a.agent_id,
        start: new Date(a.starts_at).getTime(),
        end: new Date(a.ends_at).getTime(),
        // An agent's appointments elsewhere fill their diary, not this scheduler's cap.
        counts_for_cap: a.scheduler_id === scheduler.id,
    }))

    return { tz, hosts, windows, blocks, busy, policy: policyOf(scheduler), now: range.now }
}

/**
 * The scheduler's staff: the union of the active agents named on its
 * windows. There is no other list: offering the whole directory would let
 * staff pick someone who doesn't work there.
 */
export async function schedulerRoster(scheduler: any): Promise<any[]> {
    const { SchedulerWindow, SchedulerWindowHost, Agent } = bookingModels()
    const windows: any[] = await SchedulerWindow.findAll({ where: { scheduler_id: scheduler.id }, attributes: ['id'] })

    if (windows.length === 0) return []

    const rows: any[] = await SchedulerWindowHost.findAll({
        where: { scheduler_window_id: { [Op.in]: windows.map((w) => w.id) } },
        include: [{ model: Agent, where: { active: true }, required: true }],
    })

    const byId = new Map<number, any>()
    for (const row of rows) if (row.agent) byId.set(row.agent.id, row.agent)
    return [...byId.values()]
}

/** A name to read on screen, never a bare id. */
export function agentLabel(agent: any): string {
    return [agent.first_name, agent.last_name].filter(Boolean).join(' ').trim() || agent.email || `#${agent.id}`
}

/** A scheduler's slots over a range. */
export async function getSlots(scheduler: any, range: { from: Date; to: Date; now?: Date; limit?: number; excludeAppointmentId?: number }): Promise<Slot[]> {
    const now = range.now ?? new Date()
    const input = await loadEngineInput(scheduler, { from: range.from, to: range.to, now, excludeAppointmentId: range.excludeAppointmentId })
    return computeSlots({ ...input, from: range.from, to: range.to, limit: range.limit })
}

/**
 * The agents still free at this exact start, and the length its window gives
 * it: the check replayed before writing. No host: the slot went between the
 * display and the submit.
 */
export async function availableHostsAt(
    scheduler: any,
    start: Date,
    options: { now?: Date; excludeAppointmentId?: number } = {}
): Promise<{ host_ids: number[]; duration_minutes: number }> {
    const input = await loadEngineInput(scheduler, {
        from: new Date(start.getTime() - DIARY_MARGIN_MS),
        to: new Date(start.getTime() + DIARY_MARGIN_MS),
        now: options.now ?? new Date(),
        excludeAppointmentId: options.excludeAppointmentId,
    })
    return openHostsAt(input, start)
}

/** The UTC bounds of a local day `YYYY-MM-DD`. */
export function localDayRange(day: string, tz: string = timezoneOf()): { from: Date; to: Date } | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim())
    if (!match) return null

    const [, y, m, d] = match
    const from = zonedTimeToUtc(Number(y), Number(m), Number(d), 0, tz)
    return { from, to: new Date(from.getTime() + 86400000) }
}

/**
 * The agent to give the appointment to among those still free: the one with
 * the fewest that day, ties going to the first, so it is reproducible.
 */
export async function pickHost(candidateIds: number[], start: Date, tz: string = timezoneOf()): Promise<number | null> {
    if (candidateIds.length === 0) return null
    if (candidateIds.length === 1) return candidateIds[0]

    const parts = zonedParts(start, tz)
    const dayStart = zonedTimeToUtc(parts.year, parts.month, parts.day, 0, tz)
    const dayEnd = new Date(dayStart.getTime() + 86400000)

    const sameDay: any[] = await bookingModels().BookingAppointment.findAll({
        where: {
            agent_id: { [Op.in]: candidateIds },
            status: BookingAppointmentStatus.SCHEDULED,
            starts_at: { [Op.gte]: dayStart, [Op.lt]: dayEnd },
        },
        attributes: ['agent_id'],
    })

    const load = new Map<number, number>()
    for (const id of candidateIds) load.set(id, 0)
    for (const a of sameDay) load.set(a.agent_id, (load.get(a.agent_id) ?? 0) + 1)

    return candidateIds.reduce((best, id) => ((load.get(id) ?? 0) < (load.get(best) ?? 0) ? id : best), candidateIds[0])
}

/**
 * The partial unique index against double booking (see `BaseBookingAppointment`):
 * its name tells "this seat was just taken" from any other unique violation.
 */
export const SEAT_CONSTRAINT = 'booking_appointments_agent_slot_unique'

/** How many appointments this agent holds at once. */
export async function capacityOf(agentId: number): Promise<number> {
    const agent = await bookingModels().Agent.findByPk(agentId, { attributes: ['id', 'max_concurrent_appointments'] })
    return Math.max(1, Math.floor(agent?.max_concurrent_appointments ?? 1))
}

/**
 * The agent's free seats at this exact start, in order: seats 0 to n-1 for an
 * agent receiving n customers at once, and the unique index is on (agent,
 * start, seat). Empty: full. A cancelled appointment gives its seat back.
 */
export async function freeSeatsAt(agentId: number, start: Date, excludeAppointmentId?: number): Promise<number[]> {
    const [capacity, taken] = await Promise.all([
        capacityOf(agentId),
        bookingModels().BookingAppointment.findAll({
            where: {
                agent_id: agentId,
                starts_at: start,
                status: BookingAppointmentStatus.SCHEDULED,
                ...(excludeAppointmentId ? { id: { [Op.ne]: excludeAppointmentId } } : {}),
            },
            attributes: ['slot_seat'],
        }) as Promise<any[]>,
    ])

    const occupied = new Set(taken.map((a) => a.slot_seat))
    const free: number[] = []
    for (let seat = 0; seat < capacity; seat++) {
        if (!occupied.has(seat)) free.push(seat)
    }
    return free
}

/**
 * How many of this agent's appointments bite into this interval, and the
 * first one to name it: the engine's count for the paths that write without
 * it (the back-office, which may book outside the opening hours).
 */
export async function overlappingAppointments(agentId: number, start: Date, end: Date, excludeAppointmentId?: number): Promise<{ count: number; first: any | null }> {
    const rows: any[] = await bookingModels().BookingAppointment.findAll({
        where: {
            agent_id: agentId,
            status: BookingAppointmentStatus.SCHEDULED,
            starts_at: { [Op.lt]: end },
            ends_at: { [Op.gt]: start },
            ...(excludeAppointmentId ? { id: { [Op.ne]: excludeAppointmentId } } : {}),
        },
        order: [['starts_at', 'ASC']],
    })
    return { count: rows.length, first: rows[0] ?? null }
}

/**
 * Writes the appointment on the agent's first free seat. Two simultaneous
 * bookings may both pass the availability check; the database lets one win a
 * given seat, and the loop (bounded by the capacity) takes the next. `null`:
 * every seat is gone, the caller answers 409.
 */
export async function createAppointmentInSeat(payload: Record<string, unknown> & { agent_id: number; starts_at: Date }, options: Record<string, unknown> = {}): Promise<any | null> {
    for (const seat of await freeSeatsAt(payload.agent_id, payload.starts_at)) {
        try {
            return await bookingModels().BookingAppointment.create({ ...payload, slot_seat: seat }, options)
        } catch (error) {
            if (!(error instanceof UniqueConstraintError)) throw error
            // Another unique violation is not a taken seat. A missing name is
            // read as ours, as the callers always did.
            const constraint = (error as any)?.parent?.constraint
            if (constraint && constraint !== SEAT_CONSTRAINT) throw error
        }
    }
    return null
}
