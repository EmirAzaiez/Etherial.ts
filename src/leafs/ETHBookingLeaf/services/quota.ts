import { Op } from 'sequelize'

import { BookingAppointmentStatus } from '../models/BookingAppointment.js'
import { bookingModels, state, subjectWord } from './options.js'

/**
 * How many appointments a customer may hold, and how many they hold. The slots
 * say what a scheduler can receive; this says what one customer may take of
 * it, or one account books every seat of a day.
 *
 * - At once (`max_active_appointments`): upcoming appointments held together;
 *   one over, cancelled or honoured frees its place.
 * - In all (`max_appointments_total`): set to 1, "one handover, never two".
 *
 * Both count per subject (unit) and per scheduler, never per account: an
 * owner of two flats has two handovers to book, and "one handover" says
 * nothing of the site visit. Cancelled ones count nowhere (cancelling must not
 * cost the right); a no-show counts in the total.
 */

/** What a reached limit says, on both sides of the product. */
export interface QuotaIssue {
    /** The key the app translates. */
    code: string
    /** The same in a sentence, for the back-office's banner. */
    message: string
}

export interface QuotaState {
    /** Null when the scheduler sets none. */
    max_active: number | null
    active_count: number
    max_total: number | null
    used_count: number
    can_book: boolean
    issue: QuotaIssue | null
}

/** A limit typed in the back-office; 0 or below means none, so an emptied field doesn't close bookings. */
function toLimit(value: unknown): number | null {
    const n = Number(value)
    return Number.isInteger(n) && n > 0 ? n : null
}

function plural(count: number, word: string): string {
    return `${count} ${word}${count === 1 ? '' : 's'}`
}

/**
 * What this customer holds, and has left, under this scheduler: on this
 * subject when the appointment has one. `excludeAppointmentId` leaves out the
 * one being moved.
 */
export async function customerQuota(
    scheduler: any,
    userId: number,
    subjectId: number | null,
    options: { now?: Date; excludeAppointmentId?: number } = {}
): Promise<QuotaState> {
    const now = options.now ?? new Date()
    const maxActive = toLimit(scheduler.max_active_appointments)
    const maxTotal = toLimit(scheduler.max_appointments_total)
    const subjectField = state.config.subject?.field

    const scope = {
        user_id: userId,
        ...(subjectId && subjectField ? { [subjectField]: subjectId } : {}),
        scheduler_id: scheduler.id,
        ...(options.excludeAppointmentId ? { id: { [Op.ne]: options.excludeAppointmentId } } : {}),
    }

    // Nothing to ask when nothing is limited: the common case.
    if (!maxActive && !maxTotal) {
        return { max_active: null, active_count: 0, max_total: null, used_count: 0, can_book: true, issue: null }
    }

    const { BookingAppointment } = bookingModels()
    const [activeCount, usedCount]: number[] = await Promise.all([
        maxActive
            ? BookingAppointment.count({
                  // The end, not the start: one started ten minutes ago still holds the agent.
                  where: { ...scope, status: BookingAppointmentStatus.SCHEDULED, ends_at: { [Op.gte]: now } },
              })
            : Promise.resolve(0),
        maxTotal
            ? BookingAppointment.count({
                  where: {
                      ...scope,
                      status: { [Op.in]: [BookingAppointmentStatus.SCHEDULED, BookingAppointmentStatus.COMPLETED, BookingAppointmentStatus.NO_SHOW] },
                  },
              })
            : Promise.resolve(0),
    ])

    let issue: QuotaIssue | null = null

    // The scheduler is named in each sentence: the cap is its own, not the subject's.
    const reason = scheduler.label || `scheduler #${scheduler.id}`
    const on = subjectField ? ` on this ${subjectWord()}` : ''

    if (maxTotal && usedCount >= maxTotal) {
        issue = {
            code: 'api.appointments.visit_limit_reached',
            message:
                maxTotal === 1
                    ? `This customer has already had their "${reason}"${on}, and it allows one in all. Booking a second one needs "Book outside the rules".`
                    : `This customer has already used ${plural(usedCount, '"' + reason + '" visit')}${on}, and it allows ${maxTotal} in all.`,
        }
    } else if (maxActive && activeCount >= maxActive) {
        issue = {
            code: 'api.appointments.too_many_active',
            message:
                maxActive === 1
                    ? `This customer already has a "${reason}" coming up${on}, and it allows one at a time. Cancel that one, or wait until it is over.`
                    : `This customer already holds ${plural(activeCount, 'upcoming "' + reason + '" appointment')}${on}, and it allows ${maxActive} at a time.`,
        }
    }

    return { max_active: maxActive, active_count: activeCount, max_total: maxTotal, used_count: usedCount, can_book: !issue, issue }
}
