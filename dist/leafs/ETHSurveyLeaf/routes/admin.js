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
import { Controller, Get } from 'etherial/components/http/provider';
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
import { RESPONSES_COLLECTION } from '../services/options.js';
import { ReportError, comments, ensurePostgres, overview, userResponses } from '../services/reports.js';
/** Whoever may list the answers may read the reports: one switch in a role's permissions. */
function guard(req, res, run) {
    return __awaiter(this, void 0, void 0, function* () {
        const adminLeaf = etherial.eth_admin_leaf;
        const allowed = !!adminLeaf &&
            (yield adminLeaf.canAccessAdmin(req.user)) &&
            (yield adminLeaf.checkAccess(req.user, RESPONSES_COLLECTION, 'list'));
        if (!allowed)
            return res.error({ status: 403, errors: ['forbidden'] });
        try {
            ensurePostgres();
            return res.success({ status: 200, data: yield run() });
        }
        catch (err) {
            if (err instanceof ReportError)
                return res.error({ status: err.status, errors: [err.code] });
            console.error('[ETHSurveyLeaf] Report failed:', (err === null || err === void 0 ? void 0 : err.message) || err);
            return res.error({ status: 500, errors: ['report_failed'] });
        }
    });
}
let ETHSurveyAdminController = class ETHSurveyAdminController {
    /** GET /admin/surveys/overview?survey=&from=YYYY-MM-DD&to=YYYY-MM-DD */
    overview(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return guard(req, res, () => overview(req.query));
        });
    }
    /** GET /admin/surveys/comments?survey=&from=&to=&group=high|mid|low&all=1&limit=&before= */
    comments(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return guard(req, res, () => comments(req.query));
        });
    }
    /** GET /admin/surveys/users/:id — everything one person was asked. */
    user(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const id = Number(req.params.id);
            if (!Number.isInteger(id))
                return res.error({ status: 404, errors: ['not_found'] });
            return guard(req, res, () => userResponses(id));
        });
    }
};
__decorate([
    Get('/admin/surveys/overview'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHSurveyAdminController.prototype, "overview", null);
__decorate([
    Get('/admin/surveys/comments'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHSurveyAdminController.prototype, "comments", null);
__decorate([
    Get('/admin/surveys/users/:id'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHSurveyAdminController.prototype, "user", null);
ETHSurveyAdminController = __decorate([
    Controller()
], ETHSurveyAdminController);
export default ETHSurveyAdminController;
