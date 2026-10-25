import { ComputeSlotsInput, Slot, SlotPolicy } from './slots.js';
/**
 * What decides the schedulers: the scope's id (a project's), or a record
 * holding it (a unit, `{ project_id }`), read from the subject's `scopeField`
 * or the scope's `field`.
 */
export type BookingScope = number | null | undefined | Record<string, any>;
export declare function scopeIdOf(scope: BookingScope): number | null;
/** `scopeIdOf`, through the project's `subject.scopeOf` when a record is given and it has one. */
export declare function resolveScopeId(scope: BookingScope): Promise<number | null>;
/**
 * Why this scheduler doesn't take this subject yet, from the project's
 * `subject.closedReason`, or null. For the project's app routes as for the
 * back-office's.
 */
export declare function subjectClosedReason(scheduler: any, subject: any): Promise<string | null>;
/**
 * The reasons to meet open to this scope, in a stable order (label, then id)
 * so the list doesn't move under the customer's finger. Left out: switched
 * off, hidden from the app, or past their last day. Nothing about
 * `starts_on`: booking in August for September is what a visit period allows;
 * the engine offers no day before it.
 */
export declare function resolveSchedulers(scope: BookingScope, options?: {
    now?: Date;
    forMobile?: boolean;
}): Promise<any[]>;
/**
 * One scheduler, if it governs this scope and is open. Every route taking a
 * `scheduler_id` from a phone goes through here: a guessed id would otherwise
 * reach another project's scheduler.
 */
export declare function resolveSchedulerById(scope: BookingScope, schedulerId: any, options?: {
    now?: Date;
    forMobile?: boolean;
}): Promise<any | null>;
/** A name to read in a staff message, never a bare id. */
export declare function schedulerLabel(scheduler: any): string;
/** A scheduler, and what closes it today if it is closed. */
export interface StaffScheduler {
    scheduler: any;
    closedReason: string | null;
}
/**
 * The same schedulers seen from the back-office: found first, judged after.
 * The app only needs them gone; staff need the reason ("it opens on the
 * 19th"), or a closed scheduler reads as a bug. A closed one stays usable, to
 * book outside the rules; finding none can't be forced: there are no rules.
 * `show_in_mobile_app` closes the app, not the back-office.
 */
export declare function resolveSchedulersForStaff(scope: BookingScope, options?: {
    now?: Date;
}): Promise<{
    schedulers: StaffScheduler[];
    missingReason: string | null;
}>;
/**
 * The scheduler the back-office works on. Without `schedulerId`, a scope with
 * one scheduler doesn't ask; with several, picking one would book the wrong
 * team with the wrong notice: it says so instead of guessing.
 */
export declare function resolveSchedulerForStaff(scope: BookingScope, schedulerId?: any, options?: {
    now?: Date;
}): Promise<{
    scheduler: any | null;
    closedReason: string | null;
}>;
export declare function policyOf(scheduler: any): SlotPolicy;
/**
 * Whether this start falls outside the visit period, and why. The engine
 * offers nothing there, so only an appointment forced by hand lands there;
 * "nothing is open at that time" would send staff looking for hours or a
 * holiday when the whole calendar is elsewhere.
 */
export declare function visitPeriodIssue(scheduler: any, start: Date): string | null;
/**
 * Everything the engine needs for a scheduler over a range. Blocks and the
 * diary are read a day wider on each side: a holiday on the 3rd closes the
 * 3rd even when asked from 08:00, and an appointment started at 23:30 the day
 * before bites into the next one.
 *
 * `excludeAppointmentId` leaves one appointment out of the diary: the one
 * being moved must not forbid itself the next slot, nor its own time.
 */
export declare function loadEngineInput(scheduler: any, range: {
    from: Date;
    to: Date;
    now: Date;
    excludeAppointmentId?: number;
}): Promise<Omit<ComputeSlotsInput, 'from' | 'to' | 'limit'>>;
/**
 * The scheduler's staff: the union of the active agents named on its
 * windows. There is no other list: offering the whole directory would let
 * staff pick someone who doesn't work there.
 */
export declare function schedulerRoster(scheduler: any): Promise<any[]>;
/** A name to read on screen, never a bare id. */
export declare function agentLabel(agent: any): string;
/** A scheduler's slots over a range. */
export declare function getSlots(scheduler: any, range: {
    from: Date;
    to: Date;
    now?: Date;
    limit?: number;
    excludeAppointmentId?: number;
}): Promise<Slot[]>;
/**
 * The agents still free at this exact start, and the length its window gives
 * it: the check replayed before writing. No host: the slot went between the
 * display and the submit.
 */
export declare function availableHostsAt(scheduler: any, start: Date, options?: {
    now?: Date;
    excludeAppointmentId?: number;
}): Promise<{
    host_ids: number[];
    duration_minutes: number;
}>;
/** The UTC bounds of a local day `YYYY-MM-DD`. */
export declare function localDayRange(day: string, tz?: string): {
    from: Date;
    to: Date;
} | null;
/**
 * The agent to give the appointment to among those still free: the one with
 * the fewest that day, ties going to the first, so it is reproducible.
 */
export declare function pickHost(candidateIds: number[], start: Date, tz?: string): Promise<number | null>;
/**
 * The partial unique index against double booking (see `BaseBookingAppointment`):
 * its name tells "this seat was just taken" from any other unique violation.
 */
export declare const SEAT_CONSTRAINT = "booking_appointments_agent_slot_unique";
/** How many appointments this agent holds at once. */
export declare function capacityOf(agentId: number): Promise<number>;
/**
 * The agent's free seats at this exact start, in order: seats 0 to n-1 for an
 * agent receiving n customers at once, and the unique index is on (agent,
 * start, seat). Empty: full. A cancelled appointment gives its seat back.
 */
export declare function freeSeatsAt(agentId: number, start: Date, excludeAppointmentId?: number): Promise<number[]>;
/**
 * How many of this agent's appointments bite into this interval, and the
 * first one to name it: the engine's count for the paths that write without
 * it (the back-office, which may book outside the opening hours).
 */
export declare function overlappingAppointments(agentId: number, start: Date, end: Date, excludeAppointmentId?: number): Promise<{
    count: number;
    first: any | null;
}>;
/**
 * Writes the appointment on the agent's first free seat. Two simultaneous
 * bookings may both pass the availability check; the database lets one win a
 * given seat, and the loop (bounded by the capacity) takes the next. `null`:
 * every seat is gone, the caller answers 409.
 */
export declare function createAppointmentInSeat(payload: Record<string, unknown> & {
    agent_id: number;
    starts_at: Date;
}, options?: Record<string, unknown>): Promise<any | null>;
