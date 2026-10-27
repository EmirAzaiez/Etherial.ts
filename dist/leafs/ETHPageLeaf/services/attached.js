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
import { Page } from '../models/Page.js';
import { normalizeLocalized, normalizePageBlocks } from './blocks.js';
import { PAGE_TYPE, PageError, localesOf } from './options.js';
import { afterUpdate, prepareCreate, prepareUpdate } from './pages.js';
import { takeDownPage } from './publish.js';
import { state } from './state.js';
function optionsOf(field) {
    var _a;
    return Object.assign({ title: 'title' }, ((_a = field === null || field === void 0 ? void 0 : field.page) !== null && _a !== void 0 ? _a : {}));
}
function valueOf(record, name) {
    return (record === null || record === void 0 ? void 0 : record.get) ? record.get(name) : record === null || record === void 0 ? void 0 : record[name];
}
/** The page the record owns; one it only points at (a page of the list) is never written from it. */
function ownPage(record, name, collection) {
    return __awaiter(this, void 0, void 0, function* () {
        const id = valueOf(record, name);
        if (!id)
            return null;
        const page = yield Page.findByPk(id);
        return (page === null || page === void 0 ? void 0 : page.owner) === collection ? page : null;
    });
}
/** The blocks the form wrote: `{ blocks }`. Anything else (the id it loaded) leaves them as they are. */
function blocksIn(value) {
    return value && typeof value === 'object' && !Array.isArray(value) && 'blocks' in value ? value.blocks : undefined;
}
/** A column of the record, when this save writes it. */
function written(data, name) {
    return name && Object.prototype.hasOwnProperty.call(data, name) ? data[name] : undefined;
}
/** Keys in order: the database gives a JSON column back with its keys sorted its own way. */
function stable(value) {
    return JSON.stringify(value !== null && value !== void 0 ? value : {}, (_key, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v);
}
const same = (a, b) => stable(a) === stable(b);
/**
 * The field's `beforeSave`: the page written with the record, its id for the
 * column. A record without a page gets one with its first block; the title
 * follows the record's. Only what changed is published again.
 */
export function savePageField(value, field, context) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const options = optionsOf(field);
        const locales = localesOf(state.config);
        const current = (_a = valueOf(context.record, field.name)) !== null && _a !== void 0 ? _a : null;
        const page = yield ownPage(context.record, field.name, context.collection);
        const rawBlocks = blocksIn(value);
        const blocks = rawBlocks === undefined ? undefined : normalizePageBlocks(rawBlocks, locales);
        const title = written(context.data, options.title);
        const summary = written(context.data, options.summary);
        // Compared before they are checked: the length limits are the save's to tell.
        const loose = (text, name) => normalizeLocalized(text, name, locales, Infinity);
        if (!page) {
            if (!blocks || !Object.values(blocks).some((list) => list.length))
                return current;
            const data = yield prepareCreate({ title, summary, blocks, published: !!((_b = blocks[locales[0]]) === null || _b === void 0 ? void 0 : _b.length) });
            const created = yield Page.create(Object.assign(Object.assign({}, data), { owner: context.collection, in_menu: false }));
            return created.id;
        }
        const changes = {};
        if (title !== undefined && !same(loose(title, 'title'), page.title))
            changes.title = title;
        if (summary !== undefined && !same(loose(summary, 'summary'), page.summary))
            changes.summary = summary;
        if (blocks && !same(blocks, page.blocks)) {
            changes.blocks = blocks;
            changes.published = !!((_c = blocks[locales[0]]) === null || _c === void 0 ? void 0 : _c.length);
        }
        if (!Object.keys(changes).length)
            return page.id;
        yield page.update(yield prepareUpdate(page, changes));
        yield afterUpdate(page);
        return page.id;
    });
}
/** The field's `duplicate`: the copy of a record gets a copy of its page, not a share of it. */
export function copyPageField(value, field, context) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const page = yield ownPage({ [field.name]: value }, field.name, context.collection);
        if (!page)
            return (_a = value) !== null && _a !== void 0 ? _a : null;
        const data = yield prepareCreate({ title: page.title, summary: page.summary, blocks: page.blocks, published: page.published });
        const copy = yield Page.create(Object.assign(Object.assign({}, data), { owner: context.collection, in_menu: false }));
        return copy.id;
    });
}
/** The field's `afterDelete`: the record's page goes with it, its HTML too. */
export function deletePageField(value, field, context) {
    return __awaiter(this, void 0, void 0, function* () {
        const page = yield ownPage({ [field.name]: value }, field.name, context.collection);
        if (!page)
            return;
        yield page.destroy();
        takeDownPage(page);
    });
}
/**
 * The page of a record, for its form in the back-office: null when it has
 * none yet. Whoever may open the record may read it, Pages or not.
 */
export function attachedPage(collectionName, id, fieldName) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const collection = (_a = etherial.eth_admin_leaf) === null || _a === void 0 ? void 0 : _a.getCollection(collectionName);
        const field = (_b = collection === null || collection === void 0 ? void 0 : collection.fields) === null || _b === void 0 ? void 0 : _b.find((f) => f.name === fieldName && f.type === PAGE_TYPE);
        if (!field)
            throw new PageError('No page field there.', 404);
        const record = yield collection.model.findByPk(id);
        if (!record)
            throw new PageError('Not found.', 404);
        const page = yield ownPage(record, fieldName, collectionName);
        if (!page)
            return null;
        return { id: page.id, slug: page.slug, blocks: page.blocks, published: page.published, html: page.html };
    });
}
