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
    code: string;
    /** The same in a sentence, for the back-office's banner. */
    message: string;
}
export interface QuotaState {
    /** Null when the scheduler sets none. */
    max_active: number | null;
    active_count: number;
    max_total: number | null;
    used_count: number;
    can_book: boolean;
    issue: QuotaIssue | null;
}
/**
 * What this customer holds, and has left, under this scheduler: on this
 * subject when the appointment has one. `excludeAppointmentId` leaves out the
 * one being moved.
 */
export declare function customerQuota(scheduler: any, userId: number, subjectId: number | null, options?: {
    now?: Date;
    excludeAppointmentId?: number;
}): Promise<QuotaState>;
