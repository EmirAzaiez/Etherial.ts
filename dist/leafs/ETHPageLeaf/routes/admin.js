var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Controller, Delete, Get, Post, Put } from 'etherial/components/http/provider';
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
import { attachedPage } from '../services/attached.js';
import { guard, streamed } from '../services/http.js';
import { generatePage } from '../services/generate.js';
import { previewPage } from '../services/preview.js';
import { createTemplate, deleteTemplate, listTemplates, updateTemplate } from '../services/templates.js';
import { readSettings, saveSettings } from '../services/settings.js';
import { republishSoon } from '../services/publish.js';
import { COLLECTION } from '../services/options.js';
import { linksOf, pageToShare, startPreview, stopPreview } from '../services/share.js';
/** A route on one page, to whoever may `action` its collection (a news' page: the news'). */
function onPage(req, res, action, run) {
    return __awaiter(this, void 0, void 0, function* () {
        const { page, collection } = yield pageToShare(req.params.id);
        return guard(req, res, () => __awaiter(this, void 0, void 0, function* () { return run(page); }), (adminLeaf) => adminLeaf.checkAccess(req.user, collection, action));
    });
}
let ETHPageAdminController = class ETHPageAdminController {
    /**
     * POST /admin/content-pages/preview  { locale, title, summary, blocks, chrome? }
     *
     * The page as the web will show it, from the form being written: the
     * back-office's phone preview. A block not finished yet is drawn as it is
     * (an image to upload is a grey box) instead of failing the preview, and
     * each block's element says which one it is (`data-block`). `chrome:
     * false`: without the brand and the language switch. Any back-office user:
     * it draws what it is sent and reads nothing (a news is written by people
     * who may not see the Pages).
     */
    preview(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return guard(req, res, () => __awaiter(this, void 0, void 0, function* () { var _a; return previewPage((_a = req.body) !== null && _a !== void 0 ? _a : {}); }), () => __awaiter(this, void 0, void 0, function* () { return true; }));
        });
    }
    /**
     * POST /admin/content-pages/generate  { prompt, locales, mode, blocks?, title?, summary?, images?, documents?, links? }
     *
     * Claude writes the page from a few words, and the blocks come as they are
     * written, in server-sent events: `status` ({ phase: reading | thinking |
     * writing }), one `source` per link read ({ url, kind: page | pdf, title,
     * images }), one `block` per block ({ index, blocks: { <locale>: block } }),
     * then `done` ({ count, images, links, note, cut, model }) or `error`
     * ({ status, message }). `mode`: `new` writes the page, `add` only blocks
     * to add to `blocks`, `change` the whole of `blocks` again, changed.
     * `images`: [{ mediaType, data (base64) }], screenshots to make the page
     * from (12 at most, 5 MB each). `documents`: [{ name, data (base64) }],
     * PDFs (2 at most, 15 MB together). The API's JSON limit must allow them.
     * `links`: up to 3 https links to pages of websites (or PDFs), opened by
     * the server first; only public addresses are, never its own network. Nothing
     * is saved: the editor puts the blocks in the page. Any back-office user,
     * like the preview, when the project's AI is on (the feature's `ai`).
     */
    generate(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return streamed(req, res, (send, signal) => { var _a; return generatePage((_a = req.body) !== null && _a !== void 0 ? _a : {}, ({ event, data }) => send(event, data), signal); });
        });
    }
    /**
     * GET /admin/content-pages/of/:collection/:id/:field
     *
     * The page of a record's `page` field (a news' content), for its form:
     * null while it has none. To whoever may open the record.
     */
    attached(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { collection, id, field } = req.params;
            return guard(req, res, () => __awaiter(this, void 0, void 0, function* () { return attachedPage(collection, id, field); }), (adminLeaf) => adminLeaf.checkAccess(req.user, collection, 'show'));
        });
    }
    /**
     * GET /admin/content-pages/share/:id
     *
     * How a saved page is shared: `{ published, web, preview }`. `web`, its
     * public links once published (`{ <locale>: url }`); `preview`, its
     * preview link in each language (in the bucket too), null while it has
     * none: whoever has it sees the page as last saved, a draft too. To
     * whoever may open the page.
     */
    share(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return onPage(req, res, 'show', linksOf);
        });
    }
    /** POST /admin/content-pages/share/:id — its preview link made, the same one while it isn't stopped. To whoever may edit the page. */
    startPreview(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return onPage(req, res, 'update', startPreview);
        });
    }
    /** DELETE /admin/content-pages/share/:id — its preview link stopped: it opens "This link no longer works". */
    stopPreview(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return onPage(req, res, 'update', stopPreview);
        });
    }
    /**
     * GET /admin/content-pages/templates
     *
     * The blocks saved to start a page from, the newest first:
     * `[{ id, name, blocks, created_at, updated_at }]`. Any back-office user, like the
     * preview: a news is written with them too.
     */
    templates(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return guard(req, res, () => __awaiter(this, void 0, void 0, function* () { return listTemplates(); }), () => __awaiter(this, void 0, void 0, function* () { return true; }));
        });
    }
    /** POST /admin/content-pages/templates  { name, blocks } — the template saved. */
    createTemplate(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return guard(req, res, () => __awaiter(this, void 0, void 0, function* () { var _a; return createTemplate((_a = req.body) !== null && _a !== void 0 ? _a : {}); }), () => __awaiter(this, void 0, void 0, function* () { return true; }));
        });
    }
    /** PUT /admin/content-pages/templates/:id  { name?, blocks? } — renamed or rewritten, checked as when saved. */
    updateTemplate(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return guard(req, res, () => __awaiter(this, void 0, void 0, function* () { var _a; return updateTemplate(req.params.id, (_a = req.body) !== null && _a !== void 0 ? _a : {}); }), () => __awaiter(this, void 0, void 0, function* () { return true; }));
        });
    }
    /** DELETE /admin/content-pages/templates/:id */
    deleteTemplate(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return guard(req, res, () => __awaiter(this, void 0, void 0, function* () { return deleteTemplate(req.params.id); }), () => __awaiter(this, void 0, void 0, function* () { return true; }));
        });
    }
    /**
     * GET /admin/content-pages/settings
     *
     * What is set for every page: `{ fonts: { title, text }, head }`, ids of
     * the fonts (the feature's `fonts.catalog`), null for the theme's; how
     * they open, a key left out the theme's. Any back-office user: the editor
     * of a news draws its page with them.
     */
    settings(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return guard(req, res, () => __awaiter(this, void 0, void 0, function* () { return readSettings(); }), () => __awaiter(this, void 0, void 0, function* () { return true; }));
        });
    }
    /**
     * PUT /admin/content-pages/settings  { fonts?: { title?, text? }, head? }
     *
     * A font given replaces the one set, null goes back to the theme's; a
     * head replaces how every page opens, null goes back to the theme's. Every
     * published page is written into the bucket again, in the background. To
     * whoever may edit the pages.
     */
    updateSettings(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return guard(req, res, () => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const { settings, changed } = yield saveSettings((_a = req.body) !== null && _a !== void 0 ? _a : {});
                if (changed)
                    republishSoon('New look');
                return settings;
            }), (adminLeaf) => adminLeaf.checkAccess(req.user, COLLECTION, 'update'));
        });
    }
};
__decorate([
    Post('/admin/content-pages/preview'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHPageAdminController.prototype, "preview", null);
__decorate([
    Post('/admin/content-pages/generate'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHPageAdminController.prototype, "generate", null);
__decorate([
    Get('/admin/content-pages/of/:collection/:id(\\d+)/:field'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHPageAdminController.prototype, "attached", null);
__decorate([
    Get('/admin/content-pages/share/:id(\\d+)'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHPageAdminController.prototype, "share", null);
__decorate([
    Post('/admin/content-pages/share/:id(\\d+)'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHPageAdminController.prototype, "startPreview", null);
__decorate([
    Delete('/admin/content-pages/share/:id(\\d+)'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHPageAdminController.prototype, "stopPreview", null);
__decorate([
    Get('/admin/content-pages/templates'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHPageAdminController.prototype, "templates", null);
__decorate([
    Post('/admin/content-pages/templates'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHPageAdminController.prototype, "createTemplate", null);
__decorate([
    Put('/admin/content-pages/templates/:id(\\d+)'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHPageAdminController.prototype, "updateTemplate", null);
__decorate([
    Delete('/admin/content-pages/templates/:id(\\d+)'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHPageAdminController.prototype, "deleteTemplate", null);
__decorate([
    Get('/admin/content-pages/settings'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHPageAdminController.prototype, "settings", null);
__decorate([
    Put('/admin/content-pages/settings'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHPageAdminController.prototype, "updateSettings", null);
ETHPageAdminController = __decorate([
    Controller()
], ETHPageAdminController);
export default ETHPageAdminController;
