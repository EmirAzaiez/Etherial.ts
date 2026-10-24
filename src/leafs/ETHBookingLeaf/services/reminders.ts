import etherial from 'etherial'
import { Op } from 'sequelize'

import { runExclusive } from '../../../components/database/lock.js'
import { BookingAppointmentStatus } from '../models/BookingAppointment.js'
import { notifyCustomer } from './notices.js'
import { APPOINTMENTS_COLLECTION, bookingModels, state, timezoneOf, type BookingNoticeKind } from './options.js'
import { zonedParts } from './slots.js'

const HOUR = 3600 * 1000
const DAY = 24 * HOUR

/** One pass sends at most this many of each: a backlog drains over the next minutes. */
const BATCH = 200

/**
 * The reminders due now. Each goes out once (its stamp, set by a conditional
 * update only one server wins) and only inside its own stretch: the day-before
 * one between 24 hours and the short one, the short one in the last
 * `soonHours`. An appointment booked (or moved) after a reminder's moment
 * never gets it: the confirmation just told the customer.
 */
export async function sendDueReminders(now = new Date()): Promise<number> {
    const reminders = state.config.reminders
    if (!state.config.notify || !reminders || (!reminders.dayBefore && !reminders.soon)) return 0
    const soonMs = (reminders.soonHours ?? 2) * HOUR
    let sent = 0

    if (reminders.dayBefore) {
        sent += await remind('reminded_day_before_at', 'reminder_day_before', DAY, reminders.soon ? soonMs : 0, now)
    }
    if (reminders.soon) {
        sent += await remind('reminded_soon_at', 'reminder_soon', soonMs, 0, now)
    }
    return sent
}

async function remind(stamp: string, kind: BookingNoticeKind, aheadMs: number, untilMs: number, now: Date): Promise<number> {
    const { BookingAppointment } = bookingModels()
    const due: any[] = await BookingAppointment.findAll({
        where: {
            status: BookingAppointmentStatus.SCHEDULED,
            [stamp]: null,
            starts_at: { [Op.gt]: new Date(now.getTime() + untilMs), [Op.lte]: new Date(now.getTime() + aheadMs) },
        },
        order: [['starts_at', 'ASC']],
        limit: BATCH,
    })
    let sent = 0

    for (const appointment of due) {
        const bookedAt = new Date(appointment.rescheduled_at ?? appointment.created_at).getTime()
        const moment = new Date(appointment.starts_at).getTime() - aheadMs
        // Booked after the moment: stamped, never sent, so it is not looked at again.
        const late = bookedAt > moment

        // A static update calls no instance hook: no "moved" notice, no sync of a stamp.
        const [won] = await BookingAppointment.update({ [stamp]: now }, { where: { id: appointment.id, [stamp]: null }, hooks: false } as any)
        if (!won || late) continue
        appointment.setDataValue(stamp, now)
        notifyCustomer(appointment, kind)
        sent++
    }
    return sent
}

/**
 * Tells staff, once a day at `overdue.hour` (default 8, the leaf's zone), how many
 * appointments are over but still "Scheduled": nobody said whether the
 * customer came. Nothing is changed for them.
 */
export async function notifyOverdue(now = new Date()): Promise<void> {
    const overdue = state.config.overdue
    const adminLeaf = (etherial as any).eth_admin_leaf
    if (!overdue || !adminLeaf?.notify || adminLeaf.notificationsEnabled?.() === false) return
    if (Math.floor(zonedParts(now, timezoneOf()).minute / 60) !== (overdue.hour ?? 8)) return

    // Once in that hour, on one server, and not again after a restart: the lease outlives the hour.
    await runExclusive('eth_booking.overdue', { ttlMs: 20 * HOUR, release: false }, async () => {
        const { BookingAppointment } = bookingModels()
        const count = await BookingAppointment.count({ where: { status: BookingAppointmentStatus.SCHEDULED, ends_at: { [Op.lt]: now } } })
        if (!count) return
        await adminLeaf.notify({
            to: { permission: { collection: APPOINTMENTS_COLLECTION, permission: 'update' } },
            type: 'booking_overdue',
            title: count === 1 ? '1 appointment is over without an outcome' : `${count} appointments are over without an outcome`,
            body: 'They still read "Scheduled". Mark each one Completed or No Show.',
            link: `/${APPOINTMENTS_COLLECTION}`,
            collection: APPOINTMENTS_COLLECTION,
        })
    })
}
