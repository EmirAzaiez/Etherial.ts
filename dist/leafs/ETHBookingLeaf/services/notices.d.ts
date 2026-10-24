import { type BookingNoticeKind } from './options.js';
/**
 * Tells the customer through the project's `notify`, in the background: a
 * notification is a comfort, its failure must not fail the appointment's write.
 */
export declare function notifyCustomer(appointment: any, kind: BookingNoticeKind): void;
/** "Tue, Sep 29, 10:00" in the given zone: the scheduler's, not the server's nor the phone's. */
export declare function formatAppointmentTime(date: Date | string, timezone: string, locale?: string): string;
