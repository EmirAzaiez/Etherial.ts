// ──────────────────────────────────────────────────────────────────────────
// What a project can tell the survey leaf, and the defaults it falls back to.
// The surveys themselves are written in the back-office (table survey_forms):
// the project only declares the events they can be asked after — an
// appointment done, a ticket closed — and what each one can be narrowed to.
// ──────────────────────────────────────────────────────────────────────────
export const QUESTION_TYPES = ['nps', 'csat', 'choice', 'multiple', 'text'];
export const RESPONSES_COLLECTION = 'survey-responses';
/** Not `surveys`: that is the back-office's own page, where they are read. */
export const FORMS_COLLECTION = 'survey-forms';
export const APP_PREFIX = '/surveys';
export const STATUSES = ['pending', 'answered', 'dismissed', 'expired'];
/** At most this many questions in a survey, and options in a question: it is read on a phone. */
export const MAX_QUESTIONS = 10;
export const MAX_OPTIONS = 12;
export function isRating(type) {
    return type === 'nps' || type === 'csat';
}
/** The kind of a survey: the one of its first question, the rating that scores it. */
export function kindOf(questions) {
    const first = Array.isArray(questions) ? questions[0] : null;
    return (first === null || first === void 0 ? void 0 : first.type) === 'csat' ? 'csat' : 'nps';
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
export function defaultLocaleOf(config) {
    var _a, _b, _c;
    return (_c = (_a = config.defaultLocale) !== null && _a !== void 0 ? _a : (_b = config.locales) === null || _b === void 0 ? void 0 : _b[0]) !== null && _c !== void 0 ? _c : 'en';
}
/** The languages a question is written in, the default one first. */
export function localesOf(config) {
    var _a;
    const fallback = defaultLocaleOf(config);
    return [fallback, ...((_a = config.locales) !== null && _a !== void 0 ? _a : []).filter((l) => l !== fallback)];
}
/** The text in `locale`, else in the default language, else the first one written. */
export function localize(text, locale, fallback) {
    var _a, _b, _c;
    if (text === undefined || text === null)
        return null;
    if (typeof text === 'string')
        return text.trim() || null;
    const pick = (l) => (typeof text[l] === 'string' && text[l].trim() ? text[l].trim() : null);
    return (_c = (_b = (_a = pick(locale)) !== null && _a !== void 0 ? _a : pick(fallback)) !== null && _b !== void 0 ? _b : Object.keys(text).map(pick).find((t) => t)) !== null && _c !== void 0 ? _c : null;
}
/** `ar-SA`, `AR`, `ar_SA` → `ar`. */
export function languageOf(value) {
    if (typeof value !== 'string')
        return null;
    const lang = value.split(',')[0].trim().split(/[-_;]/)[0].toLowerCase();
    return /^[a-z]{2,3}$/.test(lang) ? lang : null;
}
