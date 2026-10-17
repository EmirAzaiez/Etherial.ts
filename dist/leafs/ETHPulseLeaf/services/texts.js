var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { createHash } from 'crypto';
import { PulseText } from '../models/PulseText.js';
export class PulseTextError extends Error {
    constructor(code, status = 400, message) {
        super(message || code);
        this.code = code;
        this.status = status;
    }
}
export const TEXTS_COLLECTION = 'pulse-texts';
const CACHE_MS = 30000;
/** `{{unit}}`, or `{{unit|your unit}}`: the text after `|` goes in when the value is empty. */
const PLACEHOLDER = /\{\{\s*([\w.]+)\s*(?:\|([^{}|]*))?\}\}/g;
let config = null;
let cache = null;
export function setTextsConfig(input) {
    var _a;
    if (!input)
        return;
    const keys = input.items.map((i) => i.key);
    const twice = keys.find((k, i) => keys.indexOf(k) !== i);
    if (twice)
        throw new Error(`[ETHPulseLeaf] Two texts share the key "${twice}"`);
    const bad = keys.find((k) => !/^[a-z0-9][a-z0-9_.-]{0,127}$/i.test(k));
    if (bad !== undefined)
        throw new Error(`[ETHPulseLeaf] "${bad}" can't be a text key: letters, digits, _ . - only`);
    if (!((_a = input.locales) === null || _a === void 0 ? void 0 : _a.length))
        throw new Error('[ETHPulseLeaf] texts.locales is empty');
    config = input;
}
export function textsEnabled() {
    return !!config;
}
function conf() {
    if (!config)
        throw new PulseTextError('texts_off', 404, 'Notification texts are not set up: add `texts` to the pulse leaf config');
    return config;
}
export function textLocales() {
    const { locales, defaultLocale, rtlLocales } = conf();
    return {
        locales,
        defaultLocale: defaultLocale && locales.includes(defaultLocale) ? defaultLocale : locales[0],
        rtlLocales: (rtlLocales !== null && rtlLocales !== void 0 ? rtlLocales : ['ar', 'fa', 'he', 'ur']).filter((l) => locales.includes(l)),
    };
}
function find(key) {
    const item = conf().items.find((i) => i.key === key);
    if (!item)
        throw new PulseTextError('text_not_found', 404);
    return item;
}
function checkLocale(value) {
    const { locales } = textLocales();
    if (typeof value !== 'string' || !locales.includes(value))
        throw new PulseTextError('invalid_locale', 400, `The language must be one of ${locales.join(', ')}`);
    return value;
}
function codeText(item, locale) {
    var _a, _b, _c;
    const { defaultLocale } = textLocales();
    if (typeof item.text === 'string')
        return item.text;
    return (_c = (_b = (_a = item.text[locale]) !== null && _a !== void 0 ? _a : item.text[defaultLocale]) !== null && _b !== void 0 ? _b : Object.values(item.text)[0]) !== null && _c !== void 0 ? _c : '';
}
const hashOf = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);
const rowKey = (key, locale) => `${key}\u0000${locale}`;
function rows() {
    return __awaiter(this, void 0, void 0, function* () {
        if (cache && Date.now() - cache.at < CACHE_MS)
            return cache.rows;
        try {
            const all = yield PulseText.findAll();
            cache = { rows: new Map(all.map((r) => [rowKey(r.key, r.locale), r])), at: Date.now() };
        }
        catch (err) {
            // No table yet, or the database is down: the code's texts still go out.
            console.error('[ETHPulseLeaf] Could not read the back-office texts:', (err === null || err === void 0 ? void 0 : err.message) || err);
            cache = { rows: new Map(), at: Date.now() };
        }
        return cache.rows;
    });
}
function variablesOf(item) {
    var _a;
    return Object.entries((_a = item.variables) !== null && _a !== void 0 ? _a : {}).map(([name, v]) => { var _a; return v !== null && typeof v === 'object' ? { name, label: (_a = v.label) !== null && _a !== void 0 ? _a : name, example: v.example === undefined ? '' : String(v.example) } : { name, label: name, example: String(v) }; });
}
function fill(text, data) {
    return text
        .replace(PLACEHOLDER, (_, path, fallback) => {
        const value = path.split('.').reduce((at, part) => (at === null || at === undefined ? undefined : at[part]), data);
        const text = value === undefined || value === null || typeof value === 'object' ? '' : String(value).trim();
        return text || (fallback !== null && fallback !== void 0 ? fallback : '').trim();
    })
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}
function userLocale(user) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const locale = config === null || config === void 0 ? void 0 : config.locale;
        if (!user || !locale)
            return null;
        try {
            return (_a = (yield locale(user))) !== null && _a !== void 0 ? _a : null;
        }
        catch (err) {
            console.error("[ETHPulseLeaf] The texts' locale() failed:", (err === null || err === void 0 ? void 0 : err.message) || err);
            return null;
        }
    });
}
/**
 * The text a notification goes out with: the back-office's for that language
 * when it has one, else the code's. The language is `locale`, else the
 * user's, else the default one.
 */
export function pulseText(key_1) {
    return __awaiter(this, arguments, void 0, function* (key, input = {}) {
        var _a, _b, _c;
        const item = find(key);
        const { locales, defaultLocale } = textLocales();
        const asked = [input.locale, yield userLocale(input.user)].map((l) => (typeof l === 'string' ? l.split(/[-_]/)[0].toLowerCase() : null));
        const locale = (_a = asked.find((l) => l && locales.includes(l))) !== null && _a !== void 0 ? _a : defaultLocale;
        const custom = item.editable === false ? null : (yield rows()).get(rowKey(key, locale));
        return fill((_b = custom === null || custom === void 0 ? void 0 : custom.text) !== null && _b !== void 0 ? _b : codeText(item, locale), (_c = input.data) !== null && _c !== void 0 ? _c : {});
    });
}
// ── The back-office
function peopleNames(ids) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const wanted = [...new Set(ids.filter((id) => Number.isInteger(id)))];
        const User = (_b = (_a = PulseText.sequelize) === null || _a === void 0 ? void 0 : _a.models) === null || _b === void 0 ? void 0 : _b.User;
        if (!wanted.length || !User)
            return new Map();
        try {
            const columns = Object.keys((_c = User.rawAttributes) !== null && _c !== void 0 ? _c : {});
            const pick = ['firstname', 'first_name', 'lastname', 'last_name', 'name', 'email'].filter((c) => columns.includes(c));
            const users = yield User.findAll({ where: { id: wanted }, attributes: ['id', ...pick], raw: true });
            return new Map(users.map((u) => {
                var _a, _b;
                const name = [(_a = u.firstname) !== null && _a !== void 0 ? _a : u.first_name, (_b = u.lastname) !== null && _b !== void 0 ? _b : u.last_name].filter(Boolean).join(' ') || u.name || u.email;
                return [u.id, name || `#${u.id}`];
            }));
        }
        catch (_d) {
            return new Map();
        }
    });
}
export function listTexts() {
    return __awaiter(this, void 0, void 0, function* () {
        const { locales, defaultLocale, rtlLocales } = textLocales();
        const all = yield rows();
        const names = yield peopleNames([...all.values()].map((r) => r.updated_by));
        return {
            locales,
            defaultLocale,
            rtlLocales,
            items: conf().items.map((item) => {
                var _a, _b, _c, _d;
                return ({
                    key: item.key,
                    name: item.name,
                    description: (_a = item.description) !== null && _a !== void 0 ? _a : null,
                    category: (_b = item.category) !== null && _b !== void 0 ? _b : null,
                    channel: (_c = item.channel) !== null && _c !== void 0 ? _c : 'push',
                    variables: variablesOf(item),
                    maxLength: (_d = item.maxLength) !== null && _d !== void 0 ? _d : 240,
                    editable: item.editable !== false,
                    texts: Object.fromEntries(locales.map((locale) => {
                        var _a, _b, _c;
                        const row = all.get(rowKey(item.key, locale));
                        const code = codeText(item, locale);
                        return [
                            locale,
                            {
                                default: code,
                                custom: (_a = row === null || row === void 0 ? void 0 : row.text) !== null && _a !== void 0 ? _a : null,
                                updatedAt: (_b = row === null || row === void 0 ? void 0 : row.updated_at) !== null && _b !== void 0 ? _b : null,
                                updatedBy: (row === null || row === void 0 ? void 0 : row.updated_by) ? { id: row.updated_by, name: (_c = names.get(row.updated_by)) !== null && _c !== void 0 ? _c : `#${row.updated_by}` } : null,
                                /** The code's text changed since this one was saved. */
                                outdated: !!row && !!row.default_hash && row.default_hash !== hashOf(code),
                            },
                        ];
                    })),
                });
            }),
        };
    });
}
export function saveText(key, body, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const item = find(key);
        if (item.editable === false)
            throw new PulseTextError('text_locked', 403, 'This text can only be changed in the code');
        const locale = checkLocale(body === null || body === void 0 ? void 0 : body.locale);
        if (typeof (body === null || body === void 0 ? void 0 : body.text) !== 'string' || !body.text.trim())
            throw new PulseTextError('invalid_text', 400, 'The text is empty');
        const text = body.text.replace(/\r\n?/g, '\n').trim();
        const max = (_a = item.maxLength) !== null && _a !== void 0 ? _a : 240;
        if (text.length > max)
            throw new PulseTextError('invalid_text', 400, `The text is longer than ${max} characters`);
        const declared = new Set(variablesOf(item).map((v) => v.name));
        const unknown = [...text.matchAll(PLACEHOLDER)].map((m) => m[1]).filter((name) => !declared.has(name.split('.')[0]));
        if (unknown.length)
            throw new PulseTextError('unknown_variable', 400, `{{${unknown[0]}}} is not filled by the code: ${declared.size ? `use ${[...declared].map((n) => `{{${n}}}`).join(', ')}` : 'this text has no variable'}`);
        const values = { text, updated_by: userId, default_hash: hashOf(codeText(item, locale)) };
        const row = yield PulseText.findOne({ where: { key, locale } });
        if (row)
            yield row.update(values);
        else
            yield PulseText.create(Object.assign({ key, locale }, values));
        cache = null;
        return listTexts();
    });
}
export function resetText(key, localeInput) {
    return __awaiter(this, void 0, void 0, function* () {
        find(key);
        const locale = checkLocale(localeInput);
        yield PulseText.destroy({ where: { key, locale } });
        cache = null;
        return listTexts();
    });
}
