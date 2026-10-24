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
import { Op } from 'sequelize';
import { CaseAttention, CaseStatus, OPEN_CASE_STATUSES } from './statuses.js';
// ──────────────────────────────────────────────────────────────────────────
// The clocks: when a case must be answered and resolved (the SLA policies),
// and whether it is late. The due times are written on the case when it
// opens (and again when what they depend on changes), so the list sorts and
// filters on them and a policy changed later does not move a promise made.
// ──────────────────────────────────────────────────────────────────────────
const HOUR = 3600 * 1000;
const CACHE_MS = 60 * 1000;
let cache = null;
/** Drops the policies read: the next case reads them again. */
export function forgetSlaPolicies() {
    cache = null;
}
function activePolicies() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        if (cache && Date.now() - cache.at < CACHE_MS)
            return cache.policies;
        const model = (_c = (_b = (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize) === null || _b === void 0 ? void 0 : _b.models) === null || _c === void 0 ? void 0 : _c.CaseSlaPolicy;
        if (!model)
            return [];
        const rows = yield model.findAll({ where: { active: true }, order: [['id', 'ASC']], raw: true });
        cache = { at: Date.now(), policies: rows };
        return rows;
    });
}
/** The most specific active policy naming nothing the case contradicts; the oldest of equals. */
export function policyFor(kase) {
    return __awaiter(this, void 0, void 0, function* () {
        let best = null;
        let bestScore = -1;
        for (const policy of yield activePolicies()) {
            const fields = ['kind', 'category', 'priority'];
            if (fields.some((f) => policy[f] !== null && policy[f] !== kase[f]))
                continue;
            const score = fields.filter((f) => policy[f] !== null).length;
            if (score > bestScore) {
                best = policy;
                bestScore = score;
            }
        }
        return best;
    });
}
const after = (from, hours) => typeof hours === 'number' && hours > 0 ? new Date(from.getTime() + hours * HOUR) : null;
/** When the first answer and the resolution are due, counted from `from`. */
export function dueDates(kase, from) {
    return __awaiter(this, void 0, void 0, function* () {
        const policy = yield policyFor(kase);
        return {
            first_response_due_at: after(from, policy === null || policy === void 0 ? void 0 : policy.first_response_hours),
            resolution_due_at: after(from, policy === null || policy === void 0 ? void 0 : policy.resolution_hours),
        };
    });
}
/** Staff are late on it: not answered in time, or not resolved in time. Waiting on the customer stops nothing but the alarm. */
export function isOverdue(kase, now = new Date()) {
    if (!OPEN_CASE_STATUSES.includes(kase.status) || kase.status === CaseStatus.WAITING_ON_CUSTOMER)
        return false;
    const past = (date) => !!date && new Date(date).getTime() < now.getTime();
    return (!kase.first_response_at && past(kase.first_response_due_at)) || past(kase.resolution_due_at);
}
/**
 * The cases to flag overdue now. The same rule as `isOverdue`, in SQL; the
 * cases read from elsewhere have no due time, so they never match.
 */
export function overdueWhere(now = new Date()) {
    return {
        status: { [Op.in]: OPEN_CASE_STATUSES.filter((s) => s !== CaseStatus.WAITING_ON_CUSTOMER) },
        attention: { [Op.or]: [{ [Op.is]: null }, { [Op.ne]: CaseAttention.OVERDUE }] },
        [Op.or]: [{ first_response_at: null, first_response_due_at: { [Op.lt]: now } }, { resolution_due_at: { [Op.lt]: now } }],
    };
}
/**
 * What the case asks of staff, from its state: hooks keep `overdue` only
 * while it still holds (the clock alone sets it, to alert once), else
 * `reply` while the customer waits for an answer.
 */
export function attentionOf(kase, now = new Date()) {
    if (!OPEN_CASE_STATUSES.includes(kase.status) || kase.status === CaseStatus.WAITING_ON_CUSTOMER)
        return null;
    if (kase.attention === CaseAttention.OVERDUE && isOverdue(kase, now))
        return CaseAttention.OVERDUE;
    return kase.awaiting_reply_since ? CaseAttention.REPLY : null;
}
