var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { bookingModels, state, timezoneOf } from './options.js';
/**
 * Tells the customer through the project's `notify`, in the background: a
 * notification is a comfort, its failure must not fail the appointment's write.
 */
export function notifyCustomer(appointment, kind) {
    const notify = state.config.notify;
    if (!notify || !(appointment === null || appointment === void 0 ? void 0 : appointment.user_id))
        return;
    (() => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const scheduler = (_a = appointment.scheduler) !== null && _a !== void 0 ? _a : (yield bookingModels().Scheduler.findByPk(appointment.scheduler_id, { attributes: ['id', 'timezone'] }));
        yield notify({ kind, appointment, timezone: timezoneOf(scheduler) });
    }))().catch((error) => console.error(`[ETHBookingLeaf] Could not tell the customer of appointment #${appointment.id} (${kind}):`, (error === null || error === void 0 ? void 0 : error.message) || error));
}
/** "Tue, Sep 29, 10:00" in the given zone: the scheduler's, not the server's nor the phone's. */
export function formatAppointmentTime(date, timezone, locale = 'en-US') {
    return new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone,
    }).format(new Date(date));
}
