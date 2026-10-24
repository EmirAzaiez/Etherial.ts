var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import etherial from 'etherial';
import { Op } from 'sequelize';
import { runExclusive } from '../../../components/database/lock.js';
import { BookingAppointmentStatus } from '../models/BookingAppointment.js';
import { notifyCustomer } from './notices.js';
import { APPOINTMENTS_COLLECTION, bookingModels, state, timezoneOf } from './options.js';
import { zonedParts } from './slots.js';
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
/** One pass sends at most this many of each: a backlog drains over the next minutes. */
const BATCH = 200;
/**
 * The reminders due now. Each goes out once (its stamp, set by a conditional
 * update only one server wins) and only inside its own stretch: the day-before
 * one between 24 hours and the short one, the short one in the last
 * `soonHours`. An appointment booked (or moved) after a reminder's moment
 * never gets it: the confirmation just told the customer.
 */
export function sendDueReminders() {
    return __awaiter(this, arguments, void 0, function* (now = new Date()) {
        var _a;
        const reminders = state.config.reminders;
        if (!state.config.notify || !reminders || (!reminders.dayBefore && !reminders.soon))
            return 0;
        const soonMs = ((_a = reminders.soonHours) !== null && _a !== void 0 ? _a : 2) * HOUR;
        let sent = 0;
        if (reminders.dayBefore) {
            sent += yield remind('reminded_day_before_at', 'reminder_day_before', DAY, reminders.soon ? soonMs : 0, now);
        }
        if (reminders.soon) {
            sent += yield remind('reminded_soon_at', 'reminder_soon', soonMs, 0, now);
        }
        return sent;
    });
}
function remind(stamp, kind, aheadMs, untilMs, now) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { BookingAppointment } = bookingModels();
        const due = yield BookingAppointment.findAll({
            where: {
                status: BookingAppointmentStatus.SCHEDULED,
                [stamp]: null,
                starts_at: { [Op.gt]: new Date(now.getTime() + untilMs), [Op.lte]: new Date(now.getTime() + aheadMs) },
            },
            order: [['starts_at', 'ASC']],
            limit: BATCH,
        });
        let sent = 0;
        for (const appointment of due) {
            const bookedAt = new Date((_a = appointment.rescheduled_at) !== null && _a !== void 0 ? _a : appointment.created_at).getTime();
            const moment = new Date(appointment.starts_at).getTime() - aheadMs;
            // Booked after the moment: stamped, never sent, so it is not looked at again.
            const late = bookedAt > moment;
            // A static update calls no instance hook: no "moved" notice, no sync of a stamp.
            const [won] = yield BookingAppointment.update({ [stamp]: now }, { where: { id: appointment.id, [stamp]: null }, hooks: false });
            if (!won || late)
                continue;
            appointment.setDataValue(stamp, now);
            notifyCustomer(appointment, kind);
            sent++;
        }
        return sent;
    });
}
/**
 * Tells staff, once a day at `overdue.hour` (default 8, the leaf's zone), how many
 * appointments are over but still "Scheduled": nobody said whether the
 * customer came. Nothing is changed for them.
 */
export function notifyOverdue() {
    return __awaiter(this, arguments, void 0, function* (now = new Date()) {
        var _a, _b;
        const overdue = state.config.overdue;
        const adminLeaf = etherial.eth_admin_leaf;
        if (!overdue || !(adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.notify) || ((_a = adminLeaf.notificationsEnabled) === null || _a === void 0 ? void 0 : _a.call(adminLeaf)) === false)
            return;
        if (Math.floor(zonedParts(now, timezoneOf()).minute / 60) !== ((_b = overdue.hour) !== null && _b !== void 0 ? _b : 8))
            return;
        // Once in that hour, on one server, and not again after a restart: the lease outlives the hour.
        yield runExclusive('eth_booking.overdue', { ttlMs: 20 * HOUR, release: false }, () => __awaiter(this, void 0, void 0, function* () {
            const { BookingAppointment } = bookingModels();
            const count = yield BookingAppointment.count({ where: { status: BookingAppointmentStatus.SCHEDULED, ends_at: { [Op.lt]: now } } });
            if (!count)
                return;
            yield adminLeaf.notify({
                to: { permission: { collection: APPOINTMENTS_COLLECTION, permission: 'update' } },
                type: 'booking_overdue',
                title: count === 1 ? '1 appointment is over without an outcome' : `${count} appointments are over without an outcome`,
                body: 'They still read "Scheduled". Mark each one Completed or No Show.',
                link: `/${APPOINTMENTS_COLLECTION}`,
                collection: APPOINTMENTS_COLLECTION,
            });
        }));
    });
}
