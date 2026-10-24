var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Op } from 'sequelize';
import { BookingAppointmentStatus } from '../models/BookingAppointment.js';
import { bookingModels, state, subjectWord } from './options.js';
/** A limit typed in the back-office; 0 or below means none, so an emptied field doesn't close bookings. */
function toLimit(value) {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
}
function plural(count, word) {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
}
/**
 * What this customer holds, and has left, under this scheduler: on this
 * subject when the appointment has one. `excludeAppointmentId` leaves out the
 * one being moved.
 */
export function customerQuota(scheduler_1, userId_1, subjectId_1) {
    return __awaiter(this, arguments, void 0, function* (scheduler, userId, subjectId, options = {}) {
        var _a, _b;
        const now = (_a = options.now) !== null && _a !== void 0 ? _a : new Date();
        const maxActive = toLimit(scheduler.max_active_appointments);
        const maxTotal = toLimit(scheduler.max_appointments_total);
        const subjectField = (_b = state.config.subject) === null || _b === void 0 ? void 0 : _b.field;
        const scope = Object.assign(Object.assign(Object.assign({ user_id: userId }, (subjectId && subjectField ? { [subjectField]: subjectId } : {})), { scheduler_id: scheduler.id }), (options.excludeAppointmentId ? { id: { [Op.ne]: options.excludeAppointmentId } } : {}));
        // Nothing to ask when nothing is limited: the common case.
        if (!maxActive && !maxTotal) {
            return { max_active: null, active_count: 0, max_total: null, used_count: 0, can_book: true, issue: null };
        }
        const { BookingAppointment } = bookingModels();
        const [activeCount, usedCount] = yield Promise.all([
            maxActive
                ? BookingAppointment.count({
                    // The end, not the start: one started ten minutes ago still holds the agent.
                    where: Object.assign(Object.assign({}, scope), { status: BookingAppointmentStatus.SCHEDULED, ends_at: { [Op.gte]: now } }),
                })
                : Promise.resolve(0),
            maxTotal
                ? BookingAppointment.count({
                    where: Object.assign(Object.assign({}, scope), { status: { [Op.in]: [BookingAppointmentStatus.SCHEDULED, BookingAppointmentStatus.COMPLETED, BookingAppointmentStatus.NO_SHOW] } }),
                })
                : Promise.resolve(0),
        ]);
        let issue = null;
        // The scheduler is named in each sentence: the cap is its own, not the subject's.
        const reason = scheduler.label || `scheduler #${scheduler.id}`;
        const on = subjectField ? ` on this ${subjectWord()}` : '';
        if (maxTotal && usedCount >= maxTotal) {
            issue = {
                code: 'api.appointments.visit_limit_reached',
                message: maxTotal === 1
                    ? `This customer has already had their "${reason}"${on}, and it allows one in all. Booking a second one needs "Book outside the rules".`
                    : `This customer has already used ${plural(usedCount, '"' + reason + '" visit')}${on}, and it allows ${maxTotal} in all.`,
            };
        }
        else if (maxActive && activeCount >= maxActive) {
            issue = {
                code: 'api.appointments.too_many_active',
                message: maxActive === 1
                    ? `This customer already has a "${reason}" coming up${on}, and it allows one at a time. Cancel that one, or wait until it is over.`
                    : `This customer already holds ${plural(activeCount, 'upcoming "' + reason + '" appointment')}${on}, and it allows ${maxActive} at a time.`,
            };
        }
        return { max_active: maxActive, active_count: activeCount, max_total: maxTotal, used_count: usedCount, can_book: !issue, issue };
    });
}
