// ──────────────────────────────────────────────────────────────────────────
// What a project can tell the analytics leaf, and the defaults it falls back
// to. Everything is opt-in: with no `track` and no `ingest`, the leaf only
// owns its two tables and answers the back-office.
// ──────────────────────────────────────────────────────────────────────────
export const EVENT_TYPES = ['screen', 'action', 'api', 'app'];
export const EVENTS_COLLECTION = 'analytics-events';
export const SESSIONS_COLLECTION = 'analytics-sessions';
export const INGEST_PATH = '/analytics/events';
export function ingestOptions(config) {
    var _a;
    if (!config.ingest)
        return null;
    const custom = config.ingest === true ? {} : config.ingest;
    return { maxBatch: Math.min(Math.max((_a = custom.maxBatch) !== null && _a !== void 0 ? _a : 100, 1), 500) };
}
export function trackOptions(config) {
    if (!config.track)
        return null;
    return config.track === true ? {} : config.track;
}
export function usersOptions(config) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    return {
        collection: (_b = (_a = config.users) === null || _a === void 0 ? void 0 : _a.collection) !== null && _b !== void 0 ? _b : 'users',
        model: (_d = (_c = config.users) === null || _c === void 0 ? void 0 : _c.model) !== null && _d !== void 0 ? _d : 'User',
        name: (_f = (_e = config.users) === null || _e === void 0 ? void 0 : _e.name) !== null && _f !== void 0 ? _f : ['first_name', 'last_name'],
        fallback: (_h = (_g = config.users) === null || _g === void 0 ? void 0 : _g.fallback) !== null && _h !== void 0 ? _h : ['email', 'phone_number', 'phone'],
    };
}
export function timeoutMs(config) {
    var _a;
    const minutes = (_a = config.sessionTimeoutMinutes) !== null && _a !== void 0 ? _a : 30;
    return Math.max(1, minutes) * 60 * 1000;
}
/** ios, android, web — whatever the app or a device table calls it. */
export function normalizePlatform(value) {
    if (value === undefined || value === null || value === '')
        return null;
    const v = String(value).toLowerCase().trim();
    if (v === '3' || v.startsWith('ios') || v === 'iphone' || v === 'ipad')
        return 'ios';
    if (v === '2' || v.startsWith('android'))
        return 'android';
    if (v === '1' || v === 'web')
        return 'web';
    return v.slice(0, 16);
}
export function clip(value, max) {
    if (value === undefined || value === null)
        return null;
    const s = String(value).trim();
    return s ? s.slice(0, max) : null;
}
