var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import etherial from 'etherial';
import { createHash } from 'crypto';
import { MailTemplate } from '../models/MailTemplate.js';
import { MailTemplateVersion } from '../models/MailTemplateVersion.js';
import { localizeBlocks, normalizeBlocks, normalizeLine, placeholdersOf } from './blocks.js';
import { peopleNames, person } from './people.js';
import { render } from './render.js';
import { state } from './state.js';
import { activeTheme, normalizeTheme } from './theme.js';
import { MailError, examplesOf, isRtl, localesOf, localize, pickLocale, variablesOf, } from './options.js';
export function definitions() {
    var _a;
    return (_a = state.config.emails) !== null && _a !== void 0 ? _a : [];
}
export function definition(key) {
    const found = definitions().find((d) => d.key === key);
    if (!found)
        throw new MailError('email_not_found', 404, `No email "${key}" in the mail leaf's config`);
    return found;
}
/** A language the project writes in, else a 400. */
export function checkLocale(locale) {
    const { locales, defaultLocale } = localesOf(state.config);
    if (locale === undefined || locale === null || locale === '')
        return defaultLocale;
    if (typeof locale !== 'string' || !locales.includes(locale))
        throw new MailError('invalid_locale', 400);
    return locale;
}
export function codeVersion(def, locale) {
    const { defaultLocale } = localesOf(state.config);
    return {
        subject: localize(def.subject, locale, defaultLocale),
        preheader: localize(def.preheader, locale, defaultLocale),
        blocks: localizeBlocks(def.blocks, locale, defaultLocale),
    };
}
/** Changes when the code's version of this email changes. */
export function hashOf(version) {
    return createHash('sha1').update(JSON.stringify(version)).digest('hex');
}
/** Stored versions are checked again on the way out: a row edited by hand can't break an email. */
function storedVersion(row) {
    if (!row)
        return null;
    try {
        return { subject: normalizeLine(row.subject, 'subject', true), preheader: normalizeLine(row.preheader, 'preheader', false), blocks: normalizeBlocks(row.blocks) };
    }
    catch (err) {
        console.error(`[ETHMailLeaf] The back-office's "${row.key}" (${row.locale}) is invalid, sending the code's:`, (err === null || err === void 0 ? void 0 : err.message) || err);
        return null;
    }
}
function customRow(key, locale) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return yield MailTemplate.findOne({ where: { key, locale } });
        }
        catch (err) {
            // No table yet, or the database is down: the code's version still goes out.
            console.error('[ETHMailLeaf] Could not read the back-office versions:', (err === null || err === void 0 ? void 0 : err.message) || err);
            return null;
        }
    });
}
/** The version that goes out: the back-office's when it has one (unless the email is locked), else the code's. */
export function activeVersion(def, locale) {
    return __awaiter(this, void 0, void 0, function* () {
        if (def.editable !== false) {
            const custom = storedVersion(yield customRow(def.key, locale));
            if (custom)
                return { version: custom, custom: true };
        }
        return { version: codeVersion(def, locale), custom: false };
    });
}
/** `theme` is the one emails go out with (`activeTheme()`), or a draft the back-office previews. */
export function renderVersion(version, locale, data, theme, notice) {
    const { defaultLocale } = localesOf(state.config);
    return render(Object.assign(Object.assign({}, version), { data,
        locale, fallbackLocale: defaultLocale, rtl: isRtl(state.config, locale), theme,
        notice }));
}
function userLocale(user) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!user || !state.config.locale)
            return null;
        try {
            return (_a = (yield state.config.locale(user))) !== null && _a !== void 0 ? _a : null;
        }
        catch (err) {
            console.error("[ETHMailLeaf] The config's locale() failed:", (err === null || err === void 0 ? void 0 : err.message) || err);
            return null;
        }
    });
}
/** The language an email goes out in: the one asked, else the person's, else the default. */
export function resolveLocale(input) {
    return __awaiter(this, void 0, void 0, function* () {
        return pickLocale(state.config, input.locale, yield userLocale(input.user));
    });
}
export function renderMail(key_1) {
    return __awaiter(this, arguments, void 0, function* (key, input = {}) {
        var _a;
        const def = definition(key);
        const locale = yield resolveLocale(input);
        const { version } = yield activeVersion(def, locale);
        return renderVersion(version, locale, (_a = input.data) !== null && _a !== void 0 ? _a : {}, yield activeTheme());
    });
}
export function pulse() {
    const leaf = etherial.eth_pulse_leaf;
    if (!(leaf === null || leaf === void 0 ? void 0 : leaf.email))
        throw new MailError('pulse_missing', 500, 'ETHMailLeaf sends through ETHPulseLeaf: add it to the config, with an email provider');
    return leaf;
}
/** Renders and sends through ETHPulseLeaf, which logs it in the person's timeline. Never throws on a send failure: reads `sent`. */
export function sendMail(key_1, input_1) {
    return __awaiter(this, arguments, void 0, function* (key, input, options = {}) {
        var _a, _b, _c, _d, _e;
        const rendered = yield renderMail(key, input);
        if (rendered.missing.length)
            console.warn(`[ETHMailLeaf] "${key}" sent without ${rendered.missing.map((v) => `{{${v}}}`).join(', ')}`);
        const subject = ((_a = options.subjectPrefix) !== null && _a !== void 0 ? _a : '') + rendered.subject;
        try {
            const result = yield pulse()
                .email()
                .send({
                to: input.to,
                cc: input.cc,
                bcc: input.bcc,
                from: state.config.from,
                replyTo: (_b = input.replyTo) !== null && _b !== void 0 ? _b : state.config.replyTo,
                subject,
                html: rendered.html,
                text: rendered.text,
                attachments: input.attachments,
                userId: (_e = (_c = input.userId) !== null && _c !== void 0 ? _c : (_d = input.user) === null || _d === void 0 ? void 0 : _d.id) !== null && _e !== void 0 ? _e : undefined,
            }, state.config.provider);
            if (!(result === null || result === void 0 ? void 0 : result.success))
                console.error(`[ETHMailLeaf] "${key}" was not sent:`, result === null || result === void 0 ? void 0 : result.error);
            return Object.assign(Object.assign({}, rendered), { subject, key, sent: !!(result === null || result === void 0 ? void 0 : result.success), messageId: result === null || result === void 0 ? void 0 : result.messageId, error: (result === null || result === void 0 ? void 0 : result.success) ? undefined : result === null || result === void 0 ? void 0 : result.error });
        }
        catch (err) {
            if (err instanceof MailError)
                throw err;
            console.error(`[ETHMailLeaf] "${key}" was not sent:`, (err === null || err === void 0 ? void 0 : err.message) || err);
            return Object.assign(Object.assign({}, rendered), { subject, key, sent: false, error: (err === null || err === void 0 ? void 0 : err.message) || String(err) });
        }
    });
}
// ── What the back-office reads and saves
function variablesFor(def, versions) {
    const declared = variablesOf(def);
    const names = new Set(declared.map((v) => v.name));
    const used = new Set(versions.flatMap((v) => placeholdersOf(v)));
    return {
        variables: declared.map((v) => (Object.assign(Object.assign({}, v), { used: used.has(v.name) }))),
        /** Written in a version, but the code never fills it in: it will come out blank. */
        unknown: [...used].filter((name) => !names.has(name)),
    };
}
export function listMails() {
    return __awaiter(this, void 0, void 0, function* () {
        const { locales } = localesOf(state.config);
        const rows = yield MailTemplate.findAll({ attributes: ['key', 'locale', 'updated_at', 'default_hash'] }).catch(() => []);
        return definitions().map((def) => {
            var _a, _b;
            const custom = rows.filter((r) => r.key === def.key && locales.includes(r.locale));
            return {
                key: def.key,
                name: def.name,
                description: (_a = def.description) !== null && _a !== void 0 ? _a : null,
                category: (_b = def.category) !== null && _b !== void 0 ? _b : null,
                editable: def.editable !== false,
                subject: localize(def.subject, localesOf(state.config).defaultLocale, localesOf(state.config).defaultLocale),
                customized: custom.map((r) => r.locale),
                outdated: custom.filter((r) => r.default_hash && r.default_hash !== hashOf(codeVersion(def, r.locale))).map((r) => r.locale),
                updatedAt: custom.reduce((last, r) => (!last || r.updated_at > last ? r.updated_at : last), null),
            };
        });
    });
}
export function readMail(key, localeInput) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const def = definition(key);
        const locale = checkLocale(localeInput);
        const code = codeVersion(def, locale);
        const row = def.editable === false ? null : yield customRow(key, locale);
        const custom = storedVersion(row);
        const { locales, defaultLocale } = localesOf(state.config);
        return Object.assign({ key: def.key, name: def.name, description: (_a = def.description) !== null && _a !== void 0 ? _a : null, category: (_b = def.category) !== null && _b !== void 0 ? _b : null, editable: def.editable !== false, locale,
            locales,
            defaultLocale, dir: isRtl(state.config, locale) ? 'rtl' : 'ltr', default: code, custom: custom && row ? Object.assign(Object.assign({}, custom), { updatedAt: row.updated_at, updatedBy: row.updated_by, outdated: !!row.default_hash && row.default_hash !== hashOf(code) }) : null }, variablesFor(def, [code, ...(custom ? [custom] : [])]));
    });
}
/** A version as the back-office sent it, checked. Missing parts are the code's. */
export function draftOf(def, locale, body) {
    const code = codeVersion(def, locale);
    return {
        subject: (body === null || body === void 0 ? void 0 : body.subject) === undefined ? code.subject : normalizeLine(body.subject, 'subject', true),
        preheader: (body === null || body === void 0 ? void 0 : body.preheader) === undefined ? code.preheader : normalizeLine(body.preheader, 'preheader', false),
        blocks: (body === null || body === void 0 ? void 0 : body.blocks) === undefined ? code.blocks : normalizeBlocks(body.blocks),
    };
}
/** The examples, with what the back-office typed over them. */
function previewData(def, input) {
    const data = examplesOf(def);
    if (input && typeof input === 'object' && !Array.isArray(input)) {
        for (const [name, value] of Object.entries(input))
            if (typeof value === 'string' || typeof value === 'number')
                data[name] = value;
    }
    return data;
}
/** Renders a draft without saving it, with the examples: what the editor shows as you type. */
export function previewMail(key, body) {
    return __awaiter(this, void 0, void 0, function* () {
        const def = definition(key);
        const locale = checkLocale(body === null || body === void 0 ? void 0 : body.locale);
        const version = (body === null || body === void 0 ? void 0 : body.subject) === undefined && (body === null || body === void 0 ? void 0 : body.blocks) === undefined ? (yield activeVersion(def, locale)).version : draftOf(def, locale, body);
        const rendered = renderVersion(version, locale, previewData(def, body === null || body === void 0 ? void 0 : body.data), yield activeTheme());
        return Object.assign(Object.assign({}, rendered), { unknown: variablesFor(def, [version]).unknown });
    });
}
/** An email as it goes out (its saved version, the examples), in a theme the back-office is editing. */
export function previewTheme(body) {
    return __awaiter(this, void 0, void 0, function* () {
        const locale = checkLocale(body === null || body === void 0 ? void 0 : body.locale);
        const theme = normalizeTheme(body === null || body === void 0 ? void 0 : body.theme);
        const def = typeof (body === null || body === void 0 ? void 0 : body.key) === 'string' && body.key ? definition(body.key) : definitions()[0];
        const version = def
            ? (yield activeVersion(def, locale)).version
            : { subject: 'Hello', preheader: '', blocks: [{ type: 'heading', text: 'Hello' }, { type: 'text', text: 'This is how your emails look.' }] };
        return renderVersion(version, locale, def ? previewData(def, undefined) : {}, theme);
    });
}
export function saveMail(key, body, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const def = definition(key);
        if (def.editable === false)
            throw new MailError('email_locked', 403, 'This email can only be changed in the code');
        const locale = checkLocale(body === null || body === void 0 ? void 0 : body.locale);
        const version = draftOf(def, locale, body);
        const restoredFrom = yield restoredVersionId(key, locale, body === null || body === void 0 ? void 0 : body.restoredFrom);
        const values = { subject: version.subject, preheader: version.preheader || null, blocks: version.blocks, updated_by: userId, default_hash: hashOf(codeVersion(def, locale)) };
        yield MailTemplate.sequelize.transaction((transaction) => __awaiter(this, void 0, void 0, function* () {
            const row = yield MailTemplate.findOne({ where: { key, locale }, transaction });
            if (row)
                yield row.update(values, { transaction });
            else
                yield MailTemplate.create(Object.assign({ key, locale }, values), { transaction });
            yield MailTemplateVersion.create({ key, locale, action: 'save', subject: values.subject, preheader: values.preheader, blocks: values.blocks, created_by: userId, restored_from: restoredFrom }, { transaction });
        }));
        return readMail(key, locale);
    });
}
export function resetMail(key_1, localeInput_1) {
    return __awaiter(this, arguments, void 0, function* (key, localeInput, userId = null) {
        definition(key);
        const locale = checkLocale(localeInput);
        yield MailTemplate.sequelize.transaction((transaction) => __awaiter(this, void 0, void 0, function* () {
            const removed = yield MailTemplate.destroy({ where: { key, locale }, transaction });
            // Only a reset that changed what goes out is history.
            if (removed)
                yield MailTemplateVersion.create({ key, locale, action: 'reset', created_by: userId }, { transaction });
        }));
        return readMail(key, locale);
    });
}
// ── History
/** The version a save says it brings back: one of this email's, in this language, else nothing. */
function restoredVersionId(key, locale, input) {
    return __awaiter(this, void 0, void 0, function* () {
        const id = Number(input);
        if (input === undefined || input === null || !Number.isInteger(id) || id <= 0)
            return null;
        const row = yield MailTemplateVersion.findOne({ where: { id, key, locale }, attributes: ['id'] });
        return row ? row.id : null;
    });
}
const HISTORY_LIMIT = 100;
/** The saves and resets of one email in one language, newest first. */
export function listVersions(key, localeInput) {
    return __awaiter(this, void 0, void 0, function* () {
        const def = definition(key);
        const locale = checkLocale(localeInput);
        const rows = yield MailTemplateVersion.findAll({
            where: { key, locale },
            attributes: ['id', 'action', 'subject', 'created_by', 'restored_from', 'created_at'],
            order: [['id', 'DESC']],
            limit: HISTORY_LIMIT,
        });
        const names = yield peopleNames(rows.map((r) => r.created_by));
        const live = def.editable !== false && !!(yield customRow(key, locale));
        return rows.map((row, i) => ({
            id: row.id,
            action: row.action,
            subject: row.subject,
            createdAt: row.created_at,
            createdBy: person(row.created_by, names),
            restoredFrom: row.restored_from,
            /** What goes out now: the newest save, while the back-office's version is in place. */
            current: i === 0 && row.action === 'save' && live,
        }));
    });
}
export function readVersion(key, idInput) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        definition(key);
        const id = Number(idInput);
        const row = Number.isInteger(id) && id > 0 ? yield MailTemplateVersion.findOne({ where: { id, key } }) : null;
        if (!row)
            throw new MailError('version_not_found', 404);
        const names = yield peopleNames([row.created_by]);
        return {
            id: row.id,
            locale: row.locale,
            action: row.action,
            subject: (_a = row.subject) !== null && _a !== void 0 ? _a : '',
            preheader: (_b = row.preheader) !== null && _b !== void 0 ? _b : '',
            blocks: (_c = row.blocks) !== null && _c !== void 0 ? _c : [],
            createdAt: row.created_at,
            createdBy: person(row.created_by, names),
            restoredFrom: row.restored_from,
        };
    });
}
/** Sends the draft (or the saved version) to one address, with the examples, `[Test]` in front of the subject. */
export function testMail(key, body, fallbackTo) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const def = definition(key);
        const locale = checkLocale(body === null || body === void 0 ? void 0 : body.locale);
        const to = typeof (body === null || body === void 0 ? void 0 : body.to) === 'string' && body.to.trim() ? body.to.trim() : fallbackTo;
        if (!to || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(to))
            throw new MailError('invalid_recipient', 400);
        const version = (body === null || body === void 0 ? void 0 : body.subject) === undefined && (body === null || body === void 0 ? void 0 : body.blocks) === undefined ? (yield activeVersion(def, locale)).version : draftOf(def, locale, body);
        const rendered = renderVersion(version, locale, previewData(def, body === null || body === void 0 ? void 0 : body.data), yield activeTheme());
        const subject = '[Test] ' + rendered.subject;
        const result = yield pulse()
            .email()
            .send({ to, from: state.config.from, replyTo: state.config.replyTo, subject, html: rendered.html, text: rendered.text }, state.config.provider);
        if (!(result === null || result === void 0 ? void 0 : result.success))
            throw new MailError('send_failed', 502, (result === null || result === void 0 ? void 0 : result.error) || 'The provider refused the email');
        return { sent: true, to, subject, messageId: (_a = result.messageId) !== null && _a !== void 0 ? _a : null };
    });
}
