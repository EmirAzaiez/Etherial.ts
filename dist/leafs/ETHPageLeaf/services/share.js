var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import crypto from 'node:crypto';
import { Page } from '../models/Page.js';
import { COLLECTION, PageError } from './options.js';
import { previewKeyOf, publicBase, putPreview, retirePreview, writtenLocales } from './publish.js';
/** The page asked for, with the collection whose rights apply to it: the news it is the content of, else the Pages. */
export function pageToShare(id) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const page = /^\d+$/.test(String(id)) ? yield Page.findByPk(Number(id)) : null;
        return { page, collection: (_a = page === null || page === void 0 ? void 0 : page.owner) !== null && _a !== void 0 ? _a : COLLECTION };
    });
}
export function linksOf(page) {
    var _a;
    if (!page)
        throw new PageError('Not found.', 404);
    const key = page.preview_key;
    return {
        published: page.published,
        web: page.published ? Object.assign({}, ((_a = page.html) !== null && _a !== void 0 ? _a : {})) : {},
        preview: key ? Object.fromEntries(writtenLocales(page.blocks).map((l) => [l, `${publicBase()}/${previewKeyOf(key, l)}`])) : null,
    };
}
/** A bucket that refuses: the link is not made, or not stopped. */
function inBucket(write, what) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            yield write();
        }
        catch (err) {
            if (err instanceof PageError)
                throw err;
            console.error(`[ETHPageLeaf] ${what}:`, (_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : err);
            throw new PageError(`${what}: the bucket did not take it. Try again.`, 502);
        }
    });
}
/**
 * The page's preview link: made the first time, the same one after. Its files
 * are written again on each click, so one lost in the bucket comes back.
 * `silent`: sharing is not an edit of the page.
 */
export function startPreview(page) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!page)
            return linksOf(page);
        const key = (_a = page.preview_key) !== null && _a !== void 0 ? _a : crypto.randomBytes(18).toString('base64url');
        yield inBucket(() => putPreview(page.get({ plain: true }), key), 'The preview link could not be made');
        if (!page.preview_key)
            yield page.update({ preview_key: key }, { silent: true });
        return linksOf(page);
    });
}
/** Its preview link stopped: whoever has it gets "This link no longer works". The files first: a link still showing the page is not stopped. */
export function stopPreview(page) {
    return __awaiter(this, void 0, void 0, function* () {
        if (page === null || page === void 0 ? void 0 : page.preview_key) {
            yield inBucket(() => retirePreview(page.preview_key), 'The preview link could not be stopped');
            yield page.update({ preview_key: null }, { silent: true });
        }
        return linksOf(page);
    });
}
