var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as yup from 'yup';
import { BookingAppointmentStatus } from '../models/BookingAppointment.js';
import { APPOINTMENTS_COLLECTION, SCHEDULERS_COLLECTION, WINDOWS_COLLECTION } from '../services/options.js';
import { guardAppointmentUpdate, prepareAdminBooking } from '../services/staff.js';
/**
 * The booking's actions and hooks, on the collections of `collections.ts`.
 * Registered before them: a collection resolves its hooks when it is registered.
 */
export const CANCEL_ACTION = 'booking:cancel';
export function registerBookingActions(adminLeaf) {
    var _a, _b;
    if ((_b = (_a = adminLeaf.actions).get) === null || _b === void 0 ? void 0 : _b.call(_a, CANCEL_ACTION))
        return;
    // The customer's own path: the slot is really freed (the unique index only
    // holds `scheduled` ones) and the customer is told.
    adminLeaf.actions.register(CANCEL_ACTION, {
        meta: {
            label: 'Cancel Appointment',
            description: 'Cancel this booking and free the slot',
            icon: 'calendar-x',
            color: 'danger',
            category: 'booking',
            confirm: {
                title: 'Cancel Appointment',
                message: 'The slot goes back on sale and the owner is notified. Continue?',
                confirmText: 'Cancel it',
                cancelText: 'Keep it',
            },
        },
        form: yup.object({
            reason: yup.string().max(255).label('Reason'),
        }),
        handler: (record, data) => __awaiter(this, void 0, void 0, function* () {
            if (record.status === BookingAppointmentStatus.CANCELLED) {
                return { success: false, error: 'This appointment is already cancelled' };
            }
            yield record.update({
                status: BookingAppointmentStatus.CANCELLED,
                cancelled_at: new Date(),
                cancellation_reason: (data === null || data === void 0 ? void 0 : data.reason) || 'Cancelled from the admin panel',
            });
            return { success: true, data: { id: record.id } };
        }),
    });
}
/** The ids of a list of employees, as the form sends them: ids or `{ id }`. */
function agentIdsOf(value) {
    const list = Array.isArray(value) ? value : value === null || value === undefined || value === '' ? [] : [value];
    return list
        .map((entry) => Number(entry && typeof entry === 'object' ? entry.id : entry))
        .filter((id) => Number.isInteger(id) && id > 0);
}
const NO_AGENT = 'Pick at least one employee for this opening — nobody assigned means no slot at all, and there is no project-wide list to fall back on.';
/** A visit period the wrong way round shows nothing: the calendar comes out empty. */
function visitPeriodOrder(first, last) {
    const from = first ? String(first).slice(0, 10) : null;
    const to = last ? String(last).slice(0, 10) : null;
    if (from && to && to < from) {
        throw new Error(`The last visit day (${to}) comes before the first one (${from}), so no day could ever be offered.`);
    }
}
/** The openings written from the scheduler page: the admin leaf takes them out of `data`, `req.body` keeps them. */
function nestedWindows(data, req) {
    const body = req === null || req === void 0 ? void 0 : req.body;
    return body && body.windows !== undefined ? body.windows : data.windows;
}
function guardNestedWindows(windows) {
    if (!Array.isArray(windows))
        return;
    windows.forEach((raw, index) => {
        const row = (raw || {});
        if (row.id && row.agents === undefined)
            return;
        if (agentIdsOf(row.agents).length === 0)
            throw new Error(`Opening #${index + 1}: ${NO_AGENT}`);
    });
}
export function registerBookingHooks(adminLeaf) {
    const hooks = adminLeaf.hooks;
    // A booking from the back-office goes through the engine, as one from the phone.
    hooks.register('booking:appointment-booking', {
        collection: APPOINTMENTS_COLLECTION,
        description: 'Run admin-created bookings through the booking engine',
        beforeCreate: (data) => __awaiter(this, void 0, void 0, function* () { return prepareAdminBooking(data); }),
        beforeUpdate: (record, data) => __awaiter(this, void 0, void 0, function* () { return guardAppointmentUpdate(record, data); }),
        // Deleting would erase the customer's history without telling them.
        beforeDelete: () => __awaiter(this, void 0, void 0, function* () {
            throw new Error('An appointment is never deleted, it is cancelled. Use the "Cancel Appointment" action, ' + 'so the slot goes back on sale and the owner is told.');
        }),
    });
    hooks.register('booking:scheduler-visit-period', {
        collection: SCHEDULERS_COLLECTION,
        description: 'Refuse a visit period that ends before it starts',
        beforeCreate: (data) => __awaiter(this, void 0, void 0, function* () {
            visitPeriodOrder(data.starts_on, data.ends_on);
            return data;
        }),
        beforeUpdate: (record, data) => __awaiter(this, void 0, void 0, function* () {
            // A bound missing from the body is the one saved.
            visitPeriodOrder(data.starts_on === undefined ? record.starts_on : data.starts_on, data.ends_on === undefined ? record.ends_on : data.ends_on);
            return data;
        }),
    });
    // An opening with nobody offers nothing and says nothing: `required` is only
    // checked on screen, and openings are also written from the scheduler page.
    hooks.register('booking:scheduler-window-agents', {
        collection: WINDOWS_COLLECTION,
        description: 'Refuse an opening with nobody to hold it',
        beforeCreate: (data) => __awaiter(this, void 0, void 0, function* () {
            if (agentIdsOf(data.agents).length === 0)
                throw new Error(NO_AGENT);
            return data;
        }),
        beforeUpdate: (_record, data) => __awaiter(this, void 0, void 0, function* () {
            if (data.agents !== undefined && agentIdsOf(data.agents).length === 0)
                throw new Error(NO_AGENT);
            return data;
        }),
    });
    hooks.register('booking:scheduler-window-agents-nested', {
        collection: SCHEDULERS_COLLECTION,
        description: 'Refuse an opening with nobody to hold it, when added from the scheduler page',
        beforeCreate: (data, req) => __awaiter(this, void 0, void 0, function* () {
            guardNestedWindows(nestedWindows(data, req));
            return data;
        }),
        beforeUpdate: (_record, data, req) => __awaiter(this, void 0, void 0, function* () {
            guardNestedWindows(nestedWindows(data, req));
            return data;
        }),
    });
}
