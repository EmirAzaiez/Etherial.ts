var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Op } from 'sequelize';
import { canAccessPage, resolveAccess } from '../../ETHAdminLeaf/features/access.js';
import { APPOINTMENTS_COLLECTION, CALENDAR_PAGE, associationTo, attributesOf, bookingModels, projectModel, state, timezoneOf } from '../services/options.js';
import { agentLabel } from '../services/repository.js';
import { customerModel } from '../services/staff.js';
import { minutesToLabel, zonedDayKey, zonedParts } from '../services/slots.js';
/**
 * The back-office calendar: what a day looks like. The list answers "where
 * does this appointment stand?"; this page answers "what does Thursday look
 * like?". It shows everything that fills a day — appointments whatever their
 * status, and the closures that explain an empty one. A calendar hiding the
 * cancellations would make a slot look as if it never existed.
 */
/** The widest load: two months, enough for any view. */
const MAX_RANGE_DAYS = 70;
/**
 * The window asked, bounded: a missing or odd date must not turn into a
 * `findAll` over the whole table, nor a "year" view into the whole calendar.
 */
function parseRange(data) {
    const rawFrom = typeof data.from === 'string' ? new Date(data.from) : new Date();
    const from = isNaN(rawFrom.getTime()) ? new Date() : rawFrom;
    const rawTo = typeof data.to === 'string' ? new Date(data.to) : null;
    const fallback = new Date(from.getTime() + 31 * 86400000);
    const asked = rawTo && !isNaN(rawTo.getTime()) ? rawTo : fallback;
    const ceiling = new Date(from.getTime() + MAX_RANGE_DAYS * 86400000);
    const to = asked > ceiling ? ceiling : asked;
    return { from, to: to > from ? to : fallback };
}
function optionalId(value) {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
}
/** Many accounts have no email: the page shows this one field, so it gets what names the customer best. */
function customerLabel(user) {
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
    return user.email || name || user.phone_number || `#${user.id}`;
}
export function registerBookingCalendar(adminLeaf) {
    var _a, _b, _c;
    if ((_a = adminLeaf.getPage) === null || _a === void 0 ? void 0 : _a.call(adminLeaf, CALENDAR_PAGE))
        return;
    adminLeaf.registerPage({
        name: CALENDAR_PAGE,
        title: 'Calendar',
        icon: 'calendar-days',
        group: (_c = (_b = state.config.admin) === null || _b === void 0 ? void 0 : _b.group) !== null && _c !== void 0 ? _c : 'Scheduling',
        // Before the list: it is the view opened in the morning.
        order: 0,
        component: CALENDAR_PAGE,
        showInMenu: true,
        // Granted page by page in the admin roles, as the other pages.
        canAccess: (user) => __awaiter(this, void 0, void 0, function* () { return canAccessPage(yield resolveAccess(user), CALENDAR_PAGE); }),
    });
    adminLeaf.registerPageFormHandler(CALENDAR_PAGE, (data) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { Agent, BookingAppointment, Scheduler, SchedulerBlock } = bookingModels();
        const { from, to } = parseRange(data || {});
        const schedulerId = optionalId(data === null || data === void 0 ? void 0 : data.scheduler_id);
        const agentId = optionalId(data === null || data === void 0 ? void 0 : data.agent_id);
        // Closures are dated to the local day, appointments to the instant: the
        // bridge is made here, not in the browser, so a day reads the same from
        // anywhere. Read in the leaf's zone (a scheduler with its own is rare).
        const tz = timezoneOf();
        const Customer = customerModel();
        const customerAs = associationTo(BookingAppointment, Customer);
        const subject = state.config.subject;
        const Subject = projectModel(subject === null || subject === void 0 ? void 0 : subject.model);
        const subjectAs = associationTo(BookingAppointment, Subject);
        const subjectName = (_a = subject === null || subject === void 0 ? void 0 : subject.displayField) !== null && _a !== void 0 ? _a : 'name';
        const agentAttributes = ['id', 'first_name', 'last_name', 'email'];
        const [appointmentRows, closureRows, agents, schedulers] = yield Promise.all([
            BookingAppointment.findAll({
                where: Object.assign(Object.assign({ starts_at: { [Op.between]: [from, to] } }, (schedulerId ? { scheduler_id: schedulerId } : {})), (agentId ? { agent_id: agentId } : {})),
                include: [
                    { association: 'agent', attributes: agentAttributes, required: false },
                    ...(customerAs
                        ? [{ association: customerAs, attributes: attributesOf(Customer, ['id', 'email', 'first_name', 'last_name', 'phone_number']), required: false }]
                        : []),
                    ...(subjectAs ? [{ association: subjectAs, attributes: attributesOf(Subject, ['id', subjectName]), required: false }] : []),
                    { association: 'scheduler', attributes: ['id', 'label'], required: false },
                ],
                order: [['starts_at', 'ASC']],
            }),
            SchedulerBlock.findAll({
                where: {
                    day: { [Op.between]: [zonedDayKey(from, tz), zonedDayKey(to, tz)] },
                    // A general closure has no scheduler nor employee: it holds
                    // whatever the filter, or the day would look open. `Op.and`:
                    // two `Op.or` spread in one object, the second would erase the first.
                    [Op.and]: [
                        ...(schedulerId ? [{ [Op.or]: [{ scheduler_id: schedulerId }, { scheduler_id: null }] }] : []),
                        ...(agentId ? [{ [Op.or]: [{ agent_id: agentId }, { agent_id: null }] }] : []),
                    ],
                },
                include: [
                    { association: 'agent', attributes: agentAttributes, required: false },
                    { association: 'scheduler', attributes: ['id', 'label'], required: false },
                ],
                order: [['day', 'ASC']],
            }),
            Agent.findAll({ where: { active: true }, attributes: agentAttributes, order: [['first_name', 'ASC']] }),
            Scheduler.findAll({ attributes: ['id', 'label'], order: [['id', 'ASC']] }),
        ]);
        const appointments = appointmentRows.map((a) => {
            var _a;
            const end = a.ends_at ? zonedParts(a.ends_at, tz) : null;
            const customer = customerAs ? a[customerAs] : null;
            const about = subjectAs ? a[subjectAs] : null;
            return {
                id: a.id,
                day: zonedDayKey(a.starts_at, tz),
                start_label: minutesToLabel(zonedParts(a.starts_at, tz).minute),
                end_label: end ? minutesToLabel(end.minute) : null,
                starts_at: a.starts_at.toISOString(),
                duration_minutes: a.duration_minutes,
                status: a.status,
                // RETAL's Salesforce mirror status, read by the shared back-office: none here.
                sf_sync_status: null,
                agent: a.agent ? { id: a.agent.id, name: agentLabel(a.agent) } : null,
                customer: customer ? { id: customer.id, email: customerLabel(customer) } : a.user_id ? { id: a.user_id, email: `#${a.user_id}` } : null,
                // `property`: the key the shared back-office reads (the property at RETAL), here the subject.
                property: about ? { id: about.id, name: (_a = about[subjectName]) !== null && _a !== void 0 ? _a : `#${about.id}` } : null,
                scheduler: a.scheduler ? { id: a.scheduler.id, label: a.scheduler.label } : null,
            };
        });
        const closures = closureRows.map((b) => ({
            id: b.id,
            day: b.day,
            start_label: b.start_minute != null ? minutesToLabel(b.start_minute) : null,
            end_label: b.end_minute != null ? minutesToLabel(b.end_minute) : null,
            reason: b.reason || null,
            agent: b.agent ? { id: b.agent.id, name: agentLabel(b.agent) } : null,
            scheduler: b.scheduler ? { id: b.scheduler.id, label: b.scheduler.label } : null,
        }));
        return {
            timezone: tz,
            // Where an appointment opens.
            collection: APPOINTMENTS_COLLECTION,
            from: zonedDayKey(from, tz),
            to: zonedDayKey(to, tz),
            appointments,
            closures,
            // The filters come with the data: the page needn't query two more collections.
            agents: agents.map((a) => ({ id: a.id, name: agentLabel(a) })),
            schedulers: schedulers.map((s) => ({ id: s.id, label: s.label || `#${s.id}` })),
        };
    }));
}
