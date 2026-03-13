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
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
import { ShouldValidateYupForm } from 'etherial/components/http/yup.validator';
import { RegisterDeviceForm, RevokeDeviceForm } from '../forms/device_form.js';
import { Device } from '../models/Device.js';
import etherial from 'etherial';
let ETHPulseDevicesController = class ETHPulseDevicesController {
    registerDevice(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            let user_id = null;
            if (req.headers['authorization']) {
                const decoded = etherial.http_auth.decodeToken(req.headers['authorization'].replace('Bearer ', ''));
                user_id = decoded.user_id;
            }
            yield Device.registerOrUpdateDevice({
                user_id: user_id,
                form: req.form,
                user_agent: req.headers['user-agent'],
            });
            res.success({
                status: 200,
                data: {},
            });
        });
    }
    revokeDevice(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const decoded = etherial.http_auth.decodeToken(req.headers['authorization'].replace('Bearer ', ''));
            if (req.form.device === decoded.device) {
                yield Device.update({
                    user_id: null,
                }, {
                    where: {
                        device: req.form.device,
                    },
                });
                res.success({
                    status: 200,
                    data: {},
                });
            }
            else {
                return res.error({ status: 400, errors: ['api.device.not_match'] });
            }
        });
    }
};
__decorate([
    Post('/devices/register'),
    ShouldValidateYupForm(RegisterDeviceForm),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHPulseDevicesController.prototype, "registerDevice", null);
__decorate([
    Post('/devices/revoke'),
    ShouldValidateYupForm(RevokeDeviceForm),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHPulseDevicesController.prototype, "revokeDevice", null);
ETHPulseDevicesController = __decorate([
    Controller()
], ETHPulseDevicesController);
export default ETHPulseDevicesController;
