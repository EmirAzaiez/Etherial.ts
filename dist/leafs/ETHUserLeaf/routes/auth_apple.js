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
import { ShouldProtectBruteForce, ShouldUseLimiter } from 'etherial/components/http.security/provider';
import { AuthFormApple } from '../forms/auth_form.js';
import { verifyAppleIdentityToken } from '../utils/apple_token_verifier.js';
const getModels = () => {
    const models = etherial.database.sequelize.models;
    return {
        User: models.User,
    };
};
let ETHUserLeafAuthAppleController = class ETHUserLeafAuthAppleController {
    /**
     * Apple Sign-In.
     *
     * The identity token from Apple is REQUIRED to be cryptographically verified
     * against Apple's JWKS — signature, issuer, audience and expiration are all
     * enforced. Email is treated as a hint, never as proof of identity: account
     * linking is done strictly on the verified `sub` claim. An attacker who can
     * forge a JWT with the right email therefore cannot take over another user.
     *
     * @route POST /auth/apple
     */
    authApple(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            try {
                const { User } = getModels();
                const appleConfig = (_b = (_a = etherial.eth_user_leaf) === null || _a === void 0 ? void 0 : _a.config) === null || _b === void 0 ? void 0 : _b.apple;
                if (!appleConfig || !appleConfig.audience) {
                    console.error('[auth/apple] Refusing to verify Apple token: ETHUserLeafConfig.apple.audience is not set. ' +
                        'Configure your Service ID / bundle identifier to enable Sign in with Apple.');
                    return res.error({
                        status: 500,
                        errors: ['api.apple.not_configured']
                    });
                }
                let payload;
                try {
                    payload = yield verifyAppleIdentityToken(req.form.apple_token, {
                        audience: appleConfig.audience,
                    });
                }
                catch (verifyErr) {
                    console.warn('[auth/apple] Identity token rejected:', verifyErr.message);
                    return res.error({
                        status: 401,
                        errors: ['api.apple.invalid_token']
                    });
                }
                const appleId = payload.sub;
                const verifiedEmail = payload.email;
                const emailIsVerified = payload.email_verified === true || payload.email_verified === 'true';
                // 1. Match on verified Apple sub — the only trustworthy identifier.
                let user = yield User.findOne({ where: { apple_id: appleId } });
                if (!user) {
                    // 2. Optional email-based linking: only if Apple itself says the email
                    //    is verified AND that local account has NOT confirmed its email
                    //    yet (so we're not silently grafting Apple onto a confirmed,
                    //    independently-owned account based on a hint claim).
                    if (verifiedEmail && emailIsVerified) {
                        const existingEmailUser = yield User.findOne({
                            where: { email: verifiedEmail },
                            attributes: { include: ['email_confirmed'] }
                        });
                        if (existingEmailUser) {
                            if (!existingEmailUser.email_confirmed) {
                                user = yield existingEmailUser.update({
                                    apple_id: appleId,
                                    should_set_password: true,
                                    password: null,
                                    email_confirmed: true,
                                    email_confirmed_at: new Date()
                                });
                            }
                            else {
                                // Account exists with a confirmed email but no Apple link.
                                // Refuse to silently bind — the legitimate owner should sign in
                                // with their password and link Apple from their settings page.
                                return res.error({
                                    status: 409,
                                    errors: ['api.apple.email_already_in_use']
                                });
                            }
                        }
                        else {
                            user = yield User.create({
                                apple_id: appleId,
                                email: verifiedEmail,
                                firstname: req.form.firstname || '',
                                lastname: req.form.lastname || '',
                                should_set_password: true,
                                email_confirmed: true,
                                email_confirmed_at: new Date()
                            });
                        }
                    }
                    else {
                        // No verified email and no existing Apple link — we have nothing
                        // safe to bind on. Apple omits email on subsequent sign-ins, so
                        // the client must surface this on first sign-in.
                        return res.error({
                            status: 400,
                            errors: ['api.errors.email.required']
                        });
                    }
                }
                ;
                (_d = (_c = req).resetBruteForce) === null || _d === void 0 ? void 0 : _d.call(_c);
                res.success({
                    status: 200,
                    data: {
                        token: etherial.http_auth.generateToken({
                            user_id: user.id,
                            tv: user.token_version
                        })
                    }
                });
                user.insertAuditLog({
                    req: req,
                    action: 'USER_LOGIN_APPLE',
                    status: 'Success',
                    resource: 'auth_apple'
                });
            }
            catch (err) {
                console.error('Error during Apple authentication:', err);
                res.error({
                    status: 500,
                    errors: ['api.internal_error']
                });
            }
        });
    }
};
__decorate([
    Post('/auth/apple'),
    ShouldUseLimiter({ windowMs: 60000, max: 10 }),
    ShouldProtectBruteForce({
        freeRetries: 10,
        minWait: 1000,
        maxWait: 15 * 60000,
        lifetime: 60 * 60,
    }),
    ShouldValidateYupForm(AuthFormApple),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHUserLeafAuthAppleController.prototype, "authApple", null);
ETHUserLeafAuthAppleController = __decorate([
    Controller()
], ETHUserLeafAuthAppleController);
export default ETHUserLeafAuthAppleController;
