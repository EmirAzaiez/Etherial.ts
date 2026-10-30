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
import { photoOf } from './blocks.js';
import { pageIn } from './publish.js';
import { pageFonts, pageHead } from './settings.js';
import { fontsIn } from './fonts.js';
/**
 * A page as the app gets it: the blocks to draw, how it opens (`head`: the
 * cover's height, the title's place, size, weight, case, color, font; every
 * key set), its cover photo, its record's logo, and the address of its HTML
 * to share or show in a web view.
 */
export function serializePage(page, asked) {
    var _a, _b, _c, _d, _e, _f;
    const content = pageIn(page, asked);
    const head = pageHead(page.head);
    return Object.assign(Object.assign({ id: page.id, slug: page.slug }, content), { in_menu: page.in_menu, position: page.position, url: (_b = (_a = page.html) === null || _a === void 0 ? void 0 : _a[content.locale]) !== null && _b !== void 0 ? _b : null, head, cover: (_d = (_c = photoOf(page)) === null || _c === void 0 ? void 0 : _c.src) !== null && _d !== void 0 ? _d : null, logo: (_f = (_e = page.logo) === null || _e === void 0 ? void 0 : _e.src) !== null && _f !== void 0 ? _f : null, fonts: appFonts(content.blocks, head), updated_at: page.updated_at });
}
/**
 * What the app draws the words in: the titles' font and the text's (ids of
 * the catalog; null, its own), and the files of each font the page uses, the
 * blocks' own too, for those it doesn't have.
 */
function appFonts(blocks, head) {
    var _a, _b;
    const fonts = pageFonts();
    const used = fontsIn(fonts, [...blocks, { style: { font: head.font } }]);
    return {
        title: (_a = fonts.title) !== null && _a !== void 0 ? _a : null,
        text: (_b = fonts.text) !== null && _b !== void 0 ? _b : null,
        files: Object.fromEntries(used.map((f) => [f.id, { family: f.family, files: f.files }])),
    };
}
/**
 * The published pages among these ids, as the app gets them: what a record
 * with a `page` field (a news) sends along, so the app draws it at once. A
 * draft is left out.
 */
export function publishedPages(ids, locale) {
    return __awaiter(this, void 0, void 0, function* () {
        const wanted = [...new Set(ids.filter((id) => !!id))];
        if (!wanted.length)
            return new Map();
        const pages = yield Page.findAll({ where: { id: { [Op.in]: wanted }, published: true } });
        return new Map(pages.map((page) => [page.id, serializePage(page, locale)]));
    });
}
