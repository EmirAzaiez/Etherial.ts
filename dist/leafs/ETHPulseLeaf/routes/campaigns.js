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
import { Controller, Post } from 'etherial/components/http/provider';
import { recordCampaignOpen } from '../services/campaigns.js';
let ETHPulseCampaignsController = class ETHPulseCampaignsController {
    /**
     * A campaign push was tapped. Called by the app with its installation id
     * (the `device` it registered with). Public on purpose: the person may have
     * logged out since the push went out, and all this can do is flag a
     * delivery as opened — once.
     */
    opened(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const campaignId = parseInt(req.params.id, 10);
            const device = typeof ((_a = req.body) === null || _a === void 0 ? void 0 : _a.device) === 'string' ? req.body.device.trim() : '';
            if (!campaignId || !device) {
                return res.error({ status: 400, errors: ['campaign id and device are required'] });
            }
            try {
                const counted = yield recordCampaignOpen(campaignId, device);
                return res.success({ status: 200, data: { counted } });
            }
            catch (err) {
                console.error('[Campaigns] open tracking failed:', err);
                return res.error({ status: 500, errors: ['Failed to record the open.'] });
            }
        });
    }
};
__decorate([
    Post('/campaigns/:id/opened'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHPulseCampaignsController.prototype, "opened", null);
ETHPulseCampaignsController = __decorate([
    Controller()
], ETHPulseCampaignsController);
export default ETHPulseCampaignsController;
