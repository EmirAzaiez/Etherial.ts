import { BookingAppointmentStatus } from '../models/BookingAppointment.js'
import { bookingModels, projectModel, state, subjectWord, timezoneOf } from './options.js'
import { customerQuota } from './quota.js'
import {
    agentLabel,
    availableHostsAt,
    capacityOf,
    freeSeatsAt,
    overlappingAppointments,
    pickHost,
    resolveSchedulerForStaff,
    visitPeriodIssue,
} from './repository.js'

/**
 * Booking from the back-office. Staff must be able to book by hand (the
 * customer called, has no app), but by hand doesn't mean beside the engine:
 * the form fills what the phone fills, and the same computation decides, or
 * the back-office would be the one way to book an impossible appointment.
 *
 * The form gives the customer, the subject or the scheduler, the start, maybe
 * the agent. The end and the length follow from the slot, never typed.
 *
 * `override_rules` is the one way out, and an explicit one: it lifts what the
 * engine refuses (outside the hours or the visit period, an agent not holding
 * those hours, a customer past their quota), the very cases staff pick up the
 * phone for. It never lifts an agent's capacity: two appointments on someone
 * who takes one is not a decision, it is a mistake.
 */

/** Ticked in the form: book outside the rules. A form field, never a column. */
export const OVERRIDE_FIELD = 'override_rules'

/** The length when a forced slot falls in no window. */
export const FALLBACK_DURATION_MINUTES = 60

type Input = Record<string, any>

function asId(value: unknown): number | null {
    const n = Number(value)
    return Number.isInteger(n) && n > 0 ? n : null
}

function isTicked(value: unknown): boolean {
    return value === true || value === 'true' || value === 1 || value === '1'
}

/** The customers' model: `customers.model`, else 'User'. */
export const customerModel = () => projectModel(state.config.customers?.model ?? 'User')

/**
 * Turns the back-office's input into a valid appointment, or says why it
 * isn't one, in a sentence read in the form's red banner: what blocks and what
 * is left to do.
 */
export async function prepareAdminBooking(data: Input): Promise<Input> {
    const { Scheduler, Agent } = bookingModels()
    const subject = state.config.subject
    const scopeConfig = state.config.scope

    const override = isTicked(data[OVERRIDE_FIELD])
    delete data[OVERRIDE_FIELD]

    // The shared back-office's slot picker sends the subject as `property_id`.
    const userId = asId(data.user_id)
    const subjectId = subject ? asId(data[subject.field] ?? data.property_id) : null
    if (subject?.field !== 'property_id') delete data.property_id
    const schedulerId = asId(data.scheduler_id)

    if (!userId) throw new Error('Pick the customer this appointment is for.')
    if (!subjectId && !schedulerId) throw new Error(subject ? `Pick the ${subjectWord()} the appointment is about, or its reason.` : 'Pick the reason for the appointment.')

    const start = new Date(data.starts_at)
    if (!data.starts_at || Number.isNaN(start.getTime())) {
        throw new Error('Pick the day and time the appointment starts.')
    }

    const Customer = customerModel()
    const SubjectModel = subject ? projectModel(subject.model) : null
    const [user, unit] = await Promise.all([Customer ? Customer.findByPk(userId) : { id: userId }, subjectId && SubjectModel ? SubjectModel.findByPk(subjectId) : null])

    if (!user) throw new Error('That customer no longer exists.')
    if (subjectId && !unit) throw new Error(`That ${subjectWord()} no longer exists.`)

    // Without a subject, the scheduler says which scope it is: a sales visit has no flat yet.
    let scopeId: number | null = null
    if (unit) {
        scopeId = unit[subject?.scopeField ?? scopeConfig?.field ?? ''] ?? null
    } else if (scopeConfig) {
        const owner = await Scheduler.findByPk(schedulerId as number, { attributes: ['id', scopeConfig.field] })
        if (!owner) throw new Error('That reason for the appointment no longer exists.')
        scopeId = owner[scopeConfig.field] ?? null
    }

    // "Show in mobile app" closes the phone, not the back-office. The rest
    // (switched off, period not open yet) closes bookings but can be forced:
    // the customer taken on the phone before the official opening. Several
    // schedulers: the form picks one, guessing would book the other's rules.
    const { scheduler, closedReason } = await resolveSchedulerForStaff(scopeId, schedulerId)

    if (!scheduler) {
        // Nothing to force: without a scheduler there are no rules, no length, no staff.
        throw new Error(closedReason || `This ${subjectWord()} is governed by no scheduler.`)
    }

    if (closedReason && !override) {
        throw new Error(`${closedReason} Tick "Book outside the rules" to book it anyway.`)
    }

    // First, as the engine can't name it: outside the period it offers nothing at all.
    const outsidePeriod = visitPeriodIssue(scheduler, start)
    if (outsidePeriod && !override) {
        throw new Error(`${outsidePeriod} Pick a day inside its visit period, or tick "Book outside the rules".`)
    }

    // The customer's cap is a rule like the others: a second visit is the exception taken on the phone.
    if (!override) {
        const quota = await customerQuota(scheduler, user.id, unit?.id ?? null)
        if (quota.issue) {
            throw new Error(
                quota.issue.message.includes('Book outside the rules') ? quota.issue.message : `${quota.issue.message} Tick "Book outside the rules" to book it anyway.`
            )
        }
    }

    // The engine, played exactly as for a customer: who is free at that instant, and for how long.
    const opening = await availableHostsAt(scheduler, start)
    const askedAgentId = asId(data.agent_id)

    let duration = opening.duration_minutes
    let agentId: number | null = null

    if (opening.host_ids.length === 0) {
        if (!override) {
            throw new Error(
                'Nothing is open at that exact time — it falls outside the opening hours, too close to now, on a closure, or every employee is already taken. ' +
                    'Pick another time, or tick "Book outside the rules".'
            )
        }
        // Outside any window the engine knows neither who nor how long.
        if (!askedAgentId) {
            throw new Error('Nothing is open at that time, so there is nobody to pick automatically — name the employee yourself.')
        }
        duration = asId(data.duration_minutes) || FALLBACK_DURATION_MINUTES
        agentId = askedAgentId
    } else if (askedAgentId) {
        if (!override && !opening.host_ids.includes(askedAgentId)) {
            const agent = await Agent.findByPk(askedAgentId)
            throw new Error(
                `${agent ? agentLabel(agent) : 'That employee'} does not hold that time, or is already taken. ` +
                    'Leave the employee empty to let the least loaded free one take it, or tick "Book outside the rules".'
            )
        }
        agentId = askedAgentId
        if (override) duration = asId(data.duration_minutes) || duration || FALLBACK_DURATION_MINUTES
    } else {
        // The least loaded free one that day, as for a booking from the app.
        agentId = await pickHost(opening.host_ids, start, timezoneOf(scheduler))
        if (!agentId) {
            throw new Error('The slot was taken while the form was open. Reload and pick another time.')
        }
    }

    const agent = await Agent.findByPk(agentId as number)
    if (!agent) throw new Error('That employee no longer exists.')
    if (!agent.active && !override) {
        throw new Error(`${agentLabel(agent)} is deactivated. Reactivate them, pick someone else, or tick "Book outside the rules".`)
    }

    const end = new Date(start.getTime() + duration * 60000)

    // Overlapping is a fault only beyond what the agent takes at once, rules or not.
    const capacity = await capacityOf(agent.id)
    const { count, first } = await overlappingAppointments(agent.id, start, end)

    if (count >= capacity) {
        throw new Error(
            `${agentLabel(agent)} already has ${count} appointment${count > 1 ? 's' : ''} at that time ` +
                `(from ${new Date(first.starts_at).toISOString()}), which is all they can take at once. ` +
                'Raise "Concurrent appointments" on their profile, or pick someone else.'
        )
    }

    // The seat: the check above looks at the whole interval, the index at the exact start.
    const seats = await freeSeatsAt(agent.id, start)
    if (seats.length === 0) {
        throw new Error(`${agentLabel(agent)} has no free place left at that exact time. Pick another time or someone else.`)
    }

    return {
        ...data,
        user_id: user.id,
        ...(subject ? { [subject.field]: unit?.id ?? null } : {}),
        agent_id: agent.id,
        scheduler_id: scheduler.id,
        starts_at: start,
        ends_at: end,
        duration_minutes: duration,
        slot_seat: seats[0],
        status: BookingAppointmentStatus.SCHEDULED,
        reschedule_count: 0,
    }
}

/**
 * What an edit may not touch: moving an appointment, or changing its customer
 * or subject, makes another one, and a direct edit would skip every check
 * above. The customer moves it from the app; staff cancel and book again.
 */
function immutableOnUpdate(): { field: string; why: string }[] {
    const subjectField = state.config.subject?.field
    const subjectWhy = `the ${subjectWord()} is what decided which scheduler applied`
    return [
        { field: 'user_id', why: 'a different customer means a different appointment' },
        ...(subjectField && subjectField !== 'property_id' ? [{ field: subjectField, why: subjectWhy }] : []),
        { field: 'property_id', why: subjectWhy },
        { field: 'starts_at', why: 'cancel this one and book again, so the slot is checked' },
        { field: 'ends_at', why: 'it follows the start and the length' },
        { field: 'duration_minutes', why: 'it was fixed by the opening that held the slot' },
        { field: 'scheduler_id', why: 'it was fixed at booking time' },
    ]
}

function changed(before: unknown, after: unknown): boolean {
    if (after === undefined) return false
    if (before instanceof Date) return new Date(after as string).getTime() !== before.getTime()
    return String(after ?? '') !== String(before ?? '')
}

/**
 * Guards the edit of an appointment: the form shows the status, the agent and
 * the notes, this guards the route, which takes any field of the body.
 */
export async function guardAppointmentUpdate(record: any, data: Input): Promise<Input> {
    for (const { field, why } of immutableOnUpdate()) {
        if (changed(record[field], data[field])) {
            throw new Error(`"${field}" cannot be changed on an existing appointment — ${why}.`)
        }
        delete data[field]
    }

    // Cancelled through the status list: dated and explained like the action does.
    if (data.status === BookingAppointmentStatus.CANCELLED && record.status !== BookingAppointmentStatus.CANCELLED) {
        if (!data.cancelled_at && !record.cancelled_at) data.cancelled_at = new Date()
        if (!data.cancellation_reason && !record.cancellation_reason) {
            data.cancellation_reason = 'Cancelled from the admin panel'
        }
    }

    const nextAgentId = asId(data.agent_id)

    if (nextAgentId && nextAgentId !== record.agent_id) {
        const agent = await bookingModels().Agent.findByPk(nextAgentId)
        if (!agent) throw new Error('That employee no longer exists.')

        // Free at that moment, as the form promises: their diary, not their
        // opening hours. Giving it to someone off that window is a team's call.
        const capacity = await capacityOf(agent.id)
        const { count, first } = await overlappingAppointments(agent.id, record.starts_at, record.ends_at, record.id)

        if (count >= capacity) {
            throw new Error(
                `${agentLabel(agent)} already has ${count} appointment${count > 1 ? 's' : ''} at that time ` + `(#${first.id}), which is all they can take at once.`
            )
        }

        // The seat belonged to the former agent's diary.
        const seats = await freeSeatsAt(agent.id, record.starts_at, record.id)
        if (seats.length === 0) {
            throw new Error(`${agentLabel(agent)} has no free place left at that exact time.`)
        }
        data.slot_seat = seats[0]
    }

    return data
}
