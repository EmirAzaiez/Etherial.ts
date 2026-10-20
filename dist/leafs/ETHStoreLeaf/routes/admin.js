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
import { Controller, Get, Post } from 'etherial/components/http/provider';
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
import { STATS_COLLECTION, STORES } from '../services/options.js';
import { ReportError, ensurePostgres, overview, reviewsOf } from '../services/reports.js';
import { syncStores } from '../services/sync.js';
/** How long "Sync now" waits before it answers: a long backfill goes on, and the page asks again. */
const SYNC_WAIT_MS = 20 * 1000;
/** Whoever may list the daily rows may read the page and sync it: one switch in a role's permissions. */
function guard(req, res, run) {
    return __awaiter(this, void 0, void 0, function* () {
        const adminLeaf = etherial.eth_admin_leaf;
        const allowed = !!adminLeaf &&
            (yield adminLeaf.canAccessAdmin(req.user)) &&
            (yield adminLeaf.checkAccess(req.user, STATS_COLLECTION, 'list'));
        if (!allowed)
            return res.error({ status: 403, errors: ['forbidden'] });
        try {
            ensurePostgres();
            return res.success({ status: 200, data: yield run() });
        }
        catch (err) {
            if (err instanceof ReportError)
                return res.error({ status: err.status, errors: [err.code] });
            console.error('[ETHStoreLeaf] Report failed:', (err === null || err === void 0 ? void 0 : err.message) || err);
            return res.error({ status: 500, errors: ['report_failed'] });
        }
    });
}
let ETHStoreAdminController = class ETHStoreAdminController {
    /** GET /admin/stores/overview?from=YYYY-MM-DD&to=YYYY-MM-DD */
    overview(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return guard(req, res, () => overview(req.query));
        });
    }
    /** GET /admin/stores/reviews?from=&to=&store=&stars=&replied=yes|no&page= */
    reviews(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return guard(req, res, () => reviewsOf(req.query));
        });
    }
    /**
     * POST /admin/stores/sync { store? } — reads the stores now. `done` once
     * it is over, `running` when it goes on past the wait, `busy` when another
     * sync already runs.
     */
    sync(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return guard(req, res, () => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const asked = (_a = req.body) === null || _a === void 0 ? void 0 : _a.store;
                const only = STORES.includes(asked) ? asked : undefined;
                const run = syncStores({ force: true, only });
                run.catch((err) => console.error('[ETHStoreLeaf] Sync failed:', (err === null || err === void 0 ? void 0 : err.message) || err));
                const outcome = yield Promise.race([
                    run.then((ran) => (ran ? 'done' : 'busy')),
                    new Promise((resolve) => { var _a, _b; return (_b = (_a = setTimeout(() => resolve('running'), SYNC_WAIT_MS)).unref) === null || _b === void 0 ? void 0 : _b.call(_a); }),
                ]);
                return { outcome };
            }));
        });
    }
};
__decorate([
    Get('/admin/stores/overview'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHStoreAdminController.prototype, "overview", null);
__decorate([
    Get('/admin/stores/reviews'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHStoreAdminController.prototype, "reviews", null);
__decorate([
    Post('/admin/stores/sync'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHStoreAdminController.prototype, "sync", null);
ETHStoreAdminController = __decorate([
    Controller()
], ETHStoreAdminController);
export default ETHStoreAdminController;
