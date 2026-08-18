// ──────────────────────────────────────────────────────────────────────────
// "Have we already done this?"
//
// The problem this exists for, in the customer's words: *every ten minutes,
// look for appointments starting within 24 hours and send a reminder*. The
// condition is true at 10:00, and still true at 10:10, and at 10:20 — the same
// appointment matches thirty-six times before it stops matching, and the
// customer receives thirty-six notifications.
//
// The fix is an idempotency key claimed in the database before the run starts.
// Claiming is an INSERT against a unique index, so two workers racing on the
// same appointment produce one winner and one duplicate-key error, with no
// coordination between them. The alternative — reading recent runs and checking
// whether one already covered this record — has a window between the read and
// the write, and that window is exactly where the double send lives.
// ──────────────────────────────────────────────────────────────────────────
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { createHash } from 'crypto';
import { Op } from 'sequelize';
import { FlowRunKey } from '../models/FlowRunKey.js';
import { formatDate } from './template.js';
/**
 * The repeat policy, offered under every trigger in the builder.
 *
 * Worth stating plainly in the UI because the default is the dangerous one:
 * `always` is right for "a ticket was answered" and catastrophic for "an
 * appointment starts within 24 hours".
 */
export function dedupFields() {
    return [
        {
            name: 'dedup_mode',
            type: 'select',
            label: 'Repeat',
            defaultValue: 'always',
            helpText: 'A trigger that keeps matching the same record — "starts within 24 hours" — needs a limit, or it fires on every check.',
            options: [
                { value: 'always', label: 'Every time it matches' },
                { value: 'once_per_record', label: 'Once per record, ever' },
                { value: 'once_per_day', label: 'Once per record per day' },
                { value: 'every_n_hours', label: 'Once per record every N hours' },
                { value: 'custom', label: 'Once per custom key' },
            ],
        },
        {
            name: 'dedup_hours',
            type: 'number',
            label: 'Hours between repeats',
            defaultValue: 24,
            min: 1,
            showIf: { field: 'dedup_mode', operator: 'eq', value: 'every_n_hours' },
        },
        {
            name: 'dedup_key',
            type: 'string',
            label: 'Key',
            helpText: 'Runs once per distinct value, e.g. {{record.id}}-{{record.status}}.',
            showIf: { field: 'dedup_mode', operator: 'eq', value: 'custom' },
        },
        {
            name: 'dedup_expires_hours',
            type: 'number',
            label: 'Forget the key after (hours)',
            helpText: 'Leave empty to remember forever.',
            showIf: { field: 'dedup_mode', operator: 'eq', value: 'custom' },
        },
    ];
}
/**
 * Builds the key for one candidate run, or null when the flow accepts repeats.
 *
 * The time window is folded *into* the key rather than compared against a
 * timestamp: with a `2026-08-19` suffix, "once a day" is the same insert as
 * "once ever", and there is no second code path to get wrong.
 */
export function planDedup(triggerConfig, args) {
    var _a;
    const mode = (triggerConfig === null || triggerConfig === void 0 ? void 0 : triggerConfig.dedup_mode) || 'always';
    if (mode === 'always')
        return null;
    const now = (_a = args.now) !== null && _a !== void 0 ? _a : new Date();
    const recordId = args.recordId === null || args.recordId === undefined ? 'none' : String(args.recordId);
    switch (mode) {
        case 'once_per_record':
            return { key: shorten(`${args.triggerId}:${recordId}`), expiresAt: null };
        case 'once_per_day': {
            const day = formatDate(now, 'YYYY-MM-DD', args.timezone);
            return {
                key: shorten(`${args.triggerId}:${recordId}:${day}`),
                // Kept a while past the window: the row's only remaining job is to
                // be found by a late tick, and the sweeper reclaims it after.
                expiresAt: new Date(now.getTime() + 7 * 24 * 3600 * 1000),
            };
        }
        case 'every_n_hours': {
            const hours = Math.max(1, Number(triggerConfig.dedup_hours) || 24);
            const bucket = Math.floor(now.getTime() / (hours * 3600 * 1000));
            return {
                key: shorten(`${args.triggerId}:${recordId}:${hours}h:${bucket}`),
                expiresAt: new Date(now.getTime() + 2 * hours * 3600 * 1000),
            };
        }
        case 'custom': {
            const template = String(triggerConfig.dedup_key || '').trim();
            // An empty custom key would collapse every record onto one row and
            // the flow would run exactly once in its life. Better to let it run.
            if (!template)
                return null;
            const rendered = args.render(template).trim();
            if (!rendered)
                return null;
            const expiresHours = Number(triggerConfig.dedup_expires_hours);
            return {
                key: shorten(`${args.triggerId}:${rendered}`),
                expiresAt: Number.isFinite(expiresHours) && expiresHours > 0
                    ? new Date(now.getTime() + expiresHours * 3600 * 1000)
                    : null,
            };
        }
        default:
            return null;
    }
}
/** The column holds 191 characters; anything longer becomes its own digest. */
function shorten(key) {
    if (key.length <= 191)
        return key;
    return `${key.slice(0, 150)}#${createHash('sha1').update(key).digest('hex').slice(0, 32)}`;
}
/**
 * Takes the key, or reports that someone else already has it.
 *
 * An expired key is reclaimed in place rather than deleted and re-inserted:
 * the update is conditional on the row still being expired, so a racing worker
 * updates zero rows and backs off.
 */
export function claim(flowId, plan) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const now = new Date();
        try {
            yield FlowRunKey.create({
                flow_id: flowId,
                key: plan.key,
                expires_at: plan.expiresAt,
                created_at: now,
            });
            return true;
        }
        catch (error) {
            const name = (error === null || error === void 0 ? void 0 : error.name) || '';
            const isDuplicate = name === 'SequelizeUniqueConstraintError' ||
                ((_a = error === null || error === void 0 ? void 0 : error.original) === null || _a === void 0 ? void 0 : _a.code) === 'ER_DUP_ENTRY' ||
                ((_b = error === null || error === void 0 ? void 0 : error.original) === null || _b === void 0 ? void 0 : _b.code) === '23505';
            if (!isDuplicate)
                throw error;
            const [reclaimed] = yield FlowRunKey.update({ expires_at: plan.expiresAt, created_at: now }, {
                where: {
                    flow_id: flowId,
                    key: plan.key,
                    expires_at: { [Op.ne]: null, [Op.lt]: now },
                },
            });
            return reclaimed > 0;
        }
    });
}
/** Attaches the run to its key, so an operator can see what the key stopped. */
export function attachRun(flowId, key, runId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield FlowRunKey.update({ run_id: runId }, { where: { flow_id: flowId, key } });
        }
        catch (_a) {
            // Bookkeeping only — never worth failing a successful run over.
        }
    });
}
/** Releases a key whose run never started, so a retry is not blocked by it. */
export function release(flowId, key) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield FlowRunKey.destroy({ where: { flow_id: flowId, key, run_id: null } });
        }
        catch (_a) {
            // Same: the sweeper will get it.
        }
    });
}
export function sweepExpired() {
    return __awaiter(this, void 0, void 0, function* () {
        return FlowRunKey.destroy({
            where: { expires_at: { [Op.ne]: null, [Op.lt]: new Date() } },
        });
    });
}
export function forgetFlow(flowId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield FlowRunKey.destroy({ where: { flow_id: flowId } });
    });
}
