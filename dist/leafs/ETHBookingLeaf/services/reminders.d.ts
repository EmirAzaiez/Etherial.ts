/**
 * The reminders due now. Each goes out once (its stamp, set by a conditional
 * update only one server wins) and only inside its own stretch: the day-before
 * one between 24 hours and the short one, the short one in the last
 * `soonHours`. An appointment booked (or moved) after a reminder's moment
 * never gets it: the confirmation just told the customer.
 */
export declare function sendDueReminders(now?: Date): Promise<number>;
/**
 * Tells staff, once a day at `overdue.hour` (default 8, the leaf's zone), how many
 * appointments are over but still "Scheduled": nobody said whether the
 * customer came. Nothing is changed for them.
 */
export declare function notifyOverdue(now?: Date): Promise<void>;
