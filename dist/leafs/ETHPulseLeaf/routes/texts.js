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
import { Controller, Delete, Get, Put } from 'etherial/components/http/provider';
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
import etherial from 'etherial';
import { PulseTextError, TEXTS_COLLECTION, listTexts, resetText, saveText } from '../services/texts.js';
/** Reading takes the right to read the texts collection, changing them the right to update it. */
function guard(req, res, method, run) {
    return __awaiter(this, void 0, void 0, function* () {
        const adminLeaf = etherial.eth_admin_leaf;
        const allowed = !!adminLeaf && (yield adminLeaf.canAccessAdmin(req.user)) && (yield adminLeaf.checkAccess(req.user, TEXTS_COLLECTION, method));
        if (!allowed)
            return res.error({ status: 403, errors: ['forbidden'] });
        try {
            return res.success({ status: 200, data: yield run() });
        }
        catch (err) {
            if (err instanceof PulseTextError)
                return res.error({ status: err.status, errors: [err.code], message: err.message });
            console.error('[ETHPulseLeaf] Texts route failed:', err);
            return res.error({ status: 500, errors: ['server_error'] });
        }
    });
}
let ETHPulseTextsController = class ETHPulseTextsController {
    listTexts(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return guard(req, res, 'list', () => listTexts());
        });
    }
    saveText(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return guard(req, res, 'update', () => { var _a, _b; return saveText(req.params.key, req.body, (_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null); });
        });
    }
    resetText(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return guard(req, res, 'update', () => resetText(req.params.key, req.query.locale));
        });
    }
};
__decorate([
    Get('/admin/pulse/texts'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHPulseTextsController.prototype, "listTexts", null);
__decorate([
    Put('/admin/pulse/texts/:key'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHPulseTextsController.prototype, "saveText", null);
__decorate([
    Delete('/admin/pulse/texts/:key'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHPulseTextsController.prototype, "resetText", null);
ETHPulseTextsController = __decorate([
    Controller()
], ETHPulseTextsController);
export default ETHPulseTextsController;
