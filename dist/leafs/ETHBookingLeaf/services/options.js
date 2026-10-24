import etherial from 'etherial';
import { DEFAULT_WEEKEND } from './slots.js';
// ──────────────────────────────────────────────────────────────────────────
// What a project tells the booking leaf, and the defaults it falls back to.
// The leaf owns the engine, the rules and the back-office; the project owns
// its tables (it extends the leaf's base models), what a scheduler belongs to
// (a project), what an appointment is about (a unit) and how a customer is told.
// ──────────────────────────────────────────────────────────────────────────
export const SCHEDULERS_COLLECTION = 'schedulers';
export const WINDOWS_COLLECTION = 'scheduler-windows';
export const BLOCKS_COLLECTION = 'scheduler-blocks';
export const AGENTS_COLLECTION = 'agents';
export const APPOINTMENTS_COLLECTION = 'booking-appointments';
export const CALENDAR_PAGE = 'appointments-calendar';
/**
 * The field the shared back-office's slot picker reads the subject from (the
 * property at RETAL, where it was written). A project whose subject column has
 * another name adds a VIRTUAL `property_id` alias on its appointment model.
 */
export const BO_SUBJECT_FIELD = 'property_id';
const DEFAULT_MODELS = {
    Scheduler: 'Scheduler',
    SchedulerWindow: 'SchedulerWindow',
    SchedulerWindowHost: 'SchedulerWindowHost',
    SchedulerBlock: 'SchedulerBlock',
    Agent: 'Agent',
    BookingAppointment: 'BookingAppointment',
};
/** The running leaf's config, for its controllers, hooks and services. */
export const state = { config: {} };
export const timezoneOf = (scheduler) => (scheduler === null || scheduler === void 0 ? void 0 : scheduler.timezone) || state.config.timezone || 'UTC';
export const weekendOf = (scheduler) => { var _a, _b; return (_b = (_a = scheduler === null || scheduler === void 0 ? void 0 : scheduler.weekend_days) !== null && _a !== void 0 ? _a : state.config.weekend) !== null && _b !== void 0 ? _b : DEFAULT_WEEKEND; };
/** The project's models, resolved by name: they exist once the database ran. */
export function bookingModels() {
    var _a, _b, _c;
    const names = Object.assign(Object.assign({}, DEFAULT_MODELS), state.config.models);
    const registered = (_c = (_b = (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize) === null || _b === void 0 ? void 0 : _b.models) !== null && _c !== void 0 ? _c : {};
    const resolved = {};
    for (const [key, name] of Object.entries(names)) {
        const model = registered[name];
        if (!model)
            throw new Error(`[ETHBookingLeaf] No model "${name}": extend Base${key} in the project and register it`);
        resolved[key] = model;
    }
    return resolved;
}
/** A model of the project the config names (the scope's, the subject's), or null. */
export function projectModel(name) {
    var _a, _b, _c, _d;
    if (!name)
        return null;
    return (_d = (_c = (_b = (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize) === null || _b === void 0 ? void 0 : _b.models) === null || _c === void 0 ? void 0 : _c[name]) !== null && _d !== void 0 ? _d : null;
}
const lower = (label, fallback) => (label || fallback).toLowerCase();
/** "unit", "project": the words of the staff messages. */
export const subjectWord = () => { var _a; return lower((_a = state.config.subject) === null || _a === void 0 ? void 0 : _a.label, 'subject'); };
export const scopeWord = () => { var _a; return lower((_a = state.config.scope) === null || _a === void 0 ? void 0 : _a.label, 'project'); };
/** The name an association from `model` to `target` goes by ('unit', 'user'), or null. */
export function associationTo(model, target) {
    var _a;
    if (!model || !target)
        return null;
    for (const [as, association] of Object.entries((_a = model.associations) !== null && _a !== void 0 ? _a : {})) {
        if (association.target === target)
            return as;
    }
    return null;
}
/** The attributes of `model` among `names`: an include asks only for columns that exist. */
export function attributesOf(model, names) {
    var _a;
    const known = (_a = model === null || model === void 0 ? void 0 : model.rawAttributes) !== null && _a !== void 0 ? _a : {};
    return names.filter((name) => name in known);
}
