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
import { EVENTS_COLLECTION } from '../services/options.js';
import { ReportError, ensurePostgres, events, flows, funnel, live, overview, parseSteps, rangeOf, retention, session, userActivity, } from '../services/reports.js';
/**
 * Whoever may list the analytics events may read every report: one switch in
 * a role's permissions opens the whole Analytics page.
 */
function guard(req, res, run) {
    return __awaiter(this, void 0, void 0, function* () {
        const adminLeaf = etherial.eth_admin_leaf;
        const allowed = !!adminLeaf &&
            (yield adminLeaf.canAccessAdmin(req.user)) &&
            (yield adminLeaf.checkAccess(req.user, EVENTS_COLLECTION, 'list'));
        if (!allowed)
            return res.error({ status: 403, errors: ['forbidden'] });
        try {
            ensurePostgres();
            return res.success({ status: 200, data: yield run() });
        }
        catch (err) {
            if (err instanceof ReportError)
                return res.error({ status: err.status, errors: [err.code] });
            console.error('[ETHAnalyticsLeaf] Report failed:', (err === null || err === void 0 ? void 0 : err.message) || err);
            return res.error({ status: 500, errors: ['report_failed'] });
        }
    });
}
const FLOW_TYPES = ['screen', 'action', 'api'];
const LIST_TYPES = ['screen', 'action', 'api', 'app'];
function oneOf(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
}
// Under /admin/insights, not /admin/analytics: EasyPrivacy (uBlock, AdBlock) blocks
// any URL containing `/analytics/event`, so the reports would come back empty for
// every admin running an ad blocker.
let ETHAnalyticsAdminController = class ETHAnalyticsAdminController {
    /** GET /admin/insights/overview?from=YYYY-MM-DD&to=YYYY-MM-DD */
    overview(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return guard(req, res, () => overview(rangeOf(req.query)));
        });
    }
    /** GET /admin/insights/live — who is in the app in the last 5 minutes. */
    live(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return guard(req, res, () => live());
        });
    }
    /** GET /admin/insights/events?type=screen|action|api|app&from&to */
    events(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return guard(req, res, () => events(oneOf(req.query.type, LIST_TYPES, 'screen'), rangeOf(req.query)));
        });
    }
    /** GET /admin/insights/flows?type=screen&name=HomeScreen&from&to */
    flows(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const name = typeof req.query.name === 'string' && req.query.name ? req.query.name.slice(0, 160) : undefined;
            return guard(req, res, () => flows(oneOf(req.query.type, FLOW_TYPES, 'screen'), rangeOf(req.query), name));
        });
    }
    /** GET /admin/insights/funnel?steps=screen:A,api:POST /x&scope=session|person&from&to */
    funnel(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const scope = oneOf(req.query.scope, ['session', 'person'], 'session');
            return guard(req, res, () => funnel(parseSteps(req.query.steps), rangeOf(req.query), scope));
        });
    }
    /** GET /admin/insights/retention?weeks=8&who=users|all */
    retention(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const weeks = Math.min(Math.max(Number(req.query.weeks) || 8, 2), 26);
            return guard(req, res, () => retention(weeks, oneOf(req.query.who, ['users', 'all'], 'users')));
        });
    }
    /** GET /admin/insights/users/:id?before=<ISO date> — one user's visits and habits. */
    user(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const id = Number(req.params.id);
            const before = typeof req.query.before === 'string' && !Number.isNaN(Date.parse(req.query.before)) ? new Date(req.query.before) : undefined;
            if (!Number.isInteger(id) || id <= 0)
                return res.error({ status: 400, errors: ['invalid_id'] });
            return guard(req, res, () => userActivity(id, before));
        });
    }
    /** GET /admin/insights/sessions/:id — one visit, step by step. */
    session(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const id = String(req.params.id).slice(0, 36);
            return guard(req, res, () => session(id));
        });
    }
};
__decorate([
    Get('/admin/insights/overview'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAnalyticsAdminController.prototype, "overview", null);
__decorate([
    Get('/admin/insights/live'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAnalyticsAdminController.prototype, "live", null);
__decorate([
    Get('/admin/insights/events'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAnalyticsAdminController.prototype, "events", null);
__decorate([
    Get('/admin/insights/flows'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAnalyticsAdminController.prototype, "flows", null);
__decorate([
    Get('/admin/insights/funnel'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAnalyticsAdminController.prototype, "funnel", null);
__decorate([
    Get('/admin/insights/retention'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAnalyticsAdminController.prototype, "retention", null);
__decorate([
    Get('/admin/insights/users/:id'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAnalyticsAdminController.prototype, "user", null);
__decorate([
    Get('/admin/insights/sessions/:id'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAnalyticsAdminController.prototype, "session", null);
ETHAnalyticsAdminController = __decorate([
    Controller()
], ETHAnalyticsAdminController);
export default ETHAnalyticsAdminController;
