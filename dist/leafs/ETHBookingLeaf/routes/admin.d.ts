import type { Request, Response } from 'express';
type AuthedRequest = Request & {
    user: any;
};
export default class ETHBookingAdminController {
    /**
     * GET /admin/booking/slots?property_id=1[&scheduler_id=3][&user_id=7][&exclude_appointment_id=42]
     *
     * The slots as the back-office must offer them, so staff pick in what the
     * scheduler offers instead of finding the rule through the error message.
     * It writes nothing: the booking goes through the appointments' collection,
     * whose hook runs the same engine when writing.
     *
     * The subject comes as `property_id` (what the shared back-office sends),
     * as its own column (`unit_id`) or as `subject_id`; without a `subject`
     * in the config, `scheduler_id` alone is enough.
     *
     * Returns `{ timezone, scheduler, schedulers, open_for_unit, blocked_reason,
     * agents, quota, days }`. Empty `days` is not an error. `blocked_reason`
     * says why when the cause is the configuration, not the calendar: staff
     * need it to know whether to force or to fix the scheduler. `schedulers`
     * (the scope's reasons, each with what closes it) always goes, it feeds the
     * "What the visit is for" field. `agents` names the scheduler's staff and
     * bounds the employee field. `user_id` filters nothing: it gives the
     * customer's count, to warn before saving rather than after.
     */
    slots(req: AuthedRequest, res: Response): Promise<any>;
}
export {};
