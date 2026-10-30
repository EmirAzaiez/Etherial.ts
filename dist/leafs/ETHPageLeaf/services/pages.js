var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Op } from 'sequelize';
import { Page } from '../models/Page.js';
import { checkSlug, coverOf, normalizeHead, normalizeLocalized, normalizePageBlocks, slugify } from './blocks.js';
import { PageError, languageName, localesOf } from './options.js';
import { publish, putPreview, takeDown } from './publish.js';
import { state } from './state.js';
// ──────────────────────────────────────────────────────────────────────────
// A page on its way to the table: checked, given an address, and published
// to the bucket before it is saved (see publish.ts).
// ──────────────────────────────────────────────────────────────────────────
const MAX_TITLE = 160;
const MAX_SUMMARY = 300;
/** What the HTML is made of: a write that touches none of it (the menu's order) leaves the bucket alone. */
const PUBLISHED_FIELDS = ['slug', 'title', 'summary', 'blocks', 'published', 'head', 'cover', 'logo'];
/**
 * The old files of a page saved under a new address or unpublished, taken
 * down once the save went through. Keyed by the row: the save updates it in
 * place, so the after hook gets the same one (a bulk edit saves several).
 */
const staleFiles = new WeakMap();
/** Pages with a preview link, written again once the save went through: the link shows the page as saved. */
const previewDue = new WeakSet();
function has(data, key) {
    return Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined;
}
function bool(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
}
function taken(slug, exceptId) {
    return __awaiter(this, void 0, void 0, function* () {
        const where = { slug };
        if (exceptId)
            where.id = { [Op.ne]: exceptId };
        return !!(yield Page.findOne({ where, attributes: ['id'] }));
    });
}
/** `opening-hours`, else `opening-hours-2`, `-3`…: a duplicate gets an address of its own. */
function freeSlug(slug) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(yield taken(slug, null)))
            return slug;
        for (let n = 2; n < 100; n++) {
            const next = `${slug.slice(0, 76)}-${n}`;
            if (!(yield taken(next, null)))
                return next;
        }
        throw new PageError(`Too many pages are at ${slug}: choose another address.`);
    });
}
function checkPublishable(page) {
    var _a, _b, _c;
    const fallback = localesOf(state.config)[0];
    if (!((_a = page.title) === null || _a === void 0 ? void 0 : _a[fallback]))
        throw new PageError(`Give the page a title in ${languageName(fallback)}.`);
    if (page.published && !((_c = (_b = page.blocks) === null || _b === void 0 ? void 0 : _b[fallback]) === null || _c === void 0 ? void 0 : _c.length)) {
        throw new PageError(`Add at least one block in ${languageName(fallback)} before publishing the page.`);
    }
}
export function prepareCreate(data) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const locales = localesOf(state.config);
        // The leaf's own columns only come in with a duplicate (a form can't write
        // them): the copy is a draft, not a second page on the web.
        const duplicate = has(data, 'html') || has(data, 'published_slug');
        const title = normalizeLocalized(data.title, 'title', locales, MAX_TITLE);
        const summary = normalizeLocalized(data.summary, 'summary', locales, MAX_SUMMARY);
        const blocks = normalizePageBlocks(data.blocks, locales);
        const wanted = has(data, 'slug') && data.slug !== null && data.slug !== '' ? checkSlug(data.slug) : slugify((_a = title[locales[0]]) !== null && _a !== void 0 ? _a : '') || 'page';
        const slug = yield freeSlug(wanted);
        const next = { slug, title, summary, blocks, published: !duplicate && bool(data.published), head: normalizeHead(data.head), cover: coverOf(data.cover), logo: coverOf(data.logo) };
        checkPublishable(next);
        const { columns } = yield publish(next, null);
        // A copy is not shared by the original's preview link.
        return Object.assign(Object.assign(Object.assign(Object.assign({}, data), next), columns), { preview_key: null });
    });
}
export function prepareUpdate(record, data) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        if (!PUBLISHED_FIELDS.some((key) => has(data, key)))
            return data;
        const locales = localesOf(state.config);
        const out = Object.assign({}, data);
        if (has(data, 'title'))
            out.title = normalizeLocalized(data.title, 'title', locales, MAX_TITLE);
        if (has(data, 'summary'))
            out.summary = normalizeLocalized(data.summary, 'summary', locales, MAX_SUMMARY);
        if (has(data, 'blocks'))
            out.blocks = normalizePageBlocks(data.blocks, locales);
        if (has(data, 'published'))
            out.published = bool(data.published);
        if (has(data, 'head'))
            out.head = normalizeHead(data.head);
        if (has(data, 'cover'))
            out.cover = coverOf(data.cover);
        if (has(data, 'logo'))
            out.logo = coverOf(data.logo);
        if (has(data, 'slug')) {
            out.slug = checkSlug(data.slug);
            if (out.slug !== record.slug && (yield taken(out.slug, record.id)))
                throw new PageError(`Another page is already at ${out.slug}.`);
        }
        const previous = record.get({ plain: true });
        const next = {
            slug: (_a = out.slug) !== null && _a !== void 0 ? _a : previous.slug,
            title: (_b = out.title) !== null && _b !== void 0 ? _b : previous.title,
            summary: (_c = out.summary) !== null && _c !== void 0 ? _c : previous.summary,
            blocks: (_d = out.blocks) !== null && _d !== void 0 ? _d : previous.blocks,
            published: (_e = out.published) !== null && _e !== void 0 ? _e : previous.published,
            head: 'head' in out ? out.head : previous.head,
            cover: 'cover' in out ? out.cover : previous.cover,
            logo: 'logo' in out ? out.logo : previous.logo,
        };
        checkPublishable(next);
        const { columns, stale } = yield publish(next, previous);
        if (stale.length)
            staleFiles.set(record, stale);
        if (record.preview_key)
            previewDue.add(record);
        return Object.assign(Object.assign({}, out), columns);
    });
}
/** After the save: the files of the old address go, the preview link shows the new version. */
export function afterUpdate(saved) {
    return __awaiter(this, void 0, void 0, function* () {
        const stale = staleFiles.get(saved);
        if (stale) {
            staleFiles.delete(saved);
            takeDown(stale);
        }
        if (previewDue.has(saved)) {
            previewDue.delete(saved);
            // A bucket that refuses leaves the link on the version before: the save went through all the same.
            yield putPreview(saved.get({ plain: true }), saved.preview_key).catch((err) => { var _a; return console.error('[ETHPageLeaf] A preview link could not be written again:', (_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : err); });
        }
    });
}
