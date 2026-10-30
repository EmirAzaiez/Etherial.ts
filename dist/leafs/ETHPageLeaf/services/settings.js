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
import { PageSettings } from '../models/PageSettings.js';
import { normalizeHead } from './blocks.js';
import { fontIdOf } from './fonts.js';
import { DEFAULT_HEAD } from './options.js';
import { state } from './state.js';
// ──────────────────────────────────────────────────────────────────────────
// The settings of every page, from the back-office: their fonts, how they
// open. Kept in memory, read again from the database after half a minute, so
// that drawing a page (for the app, for the web) never waits for it.
// ──────────────────────────────────────────────────────────────────────────
const ID = 1;
const FRESH = 30000;
/** Changed when the HTML is drawn differently: every published page is written again at the next boot. */
const DRAWING = 5;
let saved = {};
let savedHead = {};
let readAt = 0;
/** How every page opens: no page's own photo in it. */
function lookOf(head) {
    const look = Object.assign({}, (head !== null && head !== void 0 ? head : {}));
    delete look.photo;
    return look;
}
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
        savedHead = lookOf(normalizeHead(row === null || row === void 0 ? void 0 : row.head));
        readAt = Date.now();
    })
        .catch((err) => { var _a; return console.error('[ETHPageLeaf] Could not read the pages settings:', (_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : err); })
        .finally(() => {
        reading = null;
    }));
    return reading;
}
function fresh() {
    if (Date.now() - readAt > FRESH)
        void loadSettings();
}
/** The fonts the pages are drawn in now: the back-office's, else the theme's. */
export function pageFonts() {
    var _a, _b, _c, _d;
    fresh();
    const theme = (_b = (_a = state.config.theme) === null || _a === void 0 ? void 0 : _a.fonts) !== null && _b !== void 0 ? _b : {};
    return clean({ title: (_c = saved.title) !== null && _c !== void 0 ? _c : theme.title, text: (_d = saved.text) !== null && _d !== void 0 ? _d : theme.text });
}
/** How a page opens when it sets nothing: the theme's look, under it `DEFAULT_HEAD`. */
export function themeHead() {
    var _a;
    return Object.assign(Object.assign({}, DEFAULT_HEAD), lookOf(normalizeHead((_a = state.config.theme) === null || _a === void 0 ? void 0 : _a.head)));
}
/**
 * How a page opens: its own choices, over every page's (`look`, else the
 * back-office's), over the theme's. `look` is the one the settings are
 * trying out, not saved yet. The page's own photo isn't in it: it is the
 * page's cover (`photoOf`).
 */
export function pageHead(own, look) {
    fresh();
    return lookOf(Object.assign(Object.assign(Object.assign({}, themeHead()), (look === undefined ? savedHead : lookOf(look))), (own !== null && own !== void 0 ? own : {})));
}
function out() {
    var _a, _b;
    return { fonts: { title: (_a = saved.title) !== null && _a !== void 0 ? _a : null, text: (_b = saved.text) !== null && _b !== void 0 ? _b : null }, head: savedHead };
}
export function readSettings() {
    return __awaiter(this, void 0, void 0, function* () {
        yield loadSettings();
        return out();
    });
}
const same = (a, b) => JSON.stringify(a !== null && a !== void 0 ? a : {}) === JSON.stringify(b !== null && b !== void 0 ? b : {});
/**
 * `{ fonts: { title?, text? }, head? }`: a font given replaces the one set,
 * null goes back to the theme's; a head replaces every page's look, null
 * goes back to the theme's. `changed`: the pages' HTML has to be written again.
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
        const head = 'head' in body ? lookOf(normalizeHead(body.head)) : savedHead;
        const changed = next.title !== saved.title || next.text !== saved.text || !same(head, savedHead);
        if (changed) {
            const [row] = yield PageSettings.findOrCreate({ where: { id: ID }, defaults: { id: ID, fonts: {} } });
            yield row.update({ fonts: next, head: Object.keys(head).length ? head : null });
            saved = next;
            savedHead = head;
            readAt = Date.now();
        }
        return { settings: out(), changed };
    });
}
/**
 * True once after the theme (or the way pages are drawn) changed since the
 * HTML was last written: the boot then writes every page again.
 */
export function lookChanged() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const look = createHash('sha256')
            .update(JSON.stringify({ drawing: DRAWING, theme: (_a = state.config.theme) !== null && _a !== void 0 ? _a : {}, publicUrl: (_b = state.config.publicUrl) !== null && _b !== void 0 ? _b : null }))
            .digest('hex')
            .slice(0, 32);
        const [row] = yield PageSettings.findOrCreate({ where: { id: ID }, defaults: { id: ID, fonts: {} } });
        if (row.look === look)
            return false;
        yield row.update({ look });
        return true;
    });
}
