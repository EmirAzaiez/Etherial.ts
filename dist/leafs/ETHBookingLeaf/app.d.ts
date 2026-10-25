import { Etherial } from 'etherial';
import { ETHBookingLeafConfig } from './services/options.js';
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
    readonly etherial_module_name = "eth_booking_leaf";
    config: ETHBookingLeafConfig;
    private routes;
    constructor(config?: ETHBookingLeafConfig);
    /** Lifecycle: beforeRun — the sync tables go to the database before it syncs. */
    beforeRun(): void;
    /**
     * Lifecycle: run — routes, the back-office and the clock. The back-office
     * is registered here, before the admin leaf runs: hooks before their
     * collections (a collection reads its hooks when registered), and the
     * collections before the admin leaf installs its history on them.
     */
    run({ http }: Etherial): void;
    /** Lifecycle: afterRun — the project's accounts exist: the customers link to them; the sent records in the back-office. */
    afterRun(): void;
}
