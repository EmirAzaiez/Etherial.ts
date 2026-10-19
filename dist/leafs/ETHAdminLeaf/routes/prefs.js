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
import { UniqueConstraintError } from 'sequelize';
import { Controller, Delete, Get, Put } from 'etherial/components/http/provider';
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
import { AdminPreference } from '../models/AdminPreference.js';
const getAdminLeaf = () => etherial.eth_admin_leaf;
/** A key the back-office names: `favorites`, `hiddenColumns`… never a path, never free text. */
const KEY = /^[A-Za-z0-9_.:-]{1,64}$/;
/** Saved views and hidden columns for every list fit far below this; anything bigger is not a preference. */
const MAX_VALUE_BYTES = 64 * 1024;
/** Keys one user may keep: the back-office uses a handful, the cap only stops a runaway client. */
const MAX_KEYS = 100;
/** The signed-in user's id, only for someone who may open the back-office. */
function ownerOf(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const adminLeaf = getAdminLeaf();
        const userId = Number((_a = req.user) === null || _a === void 0 ? void 0 : _a.id);
        if (!adminLeaf || !Number.isInteger(userId) || !(yield adminLeaf.canAccessAdmin(req.user))) {
            (_c = (_b = res).error) === null || _c === void 0 ? void 0 : _c.call(_b, { status: 403, errors: ['forbidden'] });
            return null;
        }
        return userId;
    });
}
let ETHAdminPrefsController = class ETHAdminPrefsController {
    /**
     * GET /admin/prefs → `{ [key]: value }`
     *
     * The signed-in user's back-office preferences, and only theirs: the user
     * comes from the token, never from the request.
     */
    list(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const userId = yield ownerOf(req, res);
            if (userId === null) {
                return;
            }
            const rows = yield AdminPreference.findAll({ where: { user_id: userId }, attributes: ['key', 'value'] });
            return (_b = (_a = res).success) === null || _b === void 0 ? void 0 : _b.call(_a, {
                status: 200,
                data: Object.fromEntries(rows.map((row) => [row.key, row.value])),
            });
        });
    }
    /** PUT /admin/prefs/:key, body `{ value }`: one preference, created or replaced. */
    put(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
            const userId = yield ownerOf(req, res);
            if (userId === null) {
                return;
            }
            const key = req.params.key;
            if (!KEY.test(key)) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 400, errors: ['invalid_key'] });
            }
            if (!req.body || typeof req.body !== 'object' || !('value' in req.body)) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 400, errors: ['value_required'] });
            }
            const value = (_e = req.body.value) !== null && _e !== void 0 ? _e : null;
            const size = Buffer.byteLength((_f = JSON.stringify(value)) !== null && _f !== void 0 ? _f : 'null', 'utf8');
            if (size > MAX_VALUE_BYTES) {
                return (_h = (_g = res).error) === null || _h === void 0 ? void 0 : _h.call(_g, { status: 413, errors: ['value_too_large'] });
            }
            const where = { user_id: userId, key };
            const existing = yield AdminPreference.findOne({ where });
            if (existing) {
                yield existing.update({ value });
                return (_k = (_j = res).success) === null || _k === void 0 ? void 0 : _k.call(_j, { status: 200, data: { key, value } });
            }
            if ((yield AdminPreference.count({ where: { user_id: userId } })) >= MAX_KEYS) {
                return (_m = (_l = res).error) === null || _m === void 0 ? void 0 : _m.call(_l, { status: 400, errors: ['too_many_keys'] });
            }
            try {
                yield AdminPreference.create(Object.assign(Object.assign({}, where), { value }));
            }
            catch (err) {
                // Two tabs saving the same new key at once: the other one created
                // the row a moment ago, so this write replaces it.
                if (!(err instanceof UniqueConstraintError)) {
                    throw err;
                }
                yield AdminPreference.update({ value }, { where });
            }
            return (_p = (_o = res).success) === null || _p === void 0 ? void 0 : _p.call(_o, { status: 200, data: { key, value } });
        });
    }
    /** DELETE /admin/prefs/:key: back to the back-office's default. */
    remove(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const userId = yield ownerOf(req, res);
            if (userId === null) {
                return;
            }
            const key = req.params.key;
            if (!KEY.test(key)) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 400, errors: ['invalid_key'] });
            }
            yield AdminPreference.destroy({ where: { user_id: userId, key } });
            return (_d = (_c = res).success) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 200, data: { key } });
        });
    }
};
__decorate([
    Get('/admin/prefs'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAdminPrefsController.prototype, "list", null);
__decorate([
    Put('/admin/prefs/:key'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAdminPrefsController.prototype, "put", null);
__decorate([
    Delete('/admin/prefs/:key'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAdminPrefsController.prototype, "remove", null);
ETHAdminPrefsController = __decorate([
    Controller()
], ETHAdminPrefsController);
export default ETHAdminPrefsController;
export const AvailableRouteMethods = ['list', 'put', 'remove'];
