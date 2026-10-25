var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
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
import { Controller, Get } from 'etherial/components/http/provider';
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
import { BO_SUBJECT_FIELD, collectionNames, projectModel, state, subjectWord, timezoneOf } from '../services/options.js';
import { customerQuota } from '../services/quota.js';
import { agentLabel, getSlots, resolveSchedulerForStaff, resolveSchedulersForStaff, schedulerLabel, schedulerRoster, subjectClosedReason, } from '../services/repository.js';
import { zonedDayKey } from '../services/slots.js';
/** Who books by hand: whoever may create or change appointments in the back-office. */
function canBook(user) {
    return __awaiter(this, void 0, void 0, function* () {
        const adminLeaf = etherial.eth_admin_leaf;
        if (!adminLeaf || !(yield adminLeaf.canAccessAdmin(user)))
            return false;
        const { appointments } = collectionNames();
        return (yield adminLeaf.checkAccess(user, appointments, 'create')) || (yield adminLeaf.checkAccess(user, appointments, 'update'));
    });
}
/** The fallback when the scheduler says nothing: two months, as the app. */
const DEFAULT_HORIZON_DAYS = 60;
/** "Sunday 23 August", read in the scheduler's zone wherever it is looked at from. */
function dayLabel(day, tz) {
    // Noon UTC: twelve hours of margin on both sides before any offset changes the day.
    return new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${day}T12:00:00.000Z`));
}
const positiveId = (value) => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
};
let ETHBookingAdminController = class ETHBookingAdminController {
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
    slots(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            if (!(yield canBook(req.user))) {
                return res.error({ status: 403, errors: ['Only staff can look up appointment slots.'] });
            }
            const query = req.query;
            const subject = state.config.subject;
            let unit = null;
            if (subject) {
                const subjectId = positiveId((_b = (_a = query[subject.field]) !== null && _a !== void 0 ? _a : query[BO_SUBJECT_FIELD]) !== null && _b !== void 0 ? _b : query.subject_id);
                if (!subjectId) {
                    return res.error({ status: 400, errors: [`Pick the ${subjectWord()} first — it decides which scheduler applies.`] });
                }
                unit = yield ((_c = projectModel(subject.model)) === null || _c === void 0 ? void 0 : _c.findByPk(subjectId));
                if (!unit) {
                    return res.error({ status: 404, errors: [`That ${subjectWord()} no longer exists.`] });
                }
            }
            // Found first, judged after: a scheduler closed today still shows its
            // hours, and staff may see them to decide to force. The app's switch
            // closes the app, not the back-office.
            const { schedulers } = yield resolveSchedulersForStaff(unit);
            const visitType = (_d = state.config.admin) === null || _d === void 0 ? void 0 : _d.visitType;
            const schedulerOptions = schedulers.map((entry) => ({
                id: entry.scheduler.id,
                label: schedulerLabel(entry.scheduler),
                visit_type: visitType ? visitType(entry.scheduler) : entry.scheduler.kind,
                closed_reason: entry.closedReason,
            }));
            const { scheduler, closedReason } = yield resolveSchedulerForStaff(unit, query.scheduler_id);
            if (!scheduler) {
                return res.success({
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
                });
            }
            const tz = timezoneOf(scheduler);
            const now = new Date();
            const horizon = scheduler.horizon_days || DEFAULT_HORIZON_DAYS;
            const excludeAppointmentId = (_e = positiveId(query.exclude_appointment_id)) !== null && _e !== void 0 ? _e : undefined;
            const customerId = positiveId(query.user_id);
            const [slots, roster, quota] = yield Promise.all([
                getSlots(scheduler, { from: now, to: new Date(now.getTime() + horizon * 86400000), now, excludeAppointmentId }),
                schedulerRoster(scheduler),
                customerId ? customerQuota(scheduler, customerId, (_f = unit === null || unit === void 0 ? void 0 : unit.id) !== null && _f !== void 0 ? _f : null, { now, excludeAppointmentId }) : Promise.resolve(null),
            ]);
            // The engine returns them in order, and a Map keeps it.
            const byDay = new Map();
            for (const slot of slots) {
                const entry = { start: slot.start, label: slot.label, duration_minutes: slot.duration_minutes, host_ids: slot.host_ids };
                const bucket = byDay.get(slot.day);
                if (bucket)
                    bucket.push(entry);
                else
                    byDay.set(slot.day, [entry]);
            }
            const reasons = [closedReason];
            // Nobody on the openings: the calendar is empty and nothing on screen would say so.
            if (roster.length === 0) {
                reasons.push(`No employee is assigned to any opening of "${schedulerLabel(scheduler)}", so it offers nothing. Add one under "Days & hours" on that scheduler.`);
            }
            // An empty list while all is set right nearly always comes from this:
            // visits start beyond what the horizon lets anyone book.
            if (byDay.size === 0 && !closedReason && scheduler.starts_on) {
                const lastOffered = zonedDayKey(new Date(now.getTime() + horizon * 86400000), tz);
                if (scheduler.starts_on > lastOffered) {
                    reasons.push(`"${schedulerLabel(scheduler)}" only starts on ${scheduler.starts_on}, and it lets anyone book at most ${horizon} days ahead — today it reaches no further than ${lastOffered}. The dates will appear on their own.`);
                }
            }
            // The project's own rule on the subject (a unit not ready): its slots show, booking needs forcing.
            const subjectClosed = yield subjectClosedReason(scheduler, unit);
            reasons.push(subjectClosed);
            const blocking = reasons.filter(Boolean);
            return res.success({
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
                            message: (_h = (_g = quota.issue) === null || _g === void 0 ? void 0 : _g.message) !== null && _h !== void 0 ? _h : null,
                            max_active: quota.max_active,
                            active_count: quota.active_count,
                            max_total: quota.max_total,
                            used_count: quota.used_count,
                        }
                        : null,
                    days: [...byDay.entries()].map(([day, entries]) => ({ day, label: dayLabel(day, tz), slots: entries })),
                },
            });
        });
    }
};
__decorate([
    Get('/admin/booking/slots'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHBookingAdminController.prototype, "slots", null);
ETHBookingAdminController = __decorate([
    Controller()
], ETHBookingAdminController);
export default ETHBookingAdminController;
