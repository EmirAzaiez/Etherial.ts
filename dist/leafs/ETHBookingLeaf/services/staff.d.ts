/**
 * Booking from the back-office. Staff must be able to book by hand (the
 * customer called, has no app), but by hand doesn't mean beside the engine:
 * the form fills what the phone fills, and the same computation decides, or
 * the back-office would be the one way to book an impossible appointment.
 *
 * The form gives the customer, the subject or the scheduler, the start, maybe
 * the agent. The end and the length follow from the slot, never typed.
 *
 * `override_rules` is the one way out, and an explicit one: it lifts what the
 * engine refuses (outside the hours or the visit period, an agent not holding
 * those hours, a customer past their quota), the very cases staff pick up the
 * phone for. It never lifts an agent's capacity: two appointments on someone
 * who takes one is not a decision, it is a mistake.
 */
/** Ticked in the form: book outside the rules. A form field, never a column. */
export declare const OVERRIDE_FIELD = "override_rules";
/** The length when a forced slot falls in no window. */
export declare const FALLBACK_DURATION_MINUTES = 60;
type Input = Record<string, any>;
/** The customers' model: `customers.model`, else 'User'. */
export declare const customerModel: () => any;
/**
 * Turns the back-office's input into a valid appointment, or says why it
 * isn't one, in a sentence read in the form's red banner: what blocks and what
 * is left to do.
 */
export declare function prepareAdminBooking(data: Input): Promise<Input>;
/**
 * Guards the edit of an appointment: the form shows the status, the agent and
 * the notes, this guards the route, which takes any field of the body.
 */
export declare function guardAppointmentUpdate(record: any, data: Input): Promise<Input>;
export {};
