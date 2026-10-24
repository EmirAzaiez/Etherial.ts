import etherial from 'etherial';
// ──────────────────────────────────────────────────────────────────────────
// What a project tells the case leaf, and the defaults it falls back to.
// The leaf owns the conversation, the clocks (SLA), the history and the
// back-office; the project owns its tables (it extends the base models), what
// a case is about (a unit), how a customer is told and its app routes.
// ──────────────────────────────────────────────────────────────────────────
export const CASES_COLLECTION = 'cases';
export const COMMENTS_COLLECTION = 'case-comments';
export const CANNED_REPLIES_COLLECTION = 'case-canned-replies';
export const SLA_POLICIES_COLLECTION = 'case-sla-policies';
export const EVENTS_COLLECTION = 'case-events';
/** The routes the back-office's conversation panel calls. */
export const ADMIN_PREFIX = '/admin/cases';
const DEFAULT_MODELS = { Case: 'Case', CaseComment: 'CaseComment' };
const options = (values) => values.map(([value, label, color]) => (Object.assign({ value, label }, (color ? { color } : {}))));
export const DEFAULT_KINDS = options([
    ['MAINTENANCE', 'Maintenance'],
    ['COMPLAINT', 'Complaint'],
    ['GENERAL_INQUIRY', 'General inquiry'],
]);
export const DEFAULT_PRIORITIES = options([
    ['LOW', 'Low', 'gray'],
    ['MEDIUM', 'Medium', 'blue'],
    ['HIGH', 'High', 'orange'],
    ['URGENT', 'Urgent', 'red'],
]);
export const DEFAULT_CATEGORIES = options([
    ['PLUMBING', 'Plumbing'],
    ['ELECTRICAL', 'Electrical'],
    ['HVAC', 'Air conditioning'],
    ['ELEVATOR', 'Elevator'],
    ['APPLIANCE', 'Appliances'],
    ['STRUCTURAL', 'Structural'],
    ['CLEANING', 'Cleaning'],
    ['LANDSCAPING', 'Landscaping'],
    ['SECURITY', 'Security'],
    ['ACCESS', 'Access'],
    ['PARKING', 'Parking'],
    ['NOISE', 'Noise'],
    ['AMENITY', 'Amenities'],
    ['HANDOVER_SNAG', 'Handover snag'],
    ['WARRANTY', 'Warranty'],
    ['BILLING', 'Billing'],
    ['DOCUMENTS', 'Documents'],
    ['OTHER', 'Other'],
]);
/** The running leaf's config, for its controllers, hooks and services. */
export const state = { config: {} };
/** The project's models, resolved by name: they exist once the database ran. */
export function caseModels() {
    var _a, _b, _c;
    const names = Object.assign(Object.assign({}, DEFAULT_MODELS), state.config.models);
    const registered = (_c = (_b = (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize) === null || _b === void 0 ? void 0 : _b.models) !== null && _c !== void 0 ? _c : {};
    const resolved = {};
    for (const [key, name] of Object.entries(names)) {
        const model = registered[name];
        if (!model)
            throw new Error(`[ETHCaseLeaf] No model "${name}": extend Base${key} in the project and register it`);
        resolved[key] = model;
    }
    return resolved;
}
/** A model of the project the config names (the customers', the subject's), or null. */
export function projectModel(name) {
    var _a, _b, _c, _d;
    if (!name)
        return null;
    return (_d = (_c = (_b = (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize) === null || _b === void 0 ? void 0 : _b.models) === null || _c === void 0 ? void 0 : _c[name]) !== null && _d !== void 0 ? _d : null;
}
export const kindsOf = () => { var _a; return (_a = state.config.kinds) !== null && _a !== void 0 ? _a : DEFAULT_KINDS; };
export const categoriesOf = () => { var _a; return (_a = state.config.categories) !== null && _a !== void 0 ? _a : DEFAULT_CATEGORIES; };
export const prioritiesOf = () => { var _a; return (_a = state.config.priorities) !== null && _a !== void 0 ? _a : DEFAULT_PRIORITIES; };
export function customersOf() {
    var _a, _b, _c, _d;
    const customers = (_a = state.config.customers) !== null && _a !== void 0 ? _a : {};
    return { model: (_b = customers.model) !== null && _b !== void 0 ? _b : 'User', collection: (_c = customers.collection) !== null && _c !== void 0 ? _c : 'users', displayField: (_d = customers.displayField) !== null && _d !== void 0 ? _d : 'email' };
}
/** The label of `value` among `list`, or the value itself. */
export const labelIn = (list, value) => { var _a; return (value && ((_a = list.find((o) => o.value === value)) === null || _a === void 0 ? void 0 : _a.label)) || value || ''; };
export function alertOn(kind) {
    const alerts = state.config.alerts;
    if (alerts === false)
        return false;
    return (alerts === null || alerts === void 0 ? void 0 : alerts[kind]) !== false;
}
/** Why staff cannot handle this case here, or null. */
export function readOnlyReason(kase) {
    if (!kase || !state.config.readOnly)
        return null;
    try {
        return state.config.readOnly(kase) || null;
    }
    catch (_a) {
        return null;
    }
}
export function staffNameOf(user) {
    var _a, _b;
    if (state.config.staffName)
        return state.config.staffName(user);
    return String((_b = (_a = user === null || user === void 0 ? void 0 : user.first_name) !== null && _a !== void 0 ? _a : user === null || user === void 0 ? void 0 : user.firstname) !== null && _b !== void 0 ? _b : '').trim() || 'Customer care';
}
export function referenceOf(id) {
    var _a, _b;
    const reference = state.config.reference;
    if (reference === false)
        return null;
    return `${(_a = reference === null || reference === void 0 ? void 0 : reference.prefix) !== null && _a !== void 0 ? _a : 'CASE-'}${String(id).padStart((_b = reference === null || reference === void 0 ? void 0 : reference.digits) !== null && _b !== void 0 ? _b : 6, '0')}`;
}
/** Whether staff may put files on this message. */
export function attachmentsAllowed(internal) {
    var _a;
    const allowed = (_a = state.config.staffAttachments) !== null && _a !== void 0 ? _a : 'all';
    return allowed === 'all' || (allowed === 'internal' && internal);
}
export const attachmentFolders = () => { var _a; return (_a = state.config.attachmentFolders) !== null && _a !== void 0 ? _a : ['case-attachments']; };
export function wordsOf() {
    var _a, _b, _c, _d, _e;
    const words = (_b = (_a = state.config.admin) === null || _a === void 0 ? void 0 : _a.words) !== null && _b !== void 0 ? _b : {};
    const kase = (_c = words.case) !== null && _c !== void 0 ? _c : 'Case';
    return { case: kase, cases: (_d = words.cases) !== null && _d !== void 0 ? _d : `${kase}s`, customer: (_e = words.customer) !== null && _e !== void 0 ? _e : 'Customer' };
}
