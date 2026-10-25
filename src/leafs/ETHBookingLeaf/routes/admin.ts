import etherial from 'etherial'
import type { Request, Response } from 'express'
import { Controller, Get } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'

import { BO_SUBJECT_FIELD, collectionNames, projectModel, state, subjectWord, timezoneOf } from '../services/options.js'
import { customerQuota } from '../services/quota.js'
import {
    agentLabel,
    getSlots,
    resolveSchedulerForStaff,
    resolveSchedulersForStaff,
    schedulerLabel,
    schedulerRoster,
    subjectClosedReason,
} from '../services/repository.js'
import { zonedDayKey } from '../services/slots.js'

type AuthedRequest = Request & { user: any }

/** Who books by hand: whoever may create or change appointments in the back-office. */
async function canBook(user: any): Promise<boolean> {
    const adminLeaf = (etherial as any).eth_admin_leaf
    if (!adminLeaf || !(await adminLeaf.canAccessAdmin(user))) return false
    const { appointments } = collectionNames()
    return (await adminLeaf.checkAccess(user, appointments, 'create')) || (await adminLeaf.checkAccess(user, appointments, 'update'))
}

/** The fallback when the scheduler says nothing: two months, as the app. */
const DEFAULT_HORIZON_DAYS = 60

/** "Sunday 23 August", read in the scheduler's zone wherever it is looked at from. */
function dayLabel(day: string, tz: string): string {
    // Noon UTC: twelve hours of margin on both sides before any offset changes the day.
    return new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${day}T12:00:00.000Z`))
}

const positiveId = (value: unknown): number | null => {
    const n = Number(value)
    return Number.isInteger(n) && n > 0 ? n : null
}

@Controller()
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
    @Get('/admin/booking/slots')
    @ShouldBeAuthenticated()
    public async slots(req: AuthedRequest, res: Response): Promise<any> {
        if (!(await canBook(req.user))) {
            return (res as any).error({ status: 403, errors: ['Only staff can look up appointment slots.'] })
        }

        const query = req.query as Record<string, string | undefined>
        const subject = state.config.subject
        let unit: any = null

        if (subject) {
            const subjectId = positiveId(query[subject.field] ?? query[BO_SUBJECT_FIELD] ?? query.subject_id)
            if (!subjectId) {
                return (res as any).error({ status: 400, errors: [`Pick the ${subjectWord()} first — it decides which scheduler applies.`] })
            }
            unit = await projectModel(subject.model)?.findByPk(subjectId)
            if (!unit) {
                return (res as any).error({ status: 404, errors: [`That ${subjectWord()} no longer exists.`] })
            }
        }

        // Found first, judged after: a scheduler closed today still shows its
        // hours, and staff may see them to decide to force. The app's switch
        // closes the app, not the back-office.
        const { schedulers } = await resolveSchedulersForStaff(unit)
        const visitType = state.config.admin?.visitType
        const schedulerOptions = schedulers.map((entry) => ({
            id: entry.scheduler.id,
            label: schedulerLabel(entry.scheduler),
            visit_type: visitType ? visitType(entry.scheduler) : entry.scheduler.kind,
            closed_reason: entry.closedReason,
        }))

        const { scheduler, closedReason } = await resolveSchedulerForStaff(unit, query.scheduler_id)

        if (!scheduler) {
            return (res as any).success({
                status: 200,
                data: {
                    timezone: timezoneOf(),
                    scheduler: null,
                    schedulers: schedulerOptions,
                    open_for_unit: false,
                    blocked_reason: closedReason,
                    agents: [],
                    quota: null,
                    days: [],
                },
            })
        }

        const tz = timezoneOf(scheduler)
        const now = new Date()
        const horizon = scheduler.horizon_days || DEFAULT_HORIZON_DAYS
        const excludeAppointmentId = positiveId(query.exclude_appointment_id) ?? undefined
        const customerId = positiveId(query.user_id)

        const [slots, roster, quota] = await Promise.all([
            getSlots(scheduler, { from: now, to: new Date(now.getTime() + horizon * 86400000), now, excludeAppointmentId }),
            schedulerRoster(scheduler),
            customerId ? customerQuota(scheduler, customerId, unit?.id ?? null, { now, excludeAppointmentId }) : Promise.resolve(null),
        ])

        // The engine returns them in order, and a Map keeps it.
        const byDay = new Map<string, any[]>()
        for (const slot of slots) {
            const entry = { start: slot.start, label: slot.label, duration_minutes: slot.duration_minutes, host_ids: slot.host_ids }
            const bucket = byDay.get(slot.day)
            if (bucket) bucket.push(entry)
            else byDay.set(slot.day, [entry])
        }

        const reasons = [closedReason]

        // Nobody on the openings: the calendar is empty and nothing on screen would say so.
        if (roster.length === 0) {
            reasons.push(`No employee is assigned to any opening of "${schedulerLabel(scheduler)}", so it offers nothing. Add one under "Days & hours" on that scheduler.`)
        }

        // An empty list while all is set right nearly always comes from this:
        // visits start beyond what the horizon lets anyone book.
        if (byDay.size === 0 && !closedReason && scheduler.starts_on) {
            const lastOffered = zonedDayKey(new Date(now.getTime() + horizon * 86400000), tz)
            if (scheduler.starts_on > lastOffered) {
                reasons.push(
                    `"${schedulerLabel(scheduler)}" only starts on ${scheduler.starts_on}, and it lets anyone book at most ${horizon} days ahead — today it reaches no further than ${lastOffered}. The dates will appear on their own.`
                )
            }
        }

        // The project's own rule on the subject (a unit not ready): its slots show, booking needs forcing.
        const subjectClosed = await subjectClosedReason(scheduler, unit)
        reasons.push(subjectClosed)
        const blocking = reasons.filter(Boolean)

        return (res as any).success({
            status: 200,
            data: {
                timezone: tz,
                scheduler: { id: scheduler.id, label: schedulerLabel(scheduler) },
                schedulers: schedulerOptions,
                open_for_unit: !closedReason && !subjectClosed,
                blocked_reason: blocking.length ? `${blocking.join(' ')} Booking anyway needs "Book outside the rules".` : null,
                agents: roster.map((agent) => ({ id: agent.id, name: agentLabel(agent), email: agent.email || null })),
                quota: quota
                    ? {
                          can_book: quota.can_book,
                          message: quota.issue?.message ?? null,
                          max_active: quota.max_active,
                          active_count: quota.active_count,
                          max_total: quota.max_total,
                          used_count: quota.used_count,
                      }
                    : null,
                days: [...byDay.entries()].map(([day, entries]) => ({ day, label: dayLabel(day, tz), slots: entries })),
            },
        })
    }
}
