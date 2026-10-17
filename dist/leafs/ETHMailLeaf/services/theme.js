var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { MailSetting } from '../models/MailSetting.js';
import { COLORS, FONT, FONT_RTL } from './render.js';
import { state } from './state.js';
import { MailError, localesOf } from './options.js';
export const COLOR_KEYS = Object.keys(COLORS);
const THEME_KEY = 'theme';
const CACHE_MS = 30000;
const ALIGNS = ['start', 'center', 'end'];
const MAX_LINKS = 6;
let cache = null;
function invalid(message) {
    throw new MailError('invalid_theme', 400, message);
}
function text(value, field, max) {
    if (value === undefined || value === null)
        return '';
    if (typeof value !== 'string')
        invalid(`${field} must be text`);
    const trimmed = value.replace(/\r\n?/g, '\n').trim();
    if (trimmed.length > max)
        invalid(`${field} is longer than ${max} characters`);
    return trimmed;
}
function localized(value, field, max) {
    const { locales } = localesOf(state.config);
    if (value === undefined || value === null || value === '')
        return Object.fromEntries(locales.map((l) => [l, '']));
    if (typeof value === 'string')
        return Object.fromEntries(locales.map((l) => [l, text(value, field, max)]));
    if (typeof value !== 'object' || Array.isArray(value))
        invalid(`${field} must be a text per language`);
    return Object.fromEntries(locales.map((l) => [l, text(value[l], `${field} (${l})`, max)]));
}
function url(value, field, required) {
    const href = text(value, field, 1000);
    if (!href) {
        if (required)
            invalid(`${field} is required`);
        return '';
    }
    if (!/^(https?:\/\/|mailto:|tel:)\S+$/i.test(href))
        invalid(`${field} must start with https://, http://, mailto: or tel:`);
    return href;
}
function color(value, key) {
    if (value === undefined || value === null || value === '')
        return COLORS[key];
    if (typeof value !== 'string' || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()))
        invalid(`The ${key} color must be a hex color, like #85553A`);
    return value.trim().toUpperCase();
}
function font(value, field, fallback) {
    const stack = text(value, field, 300);
    if (!stack)
        return fallback;
    if (/[;"<>{}]/.test(stack))
        invalid(`${field} can't contain ; " < > { }`);
    return stack;
}
function int(value, field, min, max, fallback) {
    if (value === undefined || value === null || value === '')
        return fallback;
    const n = Number(value);
    if (!Number.isFinite(n))
        invalid(`${field} must be a number`);
    return Math.max(min, Math.min(max, Math.round(n)));
}
/** A theme from the config or the back-office, checked, with every field set. */
export function normalizeTheme(input) {
    var _a;
    const theme = (input && typeof input === 'object' && !Array.isArray(input) ? input : {});
    const colors = theme.colors && typeof theme.colors === 'object' ? theme.colors : {};
    const links = theme.links === undefined || theme.links === null ? [] : theme.links;
    if (!Array.isArray(links))
        invalid('links must be a list');
    if (links.length > MAX_LINKS)
        invalid(`${MAX_LINKS} links at most`);
    const align = (_a = theme.logoAlign) !== null && _a !== void 0 ? _a : 'center';
    if (!ALIGNS.includes(align))
        invalid('logoAlign must be start, center or end');
    return {
        brandName: localized(theme.brandName, 'The brand name', 80),
        logoUrl: url(theme.logoUrl, 'The logo', false),
        logoWidth: int(theme.logoWidth, 'The logo width', 24, 300, 120),
        logoAlign: align,
        colors: Object.fromEntries(COLOR_KEYS.map((key) => [key, color(colors[key], key)])),
        font: font(theme.font, 'The font', FONT),
        fontRtl: font(theme.fontRtl, 'The right-to-left font', FONT_RTL),
        radius: int(theme.radius, 'The corner radius', 0, 24, 8),
        footer: localized(theme.footer, 'The footer', 1000),
        links: links.map((link, i) => ({
            label: localized(link === null || link === void 0 ? void 0 : link.label, `Link ${i + 1}'s label`, 60),
            url: url(link === null || link === void 0 ? void 0 : link.url, `Link ${i + 1}'s address`, true),
        })),
    };
}
/** The config's theme, as the back-office edits it. A config the checks refuse still renders: it is the developer's. */
function codeTheme() {
    var _a;
    try {
        return normalizeTheme((_a = state.config.theme) !== null && _a !== void 0 ? _a : {});
    }
    catch (err) {
        console.error("[ETHMailLeaf] The config's theme is invalid:", (err === null || err === void 0 ? void 0 : err.message) || err);
        return normalizeTheme({});
    }
}
function customRow() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return yield MailSetting.findOne({ where: { key: THEME_KEY } });
        }
        catch (err) {
            console.error('[ETHMailLeaf] Could not read the back-office theme:', (err === null || err === void 0 ? void 0 : err.message) || err);
            return null;
        }
    });
}
function storedTheme(row) {
    var _a;
    if (!(row === null || row === void 0 ? void 0 : row.value))
        return null;
    try {
        // The code's colors under the stored ones: a color the code adds later is not lost.
        return normalizeTheme(Object.assign(Object.assign({}, row.value), { colors: Object.assign(Object.assign({}, (_a = state.config.theme) === null || _a === void 0 ? void 0 : _a.colors), row.value.colors) }));
    }
    catch (err) {
        console.error("[ETHMailLeaf] The back-office theme is invalid, using the code's:", (err === null || err === void 0 ? void 0 : err.message) || err);
        return null;
    }
}
/** The theme emails go out with: the back-office's when it has one, else the config's. Cached 30 s. */
export function activeTheme() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (!cache || Date.now() - cache.at > CACHE_MS)
            cache = { custom: storedTheme(yield customRow()), at: Date.now() };
        return (_b = (_a = cache.custom) !== null && _a !== void 0 ? _a : state.config.theme) !== null && _b !== void 0 ? _b : {};
    });
}
export function readTheme() {
    return __awaiter(this, void 0, void 0, function* () {
        const row = yield customRow();
        const custom = storedTheme(row);
        const { locales, defaultLocale, rtlLocales } = localesOf(state.config);
        return {
            locales,
            defaultLocale,
            rtlLocales: rtlLocales.filter((l) => locales.includes(l)),
            default: codeTheme(),
            custom: custom && row ? Object.assign(Object.assign({}, custom), { updatedAt: row.updated_at, updatedBy: row.updated_by }) : null,
            defaults: { colors: COLORS, font: FONT, fontRtl: FONT_RTL, logoWidth: 120, radius: 8 },
        };
    });
}
export function saveTheme(input, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const theme = normalizeTheme(input);
        const row = yield MailSetting.findOne({ where: { key: THEME_KEY } });
        if (row)
            yield row.update({ value: theme, updated_by: userId });
        else
            yield MailSetting.create({ key: THEME_KEY, value: theme, updated_by: userId });
        cache = null;
        return readTheme();
    });
}
export function resetTheme() {
    return __awaiter(this, void 0, void 0, function* () {
        yield MailSetting.destroy({ where: { key: THEME_KEY } });
        cache = null;
        return readTheme();
    });
}
