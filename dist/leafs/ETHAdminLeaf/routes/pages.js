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
import etherial from 'etherial';
import { Controller, Post, } from 'etherial/components/http/provider';
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
const getAdminLeaf = () => etherial.eth_admin_leaf;
let AdminPagesController = class AdminPagesController {
    /**
     * POST /admin/pages/:page/submit
     * Submit a custom page form
     */
    submitForm(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
            const { page: pageName } = req.params;
            const adminLeaf = getAdminLeaf();
            if (!adminLeaf) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 500, errors: ['admin_leaf_not_configured'] });
            }
            const hasAdminAccess = yield adminLeaf.canAccessAdmin(req.user);
            if (!hasAdminAccess) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 403, errors: ['forbidden'] });
            }
            const page = adminLeaf.getPage(pageName);
            if (!page) {
                return (_f = (_e = res).error) === null || _f === void 0 ? void 0 : _f.call(_e, { status: 404, errors: ['page_not_found'] });
            }
            if (typeof page.canAccess === 'function') {
                try {
                    const allowed = yield page.canAccess(req.user);
                    if (!allowed) {
                        return (_h = (_g = res).error) === null || _h === void 0 ? void 0 : _h.call(_g, { status: 403, errors: ['forbidden'] });
                    }
                }
                catch (_s) {
                    return (_k = (_j = res).error) === null || _k === void 0 ? void 0 : _k.call(_j, { status: 403, errors: ['forbidden'] });
                }
            }
            const handler = adminLeaf.getPageFormHandler(pageName);
            if (!handler) {
                return (_m = (_l = res).error) === null || _m === void 0 ? void 0 : _m.call(_l, { status: 400, errors: ['no_form_handler_registered'] });
            }
            try {
                const result = yield handler(req.body, req);
                return (_p = (_o = res).success) === null || _p === void 0 ? void 0 : _p.call(_o, { status: 200, data: result });
            }
            catch (err) {
                console.error(`[ETHAdminLeaf] Page form submit error for "${pageName}":`, err);
                return (_r = (_q = res).error) === null || _r === void 0 ? void 0 : _r.call(_q, { status: 400, errors: [err.message] });
            }
        });
    }
};
__decorate([
    Post('/admin/pages/:page/submit'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminPagesController.prototype, "submitForm", null);
AdminPagesController = __decorate([
    Controller()
], AdminPagesController);
export default AdminPagesController;
export const AvailableRouteMethods = ['submitForm'];
