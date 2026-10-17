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
import { guard } from '../services/http.js';
import { TEMPLATES_COLLECTION } from '../services/options.js';
import { listMails, listVersions, previewMail, previewTheme, readMail, readVersion, resetMail, saveMail, testMail } from '../services/templates.js';
import { readTheme, resetTheme, saveTheme } from '../services/theme.js';
/**
 * Reading the emails and their brand takes the right to read the templates
 * collection; changing them, or sending a test, the right to update it.
 */
const read = (req, res, run) => guard(req, res, TEMPLATES_COLLECTION, 'list', run);
const write = (req, res, run) => guard(req, res, TEMPLATES_COLLECTION, 'update', run);
let ETHMailAdminController = class ETHMailAdminController {
    // The brand first: `/admin/email-theme` is not an email key.
    theme(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return read(req, res, () => readTheme());
        });
    }
    previewBrand(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return read(req, res, () => previewTheme(req.body));
        });
    }
    saveBrand(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return write(req, res, () => { var _a, _b, _c, _d; return saveTheme((_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.theme) !== null && _b !== void 0 ? _b : req.body, (_d = (_c = req.user) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : null); });
        });
    }
    resetBrand(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return write(req, res, () => resetTheme());
        });
    }
    list(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return read(req, res, () => listMails());
        });
    }
    show(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return read(req, res, () => readMail(req.params.key, req.query.locale));
        });
    }
    versions(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return read(req, res, () => listVersions(req.params.key, req.query.locale));
        });
    }
    version(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return read(req, res, () => readVersion(req.params.key, req.params.id));
        });
    }
    preview(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return read(req, res, () => previewMail(req.params.key, req.body));
        });
    }
    save(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return write(req, res, () => { var _a, _b; return saveMail(req.params.key, req.body, (_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null); });
        });
    }
    reset(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return write(req, res, () => { var _a, _b; return resetMail(req.params.key, req.query.locale, (_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null); });
        });
    }
    test(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return write(req, res, () => { var _a, _b; return testMail(req.params.key, req.body, (_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a.email) !== null && _b !== void 0 ? _b : null); });
        });
    }
};
__decorate([
    Get('/admin/email-theme'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailAdminController.prototype, "theme", null);
__decorate([
    Post('/admin/email-theme/preview'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailAdminController.prototype, "previewBrand", null);
__decorate([
    Put('/admin/email-theme'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailAdminController.prototype, "saveBrand", null);
__decorate([
    Delete('/admin/email-theme'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailAdminController.prototype, "resetBrand", null);
__decorate([
    Get('/admin/emails'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailAdminController.prototype, "list", null);
__decorate([
    Get('/admin/emails/:key'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailAdminController.prototype, "show", null);
__decorate([
    Get('/admin/emails/:key/versions'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailAdminController.prototype, "versions", null);
__decorate([
    Get('/admin/emails/:key/versions/:id'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailAdminController.prototype, "version", null);
__decorate([
    Post('/admin/emails/:key/preview'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailAdminController.prototype, "preview", null);
__decorate([
    Put('/admin/emails/:key'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailAdminController.prototype, "save", null);
__decorate([
    Delete('/admin/emails/:key'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailAdminController.prototype, "reset", null);
__decorate([
    Post('/admin/emails/:key/test'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailAdminController.prototype, "test", null);
ETHMailAdminController = __decorate([
    Controller()
], ETHMailAdminController);
export default ETHMailAdminController;
