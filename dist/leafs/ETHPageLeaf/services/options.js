export const COLOR_TOKENS = ['primary', 'text', 'muted', 'subtle', 'white', 'black'];
/**
 * The icons a block can show: a details card's rows, a features block's
 * items, a button. One a row or an item leaves out is guessed from its words
 * (`iconFor`); the web draws Lucide's, the app its own of the same meaning.
 */
export const PAGE_ICONS = [
    'info',
    'check',
    'time',
    'calendar',
    'call',
    'mail',
    'globe',
    'location',
    'navigate',
    'price',
    'people',
    'car',
    'shirt',
    'dining',
    'cafe',
    'wifi',
    'water',
    'fitness',
    'accessible',
    'pets',
    'bike',
    'beach',
    'sun',
    'leaf',
    'snow',
    'shop',
    'ticket',
    'star',
    'boat',
    'moon',
    'tour',
    'play',
    'arrow',
    'download',
];
export const BLOCK_TYPES = [
    'heading',
    'text',
    'button',
    'image',
    'hero',
    'gallery',
    'video',
    'cards',
    'media-text',
    'faq',
    'contact',
    'event',
    'quote',
    'stats',
    'note',
    'details',
    'map',
    'features',
    'divider',
    'spacer',
];
export const HEAD_COVERS = ['none', 'sm', 'md', 'lg'];
export const HEAD_SIZES = ['sm', 'md', 'lg', 'xl'];
export const HEAD_WEIGHTS = ['light', 'regular', 'medium', 'bold'];
/** How a page opens when nothing says otherwise: the look pages had before it could be set. */
export const DEFAULT_HEAD = { cover: 'md', align: 'start', size: 'md', weight: 'bold', upper: false, color: 'text', sheet: false, logo: false };
/** Not `pages`: the back-office's own pages are at `/pages/<page>`. */
export const COLLECTION = 'content-pages';
export const BLOCKS_TYPE = 'page-blocks';
/** The `html` column on the back-office: the links of each language, to open or copy. */
export const LINKS_TYPE = 'page-links';
/**
 * A field of another collection whose content is a page (a news' text): its
 * blocks are written in that record's form, like a file in a media field, and
 * the page is saved and deleted with the record. The column keeps its id.
 */
export const PAGE_TYPE = 'page';
const DEFAULT_RTL = ['ar', 'he', 'fa', 'ur'];
/** The agent's name wherever a person reads it: the errors of Write with AI. */
export const AGENT_NAME = 'DLS Assistant';
export class PageError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}
export function defaultLocaleOf(config) {
    var _a, _b, _c;
    return (_c = (_a = config.defaultLocale) !== null && _a !== void 0 ? _a : (_b = config.locales) === null || _b === void 0 ? void 0 : _b[0]) !== null && _c !== void 0 ? _c : 'en';
}
/** The languages a page is written in, the default one first. */
export function localesOf(config) {
    var _a;
    const fallback = defaultLocaleOf(config);
    return [fallback, ...((_a = config.locales) !== null && _a !== void 0 ? _a : []).filter((l) => l !== fallback)];
}
export function rtlOf(config, locale) {
    var _a;
    return ((_a = config.rtlLocales) !== null && _a !== void 0 ? _a : DEFAULT_RTL).includes(locale);
}
export function folderOf(config) {
    var _a;
    return ((_a = config.folder) !== null && _a !== void 0 ? _a : 'pages').replace(/^\/+|\/+$/g, '');
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
/** `ar-AE,ar;q=0.9` → `ar`. */
export function languageOf(value) {
    if (typeof value !== 'string')
        return null;
    const lang = value.split(',')[0].trim().split(/[-_;]/)[0].toLowerCase();
    return /^[a-z]{2,3}$/.test(lang) ? lang : null;
}
const NAMES = { en: 'English', ar: 'Arabic', fr: 'French', es: 'Spanish', de: 'German', it: 'Italian', ru: 'Russian', zh: 'Chinese' };
export function languageName(locale) {
    var _a;
    return (_a = NAMES[locale]) !== null && _a !== void 0 ? _a : locale.toUpperCase();
}
