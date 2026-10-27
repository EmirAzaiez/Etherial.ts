var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { PageSettings } from '../models/PageSettings.js';
import { fontIdOf } from './fonts.js';
import { state } from './state.js';
// ──────────────────────────────────────────────────────────────────────────
// The settings of every page, from the back-office: their fonts. Kept in
// memory, read again from the database after half a minute, so that drawing
// a page (for the app, for the web) never waits for it.
// ──────────────────────────────────────────────────────────────────────────
const ID = 1;
const FRESH = 30000;
let saved = {};
let readAt = 0;
let reading = null;
function clean(fonts) {
    const f = (fonts && typeof fonts === 'object' ? fonts : {});
    const out = {};
    const title = fontIdOf(f.title);
    const text = fontIdOf(f.text);
    if (title)
        out.title = title;
    if (text)
        out.text = text;
    return out;
}
/** Reads the row again; a database that fails keeps what was read before. */
export function loadSettings() {
    reading !== null && reading !== void 0 ? reading : (reading = PageSettings.findByPk(ID)
        .then((row) => {
        saved = clean(row === null || row === void 0 ? void 0 : row.fonts);
        readAt = Date.now();
    })
        .catch((err) => { var _a; return console.error('[ETHPageLeaf] Could not read the pages settings:', (_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : err); })
        .finally(() => {
        reading = null;
    }));
    return reading;
}
/** The fonts the pages are drawn in now: the back-office's, else the theme's. */
export function pageFonts() {
    var _a, _b, _c, _d;
    if (Date.now() - readAt > FRESH)
        void loadSettings();
    const theme = (_b = (_a = state.config.theme) === null || _a === void 0 ? void 0 : _a.fonts) !== null && _b !== void 0 ? _b : {};
    return clean({ title: (_c = saved.title) !== null && _c !== void 0 ? _c : theme.title, text: (_d = saved.text) !== null && _d !== void 0 ? _d : theme.text });
}
function out() {
    var _a, _b;
    return { fonts: { title: (_a = saved.title) !== null && _a !== void 0 ? _a : null, text: (_b = saved.text) !== null && _b !== void 0 ? _b : null } };
}
export function readSettings() {
    return __awaiter(this, void 0, void 0, function* () {
        yield loadSettings();
        return out();
    });
}
/**
 * `{ fonts: { title?, text? } }`: a font given replaces the one set, null goes
 * back to the theme's. `changed`: the pages' HTML has to be written again.
 */
export function saveSettings(body) {
    return __awaiter(this, void 0, void 0, function* () {
        yield loadSettings();
        const given = body.fonts && typeof body.fonts === 'object' ? body.fonts : {};
        const next = Object.assign({}, saved);
        for (const role of ['title', 'text']) {
            if (!(role in given))
                continue;
            const id = fontIdOf(given[role]);
            if (id)
                next[role] = id;
            else
                delete next[role];
        }
        const changed = next.title !== saved.title || next.text !== saved.text;
        if (changed) {
            const [row] = yield PageSettings.findOrCreate({ where: { id: ID }, defaults: { id: ID, fonts: {} } });
            yield row.update({ fonts: next });
            saved = next;
            readAt = Date.now();
        }
        return { settings: out(), changed };
    });
}
