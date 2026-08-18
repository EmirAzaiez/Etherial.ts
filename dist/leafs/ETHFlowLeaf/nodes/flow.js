// ──────────────────────────────────────────────────────────────────────────
// Control.
//
// Waiting, looping, remembering a value. `flow.wait` is the reason the engine
// is a stack machine rather than a recursive walk: a step that suspends the run
// for two days has to survive every deploy in between, so the run's position is
// data in a row, not a place in a call stack.
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
import { registry } from '../registry/Registry.js';
import { formatDate } from '../engine/template.js';
const UNIT_MS = {
    minutes: 60 * 1000,
    hours: 3600 * 1000,
    days: 24 * 3600 * 1000,
};
/** Nothing is allowed to sleep longer than this. */
const MAX_WAIT_MS = 90 * 24 * 3600 * 1000;
export const waitNode = {
    id: 'flow.wait',
    label: 'Wait',
    description: 'Pauses the automation and picks it up later, from wherever it left off.',
    icon: 'Timer',
    category: 'flow',
    config: [
        {
            name: 'mode',
            type: 'select',
            label: 'Wait',
            defaultValue: 'duration',
            options: [
                { value: 'duration', label: 'For a while' },
                { value: 'until', label: 'Until a date' },
                { value: 'time_of_day', label: 'Until a time of day' },
            ],
        },
        {
            name: 'amount',
            type: 'number',
            label: 'For',
            defaultValue: 1,
            min: 1,
            showIf: { field: 'mode', operator: 'eq', value: 'duration' },
        },
        {
            name: 'unit',
            type: 'select',
            label: 'Unit',
            defaultValue: 'hours',
            options: [
                { value: 'minutes', label: 'minutes' },
                { value: 'hours', label: 'hours' },
                { value: 'days', label: 'days' },
            ],
            showIf: { field: 'mode', operator: 'eq', value: 'duration' },
        },
        {
            name: 'date',
            type: 'string',
            label: 'Until',
            helpText: 'A date, usually from the record — {{record.starts_at}}.',
            showIf: { field: 'mode', operator: 'eq', value: 'until' },
        },
        {
            name: 'offset_minutes',
            type: 'number',
            label: 'Offset (minutes)',
            defaultValue: 0,
            helpText: 'Negative to land before the date — -60 is an hour ahead of it.',
            showIf: { field: 'mode', operator: 'eq', value: 'until' },
        },
        {
            name: 'time',
            type: 'string',
            label: 'At',
            defaultValue: '09:00',
            helpText: 'The next time the clock reads this. HH:MM.',
            showIf: { field: 'mode', operator: 'eq', value: 'time_of_day' },
        },
    ],
    output: [{ key: 'until', label: 'Resumed at', type: 'date' }],
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ config, context, log }) {
        var _b;
        const now = new Date();
        let until;
        if (config.mode === 'until') {
            const parsed = new Date(config.date);
            if (Number.isNaN(parsed.getTime())) {
                // A wait that cannot read its date would otherwise pause the run
                // forever; carrying straight on is the recoverable failure.
                log(`Could not read "${config.date}" as a date — continuing without waiting`);
                return {};
            }
            until = new Date(parsed.getTime() + (Number(config.offset_minutes) || 0) * 60 * 1000);
        }
        else if (config.mode === 'time_of_day') {
            until = nextTimeOfDay(now, String(config.time || '09:00'), context.timezone);
        }
        else {
            const unit = (_b = UNIT_MS[config.unit]) !== null && _b !== void 0 ? _b : UNIT_MS.hours;
            until = new Date(now.getTime() + Math.max(1, Number(config.amount) || 1) * unit);
        }
        if (until.getTime() <= now.getTime()) {
            log('That moment has already passed — continuing straight away');
            return {};
        }
        if (until.getTime() - now.getTime() > MAX_WAIT_MS) {
            log('Capped at 90 days');
            until = new Date(now.getTime() + MAX_WAIT_MS);
        }
        log(`Waiting until ${until.toISOString()}`);
        return { waitUntil: until, output: { until: until.toISOString() } };
    }),
};
/**
 * The next instant the clock reads `HH:MM` in the run's timezone.
 *
 * Walked minute-shifted rather than computed: adding a day to a UTC timestamp
 * gives the wrong wall-clock hour across a daylight saving boundary, and "every
 * morning at nine" is exactly the kind of flow that runs across one.
 */
function nextTimeOfDay(from, time, timezone) {
    const match = /^(\d{1,2}):(\d{2})/.exec(time);
    const targetHour = match ? Number(match[1]) : 9;
    const targetMinute = match ? Number(match[2]) : 0;
    for (let minutes = 1; minutes <= 48 * 60; minutes += 1) {
        const candidate = new Date(from.getTime() + minutes * 60 * 1000);
        const hour = Number(formatDate(candidate, 'HH', timezone));
        const minute = Number(formatDate(candidate, 'mm', timezone));
        if (hour === targetHour && minute === targetMinute)
            return candidate;
    }
    return new Date(from.getTime() + 24 * 3600 * 1000);
}
export const forEachNode = {
    id: 'flow.for_each',
    label: 'For each',
    description: 'Runs the steps on its Each branch once per item, then continues along Then.',
    icon: 'Repeat',
    category: 'flow',
    config: [
        {
            name: 'items',
            type: 'string',
            label: 'Items',
            required: true,
            helpText: 'A list, usually from a previous step — {{steps.find_customers.records}}.',
        },
        {
            name: 'limit',
            type: 'number',
            label: 'At most',
            defaultValue: 100,
            min: 1,
            max: 1000,
        },
    ],
    branches: [
        { id: 'item', label: 'Each' },
        { id: 'done', label: 'Then' },
    ],
    output: [
        { key: 'items', label: 'Items', type: 'array' },
        { key: 'count', label: 'Count', type: 'number' },
    ],
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ config, log }) {
        const raw = config.items;
        const items = Array.isArray(raw) ? raw : raw === null || raw === undefined || raw === '' ? [] : [raw];
        const limit = Math.min(1000, Math.max(1, Number(config.limit) || 100));
        const capped = items.slice(0, limit);
        if (items.length > capped.length) {
            log(`${items.length} items, stopping at ${limit}`);
        }
        else {
            log(`${capped.length} item${capped.length === 1 ? '' : 's'}`);
        }
        return { output: { items: capped, count: capped.length } };
    }),
};
export const setNode = {
    id: 'flow.set',
    label: 'Set a value',
    description: 'Stores something for later, readable anywhere below as {{vars.name}}.',
    icon: 'Variable',
    category: 'flow',
    config: [
        { name: 'name', type: 'string', label: 'Name', required: true },
        { name: 'value', type: 'text', label: 'Value' },
    ],
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ config, context, log }) {
        var _b;
        const name = String((_b = config.name) !== null && _b !== void 0 ? _b : '').trim();
        if (!name)
            return {};
        context.state.vars[name] = config.value;
        log(`${name} = ${typeof config.value === 'object' ? JSON.stringify(config.value) : config.value}`);
        return { output: { name, value: config.value } };
    }),
};
export const logNode = {
    id: 'flow.log',
    label: 'Note',
    description: 'Writes a line into the run log. Costs nothing and answers "what did it think it was doing".',
    icon: 'NotebookPen',
    category: 'flow',
    config: [{ name: 'message', type: 'text', label: 'Message', required: true }],
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ config, log }) {
        var _b;
        log(String((_b = config.message) !== null && _b !== void 0 ? _b : ''));
        return { output: { message: config.message } };
    }),
};
export function registerFlowNodes() {
    registry.registerNode(waitNode);
    registry.registerNode(forEachNode);
    registry.registerNode(setNode);
    registry.registerNode(logNode);
}
