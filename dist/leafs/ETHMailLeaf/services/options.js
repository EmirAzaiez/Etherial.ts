// ──────────────────────────────────────────────────────────────────────────
// What a project tells the mail leaf: its brand, its languages, and the emails
// its code sends. Each email is written here, in code, with its text in every
// language; the back-office can then rewrite it, one language at a time, and
// go back to this version whenever it wants.
// ──────────────────────────────────────────────────────────────────────────
export const BLOCK_TYPES = ['heading', 'text', 'button', 'code', 'image', 'note', 'details', 'divider', 'spacer'];
export const TEMPLATES_COLLECTION = 'mail-templates';
export const CAMPAIGNS_COLLECTION = 'mail-campaigns';
export const DEFAULT_RTL = ['ar', 'fa', 'he', 'ur'];
/** An error the back-office routes turn into `{ status, errors: [code] }`. */
export class MailError extends Error {
    constructor(code, status = 400, message) {
        super(message || code);
        this.code = code;
        this.status = status;
    }
}
export function localesOf(config) {
    var _a, _b;
    const locales = ((_a = config.locales) === null || _a === void 0 ? void 0 : _a.length) ? config.locales : [config.defaultLocale || 'en'];
    const defaultLocale = config.defaultLocale && locales.includes(config.defaultLocale) ? config.defaultLocale : locales[0];
    return { locales, defaultLocale, rtlLocales: (_b = config.rtlLocales) !== null && _b !== void 0 ? _b : DEFAULT_RTL };
}
/** The text in `locale`, else in the default language, else the first one written. */
export function localize(text, locale, fallback) {
    var _a, _b, _c;
    if (text === undefined || text === null)
        return '';
    if (typeof text === 'string')
        return text;
    return (_c = (_b = (_a = text[locale]) !== null && _a !== void 0 ? _a : text[fallback]) !== null && _b !== void 0 ? _b : Object.values(text)[0]) !== null && _c !== void 0 ? _c : '';
}
/** `ar-SA`, `AR`, `ar_SA` → `ar`. */
export function languageOf(value) {
    if (typeof value !== 'string')
        return null;
    const lang = value.split(',')[0].trim().split(/[-_;]/)[0].toLowerCase();
    return /^[a-z]{2,3}$/.test(lang) ? lang : null;
}
/** One of the configured languages, else the default one. */
export function pickLocale(config, ...candidates) {
    const { locales, defaultLocale } = localesOf(config);
    for (const candidate of candidates) {
        const lang = languageOf(candidate);
        if (lang && locales.includes(lang))
            return lang;
    }
    return defaultLocale;
}
export function isRtl(config, locale) {
    return localesOf(config).rtlLocales.includes(locale);
}
export function variablesOf(definition) {
    var _a;
    return Object.entries((_a = definition.variables) !== null && _a !== void 0 ? _a : {}).map(([name, value]) => {
        var _a;
        if (value !== null && typeof value === 'object')
            return { name, label: (_a = value.label) !== null && _a !== void 0 ? _a : name, example: value.example === undefined ? '' : String(value.example) };
        return { name, label: name, example: String(value) };
    });
}
export function examplesOf(definition) {
    return Object.fromEntries(variablesOf(definition).map((v) => [v.name, v.example]));
}
