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
import { Controller, Get } from 'etherial/components/http/provider';
import { Page } from '../models/Page.js';
import { localeOf } from '../services/http.js';
import { serializePage } from '../services/serialize.js';
/** No sign-in: a page is public, its HTML is in the bucket for anyone with the link. */
let ETHPageAppController = class ETHPageAppController {
    /**
     * GET /pages
     *
     * Every published page, in the app's language, blocks included: the app
     * keeps them and opens a page without waiting. Its menu lists those
     * `in_menu`, in `position` order; the others open from a link or a push.
     * The pages of other records (a news) come with them, not here.
     */
    list(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const locale = localeOf(req);
            const pages = yield Page.findAll({
                where: { published: true, owner: null },
                order: [
                    ['position', 'ASC'],
                    ['id', 'ASC'],
                ],
            });
            return res.success({ status: 200, data: pages.map((p) => serializePage(p, locale)) });
        });
    }
    /** GET /pages/:slug — one published page, in the menu or not, a news' one too: its link opens it. */
    show(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const slug = String((_a = req.params.slug) !== null && _a !== void 0 ? _a : '').toLowerCase();
            const page = /^[a-z0-9-]{1,80}$/.test(slug) ? yield Page.findOne({ where: { slug, published: true } }) : null;
            if (!page)
                return res.error({ status: 404, errors: ['page_not_found'] });
            return res.success({ status: 200, data: serializePage(page, localeOf(req)) });
        });
    }
};
__decorate([
    Get('/pages'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHPageAppController.prototype, "list", null);
__decorate([
    Get('/pages/:slug'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHPageAppController.prototype, "show", null);
ETHPageAppController = __decorate([
    Controller()
], ETHPageAppController);
export default ETHPageAppController;
