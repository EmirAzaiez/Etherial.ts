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
import { Controller, Post } from 'etherial/components/http/provider';
import { ShouldValidateYupForm } from 'etherial/components/http/yup.validator';
import { AuthFormEmail, AuthFormUsername } from '../forms/auth_form';
import * as bcrypt from 'bcrypt';
const getModels = () => {
    const models = etherial.database.sequelize.models;
    return {
        User: models.User,
    };
};
let ETHUserLeafAuthController = class ETHUserLeafAuthController {
    authEmail(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { User } = getModels();
            let user = yield User.unscoped().findOne({
                where: {
                    email: req.form.email.toLowerCase()
                }
            });
            if (user) {
                if (bcrypt.compareSync(req.form.password, user.password)) {
                    res.success({
                        status: 200,
                        data: {
                            token: etherial.http_auth.generateToken({
                                user_id: user.id,
                                device: req.form.device
                            })
                        }
                    });
                    user.insertAuditLog({
                        req: req,
                        action: 'USER_LOGIN_EMAIL',
                        status: 'Success',
                        resource: 'auth',
                        metadata: {
                            device: req.form.device
                        }
                    });
                }
                else {
                    res.error({
                        status: 400,
                        errors: ['api.form.errors.invalid_login']
                    });
                }
            }
            else {
                res.error({
                    status: 400,
                    errors: ['api.form.errors.invalid_login']
                });
            }
        });
    }
    authUsername(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { User } = getModels();
            let user = yield User.unscoped().findOne({
                where: {
                    username: req.form.username
                }
            });
            if (user) {
                if (bcrypt.compareSync(req.form.password, user.password)) {
                    res.success({
                        status: 200,
                        data: {
                            token: etherial.http_auth.generateToken({
                                user_id: user.id,
                                device: req.form.device
                            })
                        }
                    });
                    user.insertAuditLog({
                        req: req,
                        action: 'USER_LOGIN_USERNAME',
                        status: 'Success',
                        resource: 'auth',
                        metadata: {
                            device: req.form.device
                        }
                    });
                }
                else {
                    res.error({
                        status: 400,
                        errors: ['api.form.errors.invalid_login']
                    });
                }
            }
            else {
                res.error({
                    status: 400,
                    errors: ['api.form.errors.invalid_login']
                });
            }
        });
    }
};
__decorate([
    Post('/auth/email'),
    ShouldValidateYupForm(AuthFormEmail),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHUserLeafAuthController.prototype, "authEmail", null);
__decorate([
    Post('/auth/username'),
    ShouldValidateYupForm(AuthFormUsername),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHUserLeafAuthController.prototype, "authUsername", null);
ETHUserLeafAuthController = __decorate([
    Controller()
], ETHUserLeafAuthController);
export default ETHUserLeafAuthController;
