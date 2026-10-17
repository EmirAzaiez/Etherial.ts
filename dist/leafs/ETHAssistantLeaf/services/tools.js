// ──────────────────────────────────────────────────────────────────────────
// The look-ups the assistant may make: describe a collection, count its
// records (by group, by day or month), list them, open one. Read-only, run as
// the staff member, on the fields `catalog.ts` lets through. Each answer says
// where to see the same thing in the back-office.
//
// Days are cut the way the back-office lists cut them, in the database's time
// zone, so that "42 bookings" here is 42 rows behind the link.
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
import etherial from 'etherial';
import { Op, fn, literal } from 'sequelize';
import { describe, readable } from './catalog.js';
import { state } from './state.js';
import { timezoneOf } from './options.js';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const OPS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'contains', 'is_null', 'not_null'];
const BUCKETS = ['day', 'week', 'month', 'year'];
const TEXT_TYPES = new Set(['string', 'text', 'email', 'url', 'phone']);
const MAX_ROWS = 25;
const MAX_GROUPS = 40;
/** What one look-up may hand back, in characters: past it, rows are dropped. */
const MAX_RESULT = 24000;
/** A look-up that cannot run as asked: told to the assistant, which tries again. */
export class ToolError extends Error {
}
// ── Definitions ─────────────────────────────────────────────────────────────
const FILTERS_SCHEMA = {
    type: 'array',
    description: 'All must match. Dates as YYYY-MM-DD are whole days: lte 2026-10-31 includes the 31st. Select fields take their value, not their label.',
    items: {
        type: 'object',
        properties: {
            field: { type: 'string' },
            op: { type: 'string', enum: [...OPS], description: 'Default eq. contains: text containing the value. in: value is a list.' },
            value: { description: 'Omitted for is_null and not_null.' },
        },
        required: ['field'],
    },
};
export const TOOLS = [
    {
        name: 'describe_collection',
        description: 'The fields of a collection: names, types, the values a choice can take, the collection a link points to. Call it before filtering a collection for the first time.',
        input_schema: {
            type: 'object',
            properties: { collection: { type: 'string', description: 'Its key, from the list of collections.' } },
            required: ['collection'],
        },
    },
    {
        name: 'count_records',
        description: 'How many records match, optionally broken down by a field (a status, a type, a project) or by period of a date field. Use it for every "how many" question rather than listing rows.',
        input_schema: {
            type: 'object',
            properties: {
                collection: { type: 'string' },
                filters: FILTERS_SCHEMA,
                search: { type: 'string', description: "Text looked for in the collection's searchable fields, like the list's search box." },
                group_by: { type: 'string', description: 'A field to break the count down by.' },
                period: { type: 'string', enum: [...BUCKETS], description: 'With a date field in group_by: count per day, week (from Monday), month or year.' },
            },
            required: ['collection'],
        },
    },
    {
        name: 'query_records',
        description: `Records that match, with their total. At most ${MAX_ROWS} rows: to know how many, use count_records.`,
        input_schema: {
            type: 'object',
            properties: {
                collection: { type: 'string' },
                filters: FILTERS_SCHEMA,
                search: { type: 'string', description: "Text looked for in the collection's searchable fields." },
                sort: {
                    type: 'object',
                    properties: { field: { type: 'string' }, direction: { type: 'string', enum: ['asc', 'desc'] } },
                    required: ['field'],
                },
                limit: { type: 'integer', minimum: 1, maximum: MAX_ROWS, description: 'Default 10.' },
                fields: { type: 'array', items: { type: 'string' }, description: "The fields to return. Default: the list's columns." },
            },
            required: ['collection'],
        },
    },
    {
        name: 'get_record',
        description: 'One record, every readable field.',
        input_schema: {
            type: 'object',
            properties: { collection: { type: 'string' }, id: { description: 'Its id.' } },
            required: ['collection', 'id'],
        },
    },
];
// ── Running a look-up ───────────────────────────────────────────────────────
export function runTool(name, input, context) {
    return __awaiter(this, void 0, void 0, function* () {
        const collection = collectionOf(input === null || input === void 0 ? void 0 : input.collection, context);
        context.read.add(collection.name);
        switch (name) {
            case 'describe_collection':
                return {
                    result: describe(collection, context.collections),
                    step: { tool: name, label: `Read the fields of ${collection.labelPlural}`, collection: collection.name },
                };
            case 'count_records':
                return count(collection, input);
            case 'query_records':
                return query(collection, input);
            case 'get_record':
                return getRecord(collection, input === null || input === void 0 ? void 0 : input.id);
            default:
                throw new ToolError(`Unknown tool ${name}`);
        }
    });
}
function collectionOf(name, context) {
    const collection = typeof name === 'string' ? context.collections.get(name) : undefined;
    if (!collection)
        throw new ToolError(`No readable collection "${String(name)}". Use a key from the list of collections.`);
    return collection;
}
function fieldOf(collection, name) {
    const field = collection.fields.find((f) => f.name === name);
    if (!field)
        throw new ToolError(`${collection.name} has no readable field "${String(name)}". Call describe_collection.`);
    return field;
}
const sequelize = () => { var _a; return (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize; };
const isPostgres = () => { var _a, _b; return ((_b = (_a = sequelize()) === null || _a === void 0 ? void 0 : _a.getDialect) === null || _b === void 0 ? void 0 : _b.call(_a)) === 'postgres'; };
const columnOf = (collection, name) => { var _a, _b; return ((_b = (_a = collection.model.rawAttributes) === null || _a === void 0 ? void 0 : _a[name]) === null || _b === void 0 ? void 0 : _b.field) || name; };
function shiftDay(day, days) {
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}
/** A value as the column holds it; a choice may be named by its label. */
function coerce(field, value) {
    var _a, _b;
    if (value === null || value === undefined)
        throw new ToolError(`A value is needed for ${field.name}`);
    switch (field.type) {
        case 'integer':
        case 'number': {
            const n = Number(value);
            if (!Number.isFinite(n))
                throw new ToolError(`${field.name} is a number, not "${String(value)}"`);
            return n;
        }
        case 'boolean':
            if (value === true || value === 'true' || value === 1 || value === '1')
                return true;
            if (value === false || value === 'false' || value === 0 || value === '0')
                return false;
            throw new ToolError(`${field.name} is true or false`);
        case 'date':
        case 'datetime': {
            const s = String(value);
            if (!DAY.test(s) && Number.isNaN(Date.parse(s)))
                throw new ToolError(`${field.name} takes a date (YYYY-MM-DD), not "${s}"`);
            return s;
        }
        case 'select': {
            const options = (_a = field.options) !== null && _a !== void 0 ? _a : [];
            const match = (_b = options.find((o) => String(o.value) === String(value))) !== null && _b !== void 0 ? _b : options.find((o) => o.label.toLowerCase() === String(value).toLowerCase());
            if (!match && options.length) {
                throw new ToolError(`${field.name} is one of: ${options.map((o) => String(o.value)).join(', ')}`);
            }
            return match ? match.value : value;
        }
        case 'relation': {
            const n = Number(value);
            return Number.isInteger(n) && String(value).trim() !== '' ? n : String(value);
        }
        default:
            return String(value);
    }
}
/** Sequelize's where for the filters and the search; dates by the day are whole days. */
function whereOf(collection, filters = [], search) {
    var _a, _b, _c;
    if (!Array.isArray(filters))
        throw new ToolError('filters is a list');
    const like = isPostgres() ? Op.iLike : Op.like;
    const and = [];
    for (const filter of filters) {
        const field = fieldOf(collection, filter === null || filter === void 0 ? void 0 : filter.field);
        const op = (_a = filter.op) !== null && _a !== void 0 ? _a : 'eq';
        if (!OPS.includes(op))
            throw new ToolError(`Unknown op "${op}"`);
        const name = field.name;
        const isDate = field.type === 'date' || field.type === 'datetime';
        const day = isDate && typeof filter.value === 'string' && DAY.test(filter.value) ? filter.value : null;
        switch (op) {
            case 'is_null':
                and.push({ [name]: { [Op.is]: null } });
                break;
            case 'not_null':
                and.push({ [name]: { [Op.not]: null } });
                break;
            case 'in': {
                const values = Array.isArray(filter.value) ? filter.value : String((_b = filter.value) !== null && _b !== void 0 ? _b : '').split(',');
                if (!values.length)
                    throw new ToolError('in takes a list of values');
                and.push({ [name]: { [Op.in]: values.slice(0, 200).map((v) => coerce(field, typeof v === 'string' ? v.trim() : v)) } });
                break;
            }
            case 'contains':
                if (!TEXT_TYPES.has(field.type))
                    throw new ToolError(`contains works on text, and ${name} is ${field.type}`);
                and.push({ [name]: { [like]: `%${String((_c = filter.value) !== null && _c !== void 0 ? _c : '').replace(/[\\%_]/g, (c) => `\\${c}`)}%` } });
                break;
            case 'eq':
                if (day && field.type === 'datetime')
                    and.push({ [name]: { [Op.gte]: day, [Op.lt]: shiftDay(day, 1) } });
                else
                    and.push({ [name]: coerce(field, filter.value) });
                break;
            case 'ne':
                and.push({ [name]: { [Op.ne]: coerce(field, filter.value) } });
                break;
            case 'gt':
                and.push(day && field.type === 'datetime' ? { [name]: { [Op.gte]: shiftDay(day, 1) } } : { [name]: { [Op.gt]: coerce(field, filter.value) } });
                break;
            case 'lte':
                and.push(day && field.type === 'datetime' ? { [name]: { [Op.lt]: shiftDay(day, 1) } } : { [name]: { [Op.lte]: coerce(field, filter.value) } });
                break;
            case 'gte':
                and.push({ [name]: { [Op.gte]: coerce(field, filter.value) } });
                break;
            case 'lt':
                and.push({ [name]: { [Op.lt]: coerce(field, filter.value) } });
                break;
        }
    }
    if (search) {
        if (!collection.search.length)
            throw new ToolError(`${collection.name} has no text search: filter a field with contains`);
        // As the list's search box does it, so the link finds the same rows.
        and.push({ [Op.or]: collection.search.map((name) => ({ [name]: { [like]: `%${search}%` } })) });
    }
    return and.length ? { [Op.and]: and } : {};
}
/**
 * The back-office list showing the same rows, when its filters can say it:
 * only fields the list filters on, equality on a choice, ranges of whole days
 * or of numbers. Anything else: no link rather than a wrong one.
 */
function linkOf(collection, filters = [], search) {
    var _a, _b, _c, _d;
    if (search && !collection.search.length)
        return undefined;
    const out = {};
    for (const filter of filters) {
        const field = collection.fields.find((f) => f.name === (filter === null || filter === void 0 ? void 0 : filter.field));
        if (!(field === null || field === void 0 ? void 0 : field.listFilter))
            return undefined;
        const op = (_a = filter.op) !== null && _a !== void 0 ? _a : 'eq';
        if (field.type === 'date' || field.type === 'datetime') {
            const value = String((_b = filter.value) !== null && _b !== void 0 ? _b : '');
            if (!DAY.test(value))
                return undefined;
            const range = (_c = out[field.name]) !== null && _c !== void 0 ? _c : {};
            if (op === 'gte')
                range.from = value;
            else if (op === 'gt')
                range.from = shiftDay(value, 1);
            else if (op === 'lte')
                range.to = value;
            else if (op === 'lt')
                range.to = shiftDay(value, -1);
            else if (op === 'eq')
                Object.assign(range, { from: value, to: value });
            else
                return undefined;
            out[field.name] = range;
        }
        else if (field.type === 'integer' || field.type === 'number') {
            const value = Number(filter.value);
            if (!Number.isFinite(value))
                return undefined;
            const range = (_d = out[field.name]) !== null && _d !== void 0 ? _d : {};
            const whole = field.type === 'integer' && Number.isInteger(value);
            if (op === 'gte')
                range.min = value;
            else if (op === 'lte')
                range.max = value;
            else if (op === 'gt' && whole)
                range.min = value + 1;
            else if (op === 'lt' && whole)
                range.max = value - 1;
            else if (op === 'eq')
                Object.assign(range, { min: value, max: value });
            else
                return undefined;
            out[field.name] = range;
        }
        else if (op === 'eq' && field.type !== 'multiselect') {
            if (field.name in out)
                return undefined;
            try {
                out[field.name] = coerce(field, filter.value);
            }
            catch (_e) {
                return undefined;
            }
        }
        else {
            return undefined;
        }
    }
    for (const range of Object.values(out)) {
        if (range && typeof range === 'object' && range.from && range.to && range.from > range.to)
            return undefined;
    }
    const params = new URLSearchParams();
    if (search)
        params.set('q', search);
    if (Object.keys(out).length)
        params.set('filters', JSON.stringify(out));
    const qs = params.toString();
    return `/${collection.name}${qs ? `?${qs}` : ''}`;
}
// ── Values as the assistant reads them ──────────────────────────────────────
function formatDate(value, withTime) {
    if (value === null || value === undefined || value === '')
        return null;
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime()))
        return String(value);
    if (!withTime)
        return typeof value === 'string' && DAY.test(value) ? value : date.toISOString().slice(0, 10);
    // In the project's zone: "the visit is at 10:00" means 10:00 there.
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezoneOf(state.config),
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type) => { var _a; return (_a = parts.find((p) => p.type === type)) === null || _a === void 0 ? void 0 : _a.value; };
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}
/** The names of the records a link field points to: one query per field. */
function relationLabels(field, ids) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const out = new Map();
        const unique = [...new Set(ids.filter((id) => id !== null && id !== undefined && id !== ''))];
        if (!unique.length || !field.relation)
            return out;
        // Named as the back-office names it, unless the project keeps that collection
        // from the assistant or the name is itself not for reading.
        const target = readable((_a = etherial.eth_admin_leaf) === null || _a === void 0 ? void 0 : _a.getCollection(field.relation.collection));
        const display = field.relation.displayField;
        if (!target || !target.fields.some((f) => f.name === display))
            return out;
        const pk = target.model.primaryKeyAttribute || 'id';
        try {
            const rows = yield target.model.findAll({ where: { [pk]: unique }, attributes: [pk, display], raw: true });
            for (const row of rows)
                if (row[display] !== null && row[display] !== undefined)
                    out.set(String(row[pk]), String(row[display]));
        }
        catch (_b) {
            // A name we cannot read is shown as its id.
        }
        return out;
    });
}
function present(collection, records, names, textLimit) {
    return __awaiter(this, void 0, void 0, function* () {
        const fields = names.map((n) => fieldOf(collection, n));
        const plain = records.map((r) => ((r === null || r === void 0 ? void 0 : r.get) ? r.get({ plain: true }) : r));
        const labels = new Map();
        for (const field of fields) {
            if (field.type === 'relation')
                labels.set(field.name, yield relationLabels(field, plain.map((r) => r[field.name])));
        }
        return plain.map((row) => {
            var _a, _b;
            const out = {};
            for (const field of fields) {
                const value = row[field.name];
                if (value === null || value === undefined || value === '') {
                    out[field.name] = null;
                    continue;
                }
                switch (field.type) {
                    case 'datetime':
                        out[field.name] = formatDate(value, true);
                        break;
                    case 'date':
                        out[field.name] = formatDate(value, false);
                        break;
                    case 'select': {
                        const option = (_a = field.options) === null || _a === void 0 ? void 0 : _a.find((o) => String(o.value) === String(value));
                        out[field.name] = option && option.label !== String(value) ? `${value} (${option.label})` : value;
                        break;
                    }
                    case 'relation': {
                        const label = (_b = labels.get(field.name)) === null || _b === void 0 ? void 0 : _b.get(String(value));
                        out[field.name] = label ? `${label} (#${value})` : `#${value}`;
                        break;
                    }
                    case 'text':
                    case 'string': {
                        const s = String(value);
                        out[field.name] = s.length > textLimit ? `${s.slice(0, textLimit)}…` : s;
                        break;
                    }
                    default:
                        out[field.name] = typeof value === 'object' ? JSON.stringify(value).slice(0, textLimit) : value;
                }
            }
            return out;
        });
    });
}
// ── The look-ups ────────────────────────────────────────────────────────────
function count(collection, input) {
    return __awaiter(this, void 0, void 0, function* () {
        const where = whereOf(collection, input === null || input === void 0 ? void 0 : input.filters, input === null || input === void 0 ? void 0 : input.search);
        const link = linkOf(collection, input === null || input === void 0 ? void 0 : input.filters, input === null || input === void 0 ? void 0 : input.search);
        const total = yield collection.model.count({ where });
        const step = { tool: 'count_records', label: `Counted ${collection.labelPlural}`, collection: collection.name, count: total, link };
        if (!(input === null || input === void 0 ? void 0 : input.group_by))
            return { result: Object.assign({ total }, (link ? { link } : {})), step };
        const field = fieldOf(collection, input.group_by);
        const column = columnOf(collection, field.name);
        const quoted = sequelize().getQueryInterface().quoteIdentifier(column);
        step.label = `Counted ${collection.labelPlural} by ${field.label.toLowerCase()}`;
        if (field.type === 'date' || field.type === 'datetime') {
            if (!isPostgres())
                throw new ToolError('Counting by period needs Postgres');
            const period = BUCKETS.includes(input.period) ? input.period : 'month';
            const rows = yield collection.model.findAll({
                attributes: [
                    [literal(`to_char(date_trunc('${period}', ${quoted}), 'YYYY-MM-DD')`), 'bucket'],
                    [fn('COUNT', literal('*')), 'count'],
                ],
                where: { [Op.and]: [where, { [field.name]: { [Op.not]: null } }] },
                group: [literal('1')],
                order: [[literal('1'), 'ASC']],
                raw: true,
            });
            const kept = rows.slice(-120);
            const groups = kept.map((row) => {
                var _a;
                const from = row.bucket;
                const to = period === 'day' ? from : period === 'week' ? shiftDay(from, 6) : period === 'month' ? lastOfMonth(from) : `${from.slice(0, 4)}-12-31`;
                const value = period === 'month' ? from.slice(0, 7) : period === 'year' ? from.slice(0, 4) : from;
                const groupLink = linkOf(collection, [...((_a = input.filters) !== null && _a !== void 0 ? _a : []), { field: field.name, op: 'gte', value: from }, { field: field.name, op: 'lte', value: to }], input.search);
                return Object.assign({ [period]: value, count: Number(row.count) }, (groupLink ? { link: groupLink } : {}));
            });
            return { result: Object.assign(Object.assign({ total, period, groups }, (rows.length > kept.length ? { note: `only the last ${kept.length} periods` } : {})), (link ? { link } : {})), step };
        }
        if (field.type === 'multiselect')
            throw new ToolError(`${field.name} holds several values: count with a contains filter instead`);
        const rows = yield collection.model.findAll({
            attributes: [
                [literal(quoted), 'value'],
                [fn('COUNT', literal('*')), 'count'],
            ],
            where,
            group: [literal(quoted)],
            order: [[literal('2'), 'DESC']],
            limit: MAX_GROUPS,
            raw: true,
        });
        const labels = field.type === 'relation' ? yield relationLabels(field, rows.map((r) => r.value)) : null;
        const groups = rows.map((row) => {
            var _a, _b, _c, _d;
            const value = row.value;
            const option = (_a = field.options) === null || _a === void 0 ? void 0 : _a.find((o) => String(o.value) === String(value));
            const label = value === null ? '(empty)' : ((_c = (_b = option === null || option === void 0 ? void 0 : option.label) !== null && _b !== void 0 ? _b : labels === null || labels === void 0 ? void 0 : labels.get(String(value))) !== null && _c !== void 0 ? _c : undefined);
            const groupLink = value === null ? undefined : linkOf(collection, [...((_d = input.filters) !== null && _d !== void 0 ? _d : []), { field: field.name, op: 'eq', value }], input.search);
            return Object.assign(Object.assign(Object.assign({ value }, (label !== undefined && String(label) !== String(value) ? { label } : {})), { count: Number(row.count) }), (groupLink ? { link: groupLink } : {}));
        });
        const shown = groups.reduce((sum, g) => sum + g.count, 0);
        return {
            result: Object.assign(Object.assign({ total, groups }, (shown < total ? { others: total - shown } : {})), (link ? { link } : {})),
            step,
        };
    });
}
function lastOfMonth(first) {
    const date = new Date(`${first}T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + 1, 0);
    return date.toISOString().slice(0, 10);
}
function query(collection, input) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const where = whereOf(collection, input === null || input === void 0 ? void 0 : input.filters, input === null || input === void 0 ? void 0 : input.search);
        const link = linkOf(collection, input === null || input === void 0 ? void 0 : input.filters, input === null || input === void 0 ? void 0 : input.search);
        const limit = Math.min(Math.max(Number(input === null || input === void 0 ? void 0 : input.limit) || 10, 1), MAX_ROWS);
        const asked = Array.isArray(input === null || input === void 0 ? void 0 : input.fields) && input.fields.length ? input.fields : collection.listFields;
        const pk = collection.model.primaryKeyAttribute || 'id';
        const names = [...new Set(asked.map((n) => fieldOf(collection, n).name))];
        const pkReadable = collection.fields.some((f) => f.name === pk);
        if (pkReadable && !names.includes(pk))
            names.unshift(pk);
        let order;
        if ((_a = input === null || input === void 0 ? void 0 : input.sort) === null || _a === void 0 ? void 0 : _a.field) {
            order = [[fieldOf(collection, input.sort.field).name, input.sort.direction === 'asc' ? 'ASC' : 'DESC']];
        }
        else {
            const attributes = collection.model.rawAttributes;
            order = attributes.created_at ? [['created_at', 'DESC']] : [[pk, 'DESC']];
        }
        const [total, records] = yield Promise.all([
            collection.model.count({ where }),
            collection.model.findAll({ where, attributes: [...new Set([pk, ...names])], order, limit }),
        ]);
        let rows = yield present(collection, records, names, 300);
        if (!pkReadable)
            rows = rows.map((row, i) => (Object.assign({ [pk]: records[i].get(pk) }, row)));
        // Past the budget, the last rows go: the total still says how many there are.
        while (rows.length > 1 && JSON.stringify(rows).length > MAX_RESULT)
            rows = rows.slice(0, Math.ceil(rows.length * 0.7));
        return {
            result: Object.assign({ total, returned: rows.length, rows }, (link ? { link } : {})),
            step: { tool: 'query_records', label: `Looked through ${collection.labelPlural}`, collection: collection.name, count: total, link },
        };
    });
}
/** One record, every readable field; null when it is not there. */
export function readRecord(collection_1, id_1) {
    return __awaiter(this, arguments, void 0, function* (collection, id, textLimit = 2000) {
        var _a, _b, _c, _d;
        if (id === null || id === undefined || id === '')
            return null;
        const pk = collection.model.primaryKeyAttribute || 'id';
        const pkType = String((_d = (_c = (_b = (_a = collection.model.rawAttributes) === null || _a === void 0 ? void 0 : _a[pk]) === null || _b === void 0 ? void 0 : _b.type) === null || _c === void 0 ? void 0 : _c.key) !== null && _d !== void 0 ? _d : '');
        if (/INT/.test(pkType) && !/^\d+$/.test(String(id)))
            throw new ToolError(`An id of ${collection.name} is a whole number, not "${String(id)}"`);
        const record = yield collection.model.findOne({
            where: { [pk]: id },
            attributes: [...new Set([pk, ...collection.fields.map((f) => f.name)])],
        });
        if (!record)
            return null;
        const [row] = yield present(collection, [record], collection.fields.map((f) => f.name), textLimit);
        return collection.fields.some((f) => f.name === pk) ? row : Object.assign({ [pk]: record.get(pk) }, row);
    });
}
function getRecord(collection, id) {
    return __awaiter(this, void 0, void 0, function* () {
        const record = yield readRecord(collection, id);
        if (!record)
            throw new ToolError(`No ${collection.label.toLowerCase()} #${String(id)}`);
        const link = `/${collection.name}/${encodeURIComponent(String(id))}`;
        return {
            result: { record, link },
            step: { tool: 'get_record', label: `Opened ${collection.label} #${String(id)}`, collection: collection.name, link },
        };
    });
}
