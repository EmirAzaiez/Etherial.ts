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
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
import etherial from 'etherial';
import { communicationsOptions, userCommunications } from '../services/communications.js';
const getAdminLeaf = () => etherial.eth_admin_leaf;
const getPulseLeaf = () => etherial.eth_pulse_leaf;
let ETHPulseCommunicationsController = class ETHPulseCommunicationsController {
    /**
     * GET /admin/pulse/users/:id/communications?before=ISO&limit=30&channel=push
     *
     * Everything the user was sent, newest first, and their devices. Whoever
     * may open the user's record may read it.
     */
    userCommunications(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const config = communicationsOptions((_b = (_a = getPulseLeaf()) === null || _a === void 0 ? void 0 : _a.config) === null || _b === void 0 ? void 0 : _b.communications);
            if (!config) {
                return res.error({ status: 404, errors: ['Not found'] });
            }
            const adminLeaf = getAdminLeaf();
            const collection = (_c = config.usersCollection) !== null && _c !== void 0 ? _c : 'users';
            if (!adminLeaf || !(yield adminLeaf.checkAccess(req.user, collection, 'show'))) {
                return res.error({ status: 403, errors: ['Forbidden'] });
            }
            const userId = Number(req.params.id);
            if (!Number.isInteger(userId) || userId <= 0) {
                return res.error({ status: 400, errors: ['Invalid user id'] });
            }
            const before = typeof req.query.before === 'string' ? new Date(req.query.before) : undefined;
            if (before && Number.isNaN(before.getTime())) {
                return res.error({ status: 400, errors: ['Invalid cursor'] });
            }
            const result = yield userCommunications({
                userId,
                before,
                limit: Number(req.query.limit) || undefined,
                channel: typeof req.query.channel === 'string' && req.query.channel ? req.query.channel : undefined,
                config,
            });
            if (!result) {
                return res.error({ status: 404, errors: ['User not found'] });
            }
            return res.success({ status: 200, data: result });
        });
    }
};
__decorate([
    Get('/admin/pulse/users/:id/communications'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHPulseCommunicationsController.prototype, "userCommunications", null);
ETHPulseCommunicationsController = __decorate([
    Controller()
], ETHPulseCommunicationsController);
export default ETHPulseCommunicationsController;
