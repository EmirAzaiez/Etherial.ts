// ──────────────────────────────────────────────────────────────────────────
// Conditions, in two places at once.
//
// The same little `{ field, operator, value }` rows are used to narrow a
// database query ("appointments whose status is confirmed") and to test a value
// already in hand ("if the customer has an email"). Sharing the operator list
// between the two means the builder shows one vocabulary, and "contains" means
// the same thing whether it is compiled to SQL or evaluated in memory.
// ──────────────────────────────────────────────────────────────────────────
import { Op } from 'sequelize';
import { getCollection, humanize } from '../registry/admin.js';
export const OPERATOR_OPTIONS = [
    { value: 'eq', label: 'is' },
    { value: 'ne', label: 'is not' },
    { value: 'gt', label: 'is greater than' },
    { value: 'gte', label: 'is greater than or equal to' },
    { value: 'lt', label: 'is less than' },
    { value: 'lte', label: 'is less than or equal to' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'ends_with', label: 'ends with' },
    { value: 'in', label: 'is one of' },
    { value: 'not_in', label: 'is not one of' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
    { value: 'is_true', label: 'is true' },
    { value: 'is_false', label: 'is false' },
];
/** Operators that ignore whatever is in the value box. */
export const UNARY_OPERATORS = ['is_empty', 'is_not_empty', 'is_true', 'is_false'];
/** The columns a collection can be filtered on, for the condition widget. */
export function filterableFields(collectionName) {
    var _a;
    const collection = getCollection(collectionName);
    if (!collection)
        return [];
    const options = [
        { value: 'id', label: 'ID' },
        ...((_a = collection.fields) !== null && _a !== void 0 ? _a : [])
            .filter((field) => field.type !== 'hasMany' && field.type !== 'belongsToMany')
            .map((field) => ({
            value: field.name,
            label: field.label || humanize(field.name),
        })),
        { value: 'created_at', label: 'Created at' },
        { value: 'updated_at', label: 'Updated at' },
    ];
    // `id` and the timestamps are offered whether or not the collection lists
    // them; one that does would otherwise show two entries with the same
    // meaning and no way to tell them apart.
    const seen = new Set();
    return options.filter((option) => {
        if (seen.has(option.value))
            return false;
        seen.add(option.value);
        return true;
    });
}
function asList(value) {
    if (Array.isArray(value))
        return value;
    if (value === null || value === undefined || value === '')
        return [];
    return String(value)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
}
/** One row, as a Sequelize condition. Null when the row is incomplete. */
function toSequelize(row) {
    if (!(row === null || row === void 0 ? void 0 : row.field))
        return null;
    const value = row.value;
    switch (row.operator) {
        case 'eq':
            return { [row.field]: value };
        case 'ne':
            return { [row.field]: { [Op.ne]: value } };
        case 'gt':
            return { [row.field]: { [Op.gt]: value } };
        case 'gte':
            return { [row.field]: { [Op.gte]: value } };
        case 'lt':
            return { [row.field]: { [Op.lt]: value } };
        case 'lte':
            return { [row.field]: { [Op.lte]: value } };
        case 'contains':
            return { [row.field]: { [Op.like]: `%${value !== null && value !== void 0 ? value : ''}%` } };
        case 'not_contains':
            return { [row.field]: { [Op.notLike]: `%${value !== null && value !== void 0 ? value : ''}%` } };
        case 'starts_with':
            return { [row.field]: { [Op.like]: `${value !== null && value !== void 0 ? value : ''}%` } };
        case 'ends_with':
            return { [row.field]: { [Op.like]: `%${value !== null && value !== void 0 ? value : ''}` } };
        case 'in':
            return { [row.field]: { [Op.in]: asList(value) } };
        case 'not_in':
            return { [row.field]: { [Op.notIn]: asList(value) } };
        case 'is_empty':
            // An empty string and a NULL are the same thing to the person who
            // wrote "has no phone number".
            return { [row.field]: { [Op.or]: [{ [Op.is]: null }, { [Op.eq]: '' }] } };
        case 'is_not_empty':
            return { [row.field]: { [Op.and]: [{ [Op.not]: null }, { [Op.ne]: '' }] } };
        case 'is_true':
            return { [row.field]: true };
        case 'is_false':
            return { [row.field]: false };
        default:
            return null;
    }
}
export function toWhere(rows, match = 'all') {
    const conditions = (rows !== null && rows !== void 0 ? rows : []).map(toSequelize).filter(Boolean);
    if (conditions.length === 0)
        return {};
    if (match === 'any')
        return { [Op.or]: conditions };
    return { [Op.and]: conditions };
}
// ─── In-memory evaluation ─────────────────────────────────────────────────
function compare(left, row) {
    const right = row.value;
    switch (row.operator) {
        case 'eq':
            return looseEqual(left, right);
        case 'ne':
            return !looseEqual(left, right);
        case 'gt':
            return numeric(left) > numeric(right);
        case 'gte':
            return numeric(left) >= numeric(right);
        case 'lt':
            return numeric(left) < numeric(right);
        case 'lte':
            return numeric(left) <= numeric(right);
        case 'contains':
            return String(left !== null && left !== void 0 ? left : '').toLowerCase().includes(String(right !== null && right !== void 0 ? right : '').toLowerCase());
        case 'not_contains':
            return !String(left !== null && left !== void 0 ? left : '').toLowerCase().includes(String(right !== null && right !== void 0 ? right : '').toLowerCase());
        case 'starts_with':
            return String(left !== null && left !== void 0 ? left : '').toLowerCase().startsWith(String(right !== null && right !== void 0 ? right : '').toLowerCase());
        case 'ends_with':
            return String(left !== null && left !== void 0 ? left : '').toLowerCase().endsWith(String(right !== null && right !== void 0 ? right : '').toLowerCase());
        case 'in':
            return asList(right).some((entry) => looseEqual(left, entry));
        case 'not_in':
            return !asList(right).some((entry) => looseEqual(left, entry));
        case 'is_empty':
            return isEmpty(left);
        case 'is_not_empty':
            return !isEmpty(left);
        case 'is_true':
            return isTruthy(left);
        case 'is_false':
            return !isTruthy(left);
        default:
            return false;
    }
}
/**
 * Equality that forgives the trip through JSON and HTML forms.
 *
 * A select stores `"1"`, the column holds `1`, and a customer comparing the two
 * is right to expect them to match. Dates are compared as instants, not as the
 * strings they happen to have been serialized to.
 */
export function looseEqual(left, right) {
    if (left === right)
        return true;
    if (left === null || left === undefined)
        return right === null || right === undefined || right === '';
    if (right === null || right === undefined)
        return left === '';
    if (typeof left === 'boolean' || typeof right === 'boolean') {
        return isTruthy(left) === isTruthy(right);
    }
    const leftDate = asDate(left);
    const rightDate = asDate(right);
    if (leftDate && rightDate)
        return leftDate.getTime() === rightDate.getTime();
    return String(left) === String(right);
}
function asDate(value) {
    if (value instanceof Date)
        return value;
    if (typeof value !== 'string')
        return null;
    if (!/^\d{4}-\d{2}-\d{2}/.test(value))
        return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}
function numeric(value) {
    if (value instanceof Date)
        return value.getTime();
    const date = asDate(value);
    if (date)
        return date.getTime();
    const number = Number(value);
    return Number.isFinite(number) ? number : NaN;
}
export function isEmpty(value) {
    if (value === null || value === undefined)
        return true;
    if (typeof value === 'string')
        return value.trim() === '';
    if (Array.isArray(value))
        return value.length === 0;
    if (typeof value === 'object')
        return Object.keys(value).length === 0;
    return false;
}
export function isTruthy(value) {
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        // "false" and "0" arrive as strings from every form on earth, and a
        // non-empty string being truthy would make them both mean yes.
        if (['false', '0', 'no', 'off', ''].includes(normalized))
            return false;
        return true;
    }
    return !!value;
}
export function evaluate(rows, read, match = 'all') {
    const list = (rows !== null && rows !== void 0 ? rows : []).filter((row) => (row === null || row === void 0 ? void 0 : row.field) && (row === null || row === void 0 ? void 0 : row.operator));
    // No conditions means no obstacle: an if with an empty list takes the true
    // branch, which is what an unfinished flow being tested should do.
    if (list.length === 0)
        return true;
    return match === 'any'
        ? list.some((row) => compare(read(row.field), row))
        : list.every((row) => compare(read(row.field), row));
}
export function evaluateExpressions(rows, match = 'all') {
    const list = (rows !== null && rows !== void 0 ? rows : []).filter((row) => row && row.operator);
    if (list.length === 0)
        return true;
    const test = (row) => compare(row.left, { field: '', operator: row.operator, value: row.right });
    return match === 'any' ? list.some(test) : list.every(test);
}
