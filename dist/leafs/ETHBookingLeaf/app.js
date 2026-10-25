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
import * as path from 'path';
import { fileURLToPath } from 'url';
import { runExclusive } from '../../components/database/lock.js';
import { registerSync, registerSyncAdmin, startSync } from '../../components/sync/index.js';
import { registerBookingActions, registerBookingHooks } from './admin/features.js';
import { linkBookingCustomers, registerBookingCollections } from './admin/collections.js';
import { registerBookingCalendar } from './admin/calendar.js';
import { notifyOverdue, sendDueReminders } from './services/reminders.js';
import { bookingModels, collectionNames, state } from './services/options.js';
export * from './services/options.js';
export * from './models/Scheduler.js';
export * from './models/SchedulerWindow.js';
export * from './models/SchedulerWindowHost.js';
export * from './models/SchedulerBlock.js';
export * from './models/Agent.js';
export * from './models/BookingAppointment.js';
export * from './services/slots.js';
export * from './services/repository.js';
export * from './services/quota.js';
export * from './services/staff.js';
export { formatAppointmentTime } from './services/notices.js';
export { sendDueReminders, notifyOverdue } from './services/reminders.js';
export { CANCEL_ACTION } from './admin/features.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
/**
 * ETHBookingLeaf — appointments booked against our own calendar.
 *
 * Schedulers (one per reason to meet: a handover, a site visit) open hours on
 * weekdays, held by employees; closures take days out; the engine turns that
 * into the slots the app offers, and a unique index makes a double booking
 * impossible. Staff book, cancel and read the calendar in the back-office.
 *
 * The project owns the tables (it extends the base models), what a scheduler
 * belongs to (`scope`), what an appointment is about (`subject`), how the
 * customer is told (`notify`) and its app routes, which call the services.
 * With `sync`, each appointment is copied to an outside system after commit.
 */
export default class ETHBookingLeaf {
    constructor(config = {}) {
        var _a;
        this.etherial_module_name = 'eth_booking_leaf';
        this.routes = [];
        this.config = config;
        state.config = config;
        this.routes.push({ route: path.join(__dirname, 'routes/admin'), methods: ['slots'] });
        if ((_a = config.weekend) === null || _a === void 0 ? void 0 : _a.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
            throw new Error('[ETHBookingLeaf] weekend: days are Date.getDay() numbers, 0 (Sunday) to 6 (Saturday)');
        }
    }
    /** Lifecycle: beforeRun — the sync tables go to the database before it syncs. */
    beforeRun() {
        if (this.config.sync) {
            // The target goes by the appointments' collection name.
            registerSync(collectionNames().appointments, Object.assign(Object.assign({}, this.config.sync), { model: () => bookingModels().BookingAppointment, 
                // A reminder going out changes nothing over there.
                track: { ignore: ['reminded_day_before_at', 'reminded_soon_at'] } }));
        }
    }
    /**
     * Lifecycle: run — routes, the back-office and the clock. The back-office
     * is registered here, before the admin leaf runs: hooks before their
     * collections (a collection reads its hooks when registered), and the
     * collections before the admin leaf installs its history on them.
     */
    run({ http }) {
        var _a, _b, _c;
        bookingModels();
        (_a = http === null || http === void 0 ? void 0 : http.routes_leafs) === null || _a === void 0 ? void 0 : _a.push(...this.routes);
        startSync();
        const adminLeaf = etherial.eth_admin_leaf;
        if (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.registerCollection) {
            registerBookingActions(adminLeaf);
            registerBookingHooks(adminLeaf);
            registerBookingCollections(adminLeaf);
            registerBookingCalendar(adminLeaf);
        }
        const { reminders, overdue } = this.config;
        if ((reminders === null || reminders === void 0 ? void 0 : reminders.dayBefore) || (reminders === null || reminders === void 0 ? void 0 : reminders.soon) || overdue) {
            const tick = () => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield runExclusive('eth_booking.tick', { ttlMs: 50 * 1000, release: false }, () => sendDueReminders());
                    yield notifyOverdue();
                }
                catch (err) {
                    console.error('[ETHBookingLeaf] Reminders failed:', (err === null || err === void 0 ? void 0 : err.message) || err);
                }
            });
            // Not at boot: the tables may not be synced yet.
            (_c = (_b = setInterval(tick, 60 * 1000)).unref) === null || _c === void 0 ? void 0 : _c.call(_b);
        }
    }
    /** Lifecycle: afterRun — the project's accounts exist: the customers link to them; the sent records in the back-office. */
    afterRun() {
        const adminLeaf = etherial.eth_admin_leaf;
        if (!(adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.registerCollection))
            return;
        linkBookingCustomers(adminLeaf);
        registerSyncAdmin(adminLeaf);
    }
}
