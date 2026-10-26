// ──────────────────────────────────────────────────────────────────────────
// What a project tells the content leaf: its languages, the contents it
// offers, the media folder of its images, and what a new server starts with.
// The contents themselves are written in the back-office, in each language.
// ──────────────────────────────────────────────────────────────────────────
export const FEATURES = ['languages', 'faq', 'contacts', 'legal', 'banners', 'stories', 'versions'];
/** Who sees a banner or a story. */
export const AUDIENCES = ['everyone', 'signed_in', 'guests'];
export const CONTACT_KINDS = ['phone', 'whatsapp', 'email', 'website', 'instagram', 'facebook', 'x', 'linkedin', 'youtube', 'tiktok', 'snapchat'];
export const PLATFORMS = ['ios', 'android'];
export const PLATFORM_NAMES = { ios: 'iOS', android: 'Android' };
/**
 * What an app older than a version does:
 * - `auto`: a banner asks to update when the version is a new major one
 *   (2.0 after 1.x), nothing for a minor one (1.5 after 1.4);
 * - `banner`: a banner asks to update, whatever the version;
 * - `required`: the app is blocked until it is updated.
 */
export const PROMPTS = ['auto', 'banner', 'required'];
/** The back-office's collections: what goes in a project's `navigation` and in the roles' rights. */
export const COLLECTIONS = {
    languages: 'content-languages',
    faq: 'content-faq',
    faqQuestions: 'content-faq-questions',
    contacts: 'content-contacts',
    offices: 'content-offices',
    legal: 'content-legal',
    banners: 'content-banners',
    stories: 'content-stories',
    storySlides: 'content-story-slides',
    versions: 'content-app-versions',
};
/** The longest `label`: a back-office title, not the text itself. */
const LABEL_LENGTH = 200;
const DEFAULT_RTL = ['ar', 'he', 'fa', 'ur'];
export class ContentError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}
export function defaultLocaleOf(config) {
    var _a, _b, _c;
    return (_c = (_a = config.defaultLocale) !== null && _a !== void 0 ? _a : (_b = config.locales) === null || _b === void 0 ? void 0 : _b[0]) !== null && _c !== void 0 ? _c : 'en';
}
/** The languages the contents are written in, the default one first. */
export function localesOf(config) {
    var _a;
    const fallback = defaultLocaleOf(config);
    return [fallback, ...((_a = config.locales) !== null && _a !== void 0 ? _a : []).filter((l) => l !== fallback)];
}
export function rtlOf(config, locale) {
    var _a;
    return ((_a = config.rtlLocales) !== null && _a !== void 0 ? _a : DEFAULT_RTL).includes(locale);
}
/** The config's languages, every one in the app. */
export function languagesOf(config) {
    const all = localesOf(config);
    return {
        all,
        app: all,
        default: all[0],
        rtl: all.filter((l) => rtlOf(config, l)),
        names: Object.fromEntries(all.map((l) => [l, nativeName(l)])),
    };
}
export function featuresOf(config) {
    var _a;
    return (_a = config.features) !== null && _a !== void 0 ? _a : FEATURES;
}
export function folderOf(config) {
    var _a;
    return ((_a = config.folder) !== null && _a !== void 0 ? _a : 'content').replace(/^\/+|\/+$/g, '');
}
/** The text in `locale`, else in the default language, else the first one written. */
export function localize(text, locale, fallback) {
    if (text === undefined || text === null)
        return '';
    if (typeof text === 'string')
        return text.trim();
    const pick = (l) => (typeof text[l] === 'string' && text[l].trim() ? text[l].trim() : '');
    return pick(locale) || pick(fallback) || Object.keys(text).map(pick).find((t) => t) || '';
}
/** A seed's text as a column holds it: `{ <default locale>: text }` for one text. */
export function localizedOf(text, fallback) {
    if (text === undefined || text === null)
        return {};
    if (typeof text === 'string')
        return { [fallback]: text };
    return Object.assign({}, text);
}
/**
 * What the back-office shows of a text in its lists and on a card: the
 * default language's, on one line. Its translations are JSON, which the
 * back-office can neither search nor print as a title.
 */
export function labelOf(text, fallback) {
    return localize(text, fallback, fallback).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, LABEL_LENGTH);
}
/** `2.10.1` → `[2, 10, 1]`; null for anything but numbers between dots. */
export function parseVersion(value) {
    if (typeof value !== 'string' || !/^\d{1,6}(\.\d{1,6}){0,3}$/.test(value.trim()))
        return null;
    return value.trim().split('.').map(Number);
}
/** `1.10.0` > `1.9.2`: a missing part counts as 0. Versions that aren't one compare as 0. */
export function compareVersions(a, b) {
    var _a, _b, _c, _d;
    const [pa, pb] = [(_a = parseVersion(a)) !== null && _a !== void 0 ? _a : [0], (_b = parseVersion(b)) !== null && _b !== void 0 ? _b : [0]];
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = ((_c = pa[i]) !== null && _c !== void 0 ? _c : 0) - ((_d = pb[i]) !== null && _d !== void 0 ? _d : 0);
        if (diff)
            return Math.sign(diff);
    }
    return 0;
}
/** `fr`, `zh`: the codes a language goes by (`languageOf`). */
export function isLocale(value) {
    return typeof value === 'string' && /^[a-z]{2,3}$/.test(value);
}
/** `ar-AE,ar;q=0.9` → `ar`. */
export function languageOf(value) {
    if (typeof value !== 'string')
        return null;
    const lang = value.split(',')[0].trim().split(/[-_;]/)[0].toLowerCase();
    return isLocale(lang) ? lang : null;
}
/** `Privacy Policy` → `privacy-policy`. */
export function slugify(text) {
    return text
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}
/** The languages the back-office offers to add: each one's name in English, and in itself. */
export const LANGUAGES = {
    en: { name: 'English', native: 'English' },
    ar: { name: 'Arabic', native: 'العربية' },
    fr: { name: 'French', native: 'Français' },
    es: { name: 'Spanish', native: 'Español' },
    de: { name: 'German', native: 'Deutsch' },
    it: { name: 'Italian', native: 'Italiano' },
    pt: { name: 'Portuguese', native: 'Português' },
    nl: { name: 'Dutch', native: 'Nederlands' },
    sv: { name: 'Swedish', native: 'Svenska' },
    pl: { name: 'Polish', native: 'Polski' },
    ro: { name: 'Romanian', native: 'Română' },
    el: { name: 'Greek', native: 'Ελληνικά' },
    tr: { name: 'Turkish', native: 'Türkçe' },
    ru: { name: 'Russian', native: 'Русский' },
    uk: { name: 'Ukrainian', native: 'Українська' },
    he: { name: 'Hebrew', native: 'עברית' },
    fa: { name: 'Persian', native: 'فارسی' },
    ur: { name: 'Urdu', native: 'اردو' },
    hi: { name: 'Hindi', native: 'हिन्दी' },
    bn: { name: 'Bengali', native: 'বাংলা' },
    ta: { name: 'Tamil', native: 'தமிழ்' },
    ml: { name: 'Malayalam', native: 'മലയാളം' },
    tl: { name: 'Filipino', native: 'Filipino' },
    id: { name: 'Indonesian', native: 'Bahasa Indonesia' },
    ms: { name: 'Malay', native: 'Bahasa Melayu' },
    th: { name: 'Thai', native: 'ไทย' },
    vi: { name: 'Vietnamese', native: 'Tiếng Việt' },
    zh: { name: 'Chinese', native: '中文' },
    ja: { name: 'Japanese', native: '日本語' },
    ko: { name: 'Korean', native: '한국어' },
};
/** In English, for the back-office's messages. */
export function languageName(locale) {
    var _a, _b;
    return (_b = (_a = LANGUAGES[locale]) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : locale.toUpperCase();
}
/** In itself, on the back-office's language switch and the app's picker. */
export function nativeName(locale) {
    var _a, _b;
    return (_b = (_a = LANGUAGES[locale]) === null || _a === void 0 ? void 0 : _a.native) !== null && _b !== void 0 ? _b : locale.toUpperCase();
}
