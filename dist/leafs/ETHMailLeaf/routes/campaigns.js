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
import { cancelCampaign, countAudience, createCampaign, deleteCampaign, duplicateCampaign, listAudiences, listCampaigns, listRecipients, previewCampaign, readCampaign, scheduleCampaign, testCampaign, unscheduleCampaign, updateCampaign, } from '../services/campaigns.js';
import { guard, originOf } from '../services/http.js';
import { CAMPAIGNS_COLLECTION } from '../services/options.js';
/** The rights are the campaigns collection's: read, create, update (which sends), delete. */
const can = (method) => (req, res, run) => guard(req, res, CAMPAIGNS_COLLECTION, method, run);
const read = can('list');
const create = can('create');
const write = can('update');
const remove = can('delete');
const userId = (req) => { var _a, _b; return (_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null; };
let ETHMailCampaignsController = class ETHMailCampaignsController {
    audiences(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return read(req, res, () => listAudiences());
        });
    }
    countAudience(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return read(req, res, () => countAudience(req.query.audience));
        });
    }
    list(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return read(req, res, () => listCampaigns(req.query));
        });
    }
    create(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return create(req, res, () => createCampaign(req.body, userId(req)));
        });
    }
    preview(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return read(req, res, () => previewCampaign(req.body, originOf(req)));
        });
    }
    show(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return read(req, res, () => readCampaign(req.params.id));
        });
    }
    update(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return write(req, res, () => updateCampaign(req.params.id, req.body, userId(req)));
        });
    }
    destroy(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return remove(req, res, () => deleteCampaign(req.params.id));
        });
    }
    recipients(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return read(req, res, () => listRecipients(req.params.id, req.query));
        });
    }
    duplicate(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return create(req, res, () => duplicateCampaign(req.params.id, userId(req)));
        });
    }
    test(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return write(req, res, () => { var _a, _b; return testCampaign(req.body, (_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a.email) !== null && _b !== void 0 ? _b : null, originOf(req)); });
        });
    }
    schedule(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return write(req, res, () => scheduleCampaign(req.params.id, req.body, userId(req), originOf(req)));
        });
    }
    unschedule(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return write(req, res, () => unscheduleCampaign(req.params.id, userId(req)));
        });
    }
    cancel(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return write(req, res, () => cancelCampaign(req.params.id, userId(req)));
        });
    }
};
__decorate([
    Get('/admin/mail-audiences'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailCampaignsController.prototype, "audiences", null);
__decorate([
    Get('/admin/mail-audiences/count'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailCampaignsController.prototype, "countAudience", null);
__decorate([
    Get('/admin/mail-campaigns'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailCampaignsController.prototype, "list", null);
__decorate([
    Post('/admin/mail-campaigns'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailCampaignsController.prototype, "create", null);
__decorate([
    Post('/admin/mail-campaigns/preview'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailCampaignsController.prototype, "preview", null);
__decorate([
    Get('/admin/mail-campaigns/:id'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailCampaignsController.prototype, "show", null);
__decorate([
    Put('/admin/mail-campaigns/:id'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailCampaignsController.prototype, "update", null);
__decorate([
    Delete('/admin/mail-campaigns/:id'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailCampaignsController.prototype, "destroy", null);
__decorate([
    Get('/admin/mail-campaigns/:id/recipients'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailCampaignsController.prototype, "recipients", null);
__decorate([
    Post('/admin/mail-campaigns/:id/duplicate'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailCampaignsController.prototype, "duplicate", null);
__decorate([
    Post('/admin/mail-campaigns/:id/test'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailCampaignsController.prototype, "test", null);
__decorate([
    Post('/admin/mail-campaigns/:id/schedule'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailCampaignsController.prototype, "schedule", null);
__decorate([
    Post('/admin/mail-campaigns/:id/unschedule'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailCampaignsController.prototype, "unschedule", null);
__decorate([
    Post('/admin/mail-campaigns/:id/cancel'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailCampaignsController.prototype, "cancel", null);
ETHMailCampaignsController = __decorate([
    Controller()
], ETHMailCampaignsController);
export default ETHMailCampaignsController;
