// ──────────────────────────────────────────────────────────────────────────
// Time-based triggers.
//
// `schedule.cron` runs the flow on a clock. `schedule.query` runs it *once per
// matching record* — which is the shape the customer's own example needs:
//
//   every 10 minutes, look for appointments starting within 24 hours,
//   and notify — without sending the same reminder six times an hour.
//
// The first half is here; the second half is the repeat policy on the trigger,
// which turns the thirty-six matches of one appointment into one run.
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
import { Op } from 'sequelize';
import { Flow } from '../models/Flow.js';
import { leafConfig } from '../config.js';
import { registry } from '../registry/Registry.js';
import { runFlow } from '../engine/fire.js';
import { toWhere, filterableFields, OPERATOR_OPTIONS } from '../engine/filters.js';
import { listCollections, getModel, collectionLabelPlural, collectionOutputFields, dateFieldOptions, } from '../registry/admin.js';
import { cronFromConfig, matchesCron, zonedMinute } from '../scheduler/cron.js';
const UNITS = [
    { value: 'minutes', label: 'minutes' },
    { value: 'hours', label: 'hours' },
    { value: 'days', label: 'days' },
];
const UNIT_MS = {
    minutes: 60 * 1000,
    hours: 3600 * 1000,
    days: 24 * 3600 * 1000,
};
/** The "when does this run" half, shared by both schedule triggers. */
function cadenceFields(defaultMode = 'daily') {
    return [
        {
            name: 'mode',
            type: 'select',
            label: 'Check',
            defaultValue: defaultMode,
            options: [
                { value: 'every_minutes', label: 'Every few minutes' },
                { value: 'hourly', label: 'Every hour' },
                { value: 'daily', label: 'Every day' },
                { value: 'weekly', label: 'Every week' },
                { value: 'monthly', label: 'Every month' },
                { value: 'cron', label: 'Custom (cron)' },
            ],
        },
        {
            name: 'every_minutes',
            type: 'number',
            label: 'Every (minutes)',
            defaultValue: 10,
            min: 1,
            max: 59,
            showIf: { field: 'mode', operator: 'eq', value: 'every_minutes' },
        },
        {
            name: 'minute',
            type: 'number',
            label: 'At minute',
            defaultValue: 0,
            min: 0,
            max: 59,
            showIf: { field: 'mode', operator: 'eq', value: 'hourly' },
        },
        {
            name: 'time',
            type: 'string',
            label: 'At',
            defaultValue: '09:00',
            helpText: 'HH:MM, in the workspace timezone.',
            showIf: { field: 'mode', operator: 'in', value: ['daily', 'weekly', 'monthly'] },
        },
        {
            name: 'weekday',
            type: 'select',
            label: 'On',
            defaultValue: 1,
            options: [
                { value: 1, label: 'Monday' },
                { value: 2, label: 'Tuesday' },
                { value: 3, label: 'Wednesday' },
                { value: 4, label: 'Thursday' },
                { value: 5, label: 'Friday' },
                { value: 6, label: 'Saturday' },
                { value: 0, label: 'Sunday' },
            ],
            showIf: { field: 'mode', operator: 'eq', value: 'weekly' },
        },
        {
            name: 'day_of_month',
            type: 'number',
            label: 'Day of the month',
            defaultValue: 1,
            min: 1,
            max: 28,
            helpText: 'Capped at 28 so it exists in February.',
            showIf: { field: 'mode', operator: 'eq', value: 'monthly' },
        },
        {
            name: 'cron',
            type: 'string',
            label: 'Cron expression',
            helpText: 'Five fields — minute hour day month weekday.',
            showIf: { field: 'mode', operator: 'eq', value: 'cron' },
        },
    ];
}
function collectionOptions() {
    return listCollections().map((collection) => ({
        value: collection.name,
        label: collectionLabelPlural(collection),
    }));
}
export const scheduleTrigger = {
    id: 'schedule.cron',
    label: 'On a schedule',
    description: 'Runs the automation on a clock, with no particular record.',
    icon: 'Clock',
    kind: 'schedule',
    group: 'Schedule',
    config: cadenceFields('daily'),
};
export const queryTrigger = {
    id: 'schedule.query',
    label: 'When a record reaches a date',
    description: 'Checks regularly for records whose date falls inside a window — "starts within 24 hours", "was created more than 3 days ago" — and runs once per record.',
    icon: 'CalendarClock',
    kind: 'query',
    group: 'Schedule',
    collection: undefined,
    config: (config) => [
        {
            name: 'collection',
            type: 'select',
            label: 'Look at',
            required: true,
            options: collectionOptions(),
        },
        {
            name: 'date_field',
            type: 'select',
            label: 'Using the date',
            required: true,
            options: dateFieldOptions(config === null || config === void 0 ? void 0 : config.collection),
            showIf: { field: 'collection', operator: 'truthy' },
        },
        {
            name: 'direction',
            type: 'select',
            label: 'That falls',
            defaultValue: 'upcoming',
            options: [
                { value: 'upcoming', label: 'In the future' },
                { value: 'past', label: 'In the past' },
            ],
        },
        {
            name: 'within_amount',
            type: 'number',
            label: 'Within',
            defaultValue: 24,
            min: 1,
            required: true,
        },
        {
            name: 'within_unit',
            type: 'select',
            label: 'Unit',
            defaultValue: 'hours',
            options: UNITS,
        },
        {
            name: 'from_amount',
            type: 'number',
            label: 'But not before',
            defaultValue: 0,
            min: 0,
            helpText: 'Leave at 0 for "within". Set it to narrow the window — 23 and 24 hours together mean "roughly a day before".',
        },
        {
            name: 'filters',
            type: 'json',
            widget: 'flow-filters',
            label: 'Only records where',
            defaultValue: [],
            // The widget needs to know which columns and operators exist; it
            // reads them from the field definition rather than fetching the
            // collection schema a second time.
            options: [
                ...filterableFields(config === null || config === void 0 ? void 0 : config.collection).map((field) => ({
                    value: `field:${field.value}`,
                    label: field.label,
                })),
                ...OPERATOR_OPTIONS.map((operator) => ({
                    value: `operator:${operator.value}`,
                    label: operator.label,
                })),
            ],
            showIf: { field: 'collection', operator: 'truthy' },
        },
        {
            name: 'limit',
            type: 'number',
            label: 'Records per check',
            defaultValue: 100,
            min: 1,
            max: 1000,
            helpText: 'A safety valve — a mistyped window should not start ten thousand runs.',
        },
        ...cadenceFields('every_minutes'),
    ],
    output: (config) => (config === null || config === void 0 ? void 0 : config.collection) ? collectionOutputFields(config.collection) : [],
};
export function registerScheduleTriggers() {
    registry.registerTrigger(scheduleTrigger);
    registry.registerTrigger(queryTrigger);
}
// ─── The tick ─────────────────────────────────────────────────────────────
/** Whether a scheduled flow is due at this minute, and has not run in it. */
function isDue(flow, now, timezone) {
    var _a;
    const expression = cronFromConfig((_a = flow.trigger_config) !== null && _a !== void 0 ? _a : {});
    if (!expression)
        return false;
    if (!matchesCron(expression, zonedMinute(now, timezone)))
        return false;
    // The ticker may run more than once inside a minute — after a restart, or
    // with two processes up. Whole-minute granularity is what the schedule
    // promises, so the same minute never fires twice.
    if (flow.last_tick_at) {
        const previous = new Date(flow.last_tick_at);
        if (Math.floor(previous.getTime() / 60000) === Math.floor(now.getTime() / 60000))
            return false;
    }
    return true;
}
/**
 * Claims this minute for a flow.
 *
 * Conditional on the value the tick was decided from, so of two processes
 * reaching the same flow at the same time exactly one updates a row and the
 * other walks away — the same trick as the dedup key, one level up.
 */
function claimTick(flow, now) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const [claimed] = yield Flow.update({ last_tick_at: now }, {
            where: { id: flow.id, last_tick_at: ((_a = flow.last_tick_at) !== null && _a !== void 0 ? _a : null) },
        });
        if (claimed === 0)
            return false;
        flow.last_tick_at = now;
        return true;
    });
}
function tickQueryFlow(flow, now) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const config = (_a = flow.trigger_config) !== null && _a !== void 0 ? _a : {};
        const collectionName = config.collection;
        const dateField = config.date_field;
        if (!collectionName || !dateField)
            return 0;
        const model = getModel(collectionName);
        if (!model) {
            console.warn(`[ETHFlowLeaf] Flow #${flow.id} watches unknown collection "${collectionName}"`);
            return 0;
        }
        const unit = (_b = UNIT_MS[config.within_unit]) !== null && _b !== void 0 ? _b : UNIT_MS.hours;
        const within = Math.max(0, Number(config.within_amount) || 0) * unit;
        const from = Math.max(0, Number(config.from_amount) || 0) * unit;
        const upcoming = ((_c = config.direction) !== null && _c !== void 0 ? _c : 'upcoming') === 'upcoming';
        const window = upcoming
            ? { [Op.gte]: new Date(now.getTime() + from), [Op.lte]: new Date(now.getTime() + within) }
            : { [Op.gte]: new Date(now.getTime() - within), [Op.lte]: new Date(now.getTime() - from) };
        const where = {
            [Op.and]: [{ [dateField]: window }, toWhere(config.filters, 'all')],
        };
        const records = yield model.findAll({
            where,
            order: [[dateField, upcoming ? 'ASC' : 'DESC']],
            limit: Math.min(1000, Math.max(1, Number(config.limit) || 100)),
        });
        let started = 0;
        for (const record of records) {
            try {
                const outcome = yield runFlow(flow, { triggerId: flow.trigger_id, record });
                if (outcome.run)
                    started += 1;
            }
            catch (error) {
                console.error(`[ETHFlowLeaf] Flow "${flow.name}" failed on a record:`, error);
            }
        }
        return started;
    });
}
/**
 * One pass over the scheduled flows. Called every minute by the ticker.
 *
 * Flows are handled one after another rather than all at once: a customer's
 * scheduled query can return a hundred records, and a hundred parallel runs
 * hammering the same database is a worse failure than a slow tick.
 */
export function runScheduleTick() {
    return __awaiter(this, arguments, void 0, function* (now = new Date()) {
        var _a, _b;
        const timezone = leafConfig().timezone;
        const flows = yield Flow.findAll({
            where: {
                enabled: true,
                deleted_at: null,
                trigger_id: { [Op.in]: ['schedule.cron', 'schedule.query'] },
            },
            order: [['id', 'ASC']],
        });
        let touched = 0;
        let runs = 0;
        for (const flow of flows) {
            try {
                if (!isDue(flow, now, timezone))
                    continue;
                if (!(yield claimTick(flow, now)))
                    continue;
                touched += 1;
                if (flow.trigger_id === 'schedule.query') {
                    runs += yield tickQueryFlow(flow, now);
                    continue;
                }
                const outcome = yield runFlow(flow, { triggerId: flow.trigger_id });
                if (outcome.run)
                    runs += 1;
            }
            catch (error) {
                console.error(`[ETHFlowLeaf] Scheduled flow "${flow.name}" failed:`, error);
                yield flow
                    .update({
                    last_error: (_a = error === null || error === void 0 ? void 0 : error.message) !== null && _a !== void 0 ? _a : String(error),
                    error_count: ((_b = flow.error_count) !== null && _b !== void 0 ? _b : 0) + 1,
                })
                    .catch(() => undefined);
            }
        }
        return { flows: touched, runs };
    });
}
