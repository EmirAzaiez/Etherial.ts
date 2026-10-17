// ──────────────────────────────────────────────────────────────────────────
// What a project can tell the survey leaf, and the defaults it falls back to.
// Nothing is asked of anyone until the project lists a survey and something
// invites people to it: a trigger, or its own code calling `invite()`.
// ──────────────────────────────────────────────────────────────────────────
export const RESPONSES_COLLECTION = 'survey-responses';
export const APP_PREFIX = '/surveys';
export const STATUSES = ['pending', 'answered', 'dismissed', 'expired'];
export function kindOf(survey) {
    return survey.kind === 'csat' ? 'csat' : 'nps';
}
export function scaleOf(kind) {
    return kind === 'csat' ? { min: 1, max: 5 } : { min: 0, max: 10 };
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
/** The text in `locale`, else in the default language, else the first one written. */
export function localize(text, locale, fallback) {
    var _a, _b, _c;
    if (text === undefined || text === null)
        return null;
    if (typeof text === 'string')
        return text;
    return (_c = (_b = (_a = text[locale]) !== null && _a !== void 0 ? _a : text[fallback]) !== null && _b !== void 0 ? _b : Object.values(text)[0]) !== null && _c !== void 0 ? _c : null;
}
/** `ar-SA`, `AR`, `ar_SA` → `ar`. */
export function languageOf(value) {
    if (typeof value !== 'string')
        return null;
    const lang = value.split(',')[0].trim().split(/[-_;]/)[0].toLowerCase();
    return /^[a-z]{2,3}$/.test(lang) ? lang : null;
}
