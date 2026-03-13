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
import * as jwt from 'jsonwebtoken';
import { AuthFormApple } from '../forms/auth_form';
const getModels = () => {
    const models = etherial.database.sequelize.models;
    return {
        User: models.User,
    };
};
let ETHUserLeafAuthAppleController = class ETHUserLeafAuthAppleController {
    /**
     * Apple Authentication
     *
     * Authenticates a user with Apple Sign-In using an identity token.
     * If the user does not exist, a new account is created.
     * If a user exists with the same email, the Apple ID will be linked to that account.
     * A session token is always generated upon successful authentication.
     *
     * @route POST /auth/apple
     * @access Public
     * @param {Request} req - Request object containing Apple identity token and optional user info
     * @param {string} req.form.apple_token - Apple identity token
     * @param {Response} res - Response object
     *
     * @returns {Promise<any>} JSON response with success or error status
     *
     * @success {200} User authenticated successfully (existing, updated, or newly created)
     * @error {400} Invalid Apple token | Missing email when required
     * @error {500} Internal server error
     *
     * @example
     * Request Body:
     * {
     *   "apple_token": "xxx.yyy.zzz",
     *   "firstname": "John",
     *   "lastname": "Doe"
     * }
     */
    authApple(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { User } = getModels();
                const decoded = jwt.decode(req.form.apple_token);
                if (decoded && decoded.sub) {
                    const appleId = decoded.sub;
                    const email = decoded.email;
                    // Check if user already exists with this Apple ID
                    let user = yield User.findOne({ where: { apple_id: appleId } });
                    if (!user) {
                        // Check if email already exists
                        const existingEmailUser = yield User.findOne({ where: { email }, attributes: { include: ['email_confirmed'] } });
                        if (!existingEmailUser) {
                            if (email) {
                                // Create new user when no Apple ID or email match
                                user = yield User.create({
                                    apple_id: appleId,
                                    email: email,
                                    firstname: req.form.firstname || 'Emir',
                                    lastname: req.form.lastname || 'Etherial',
                                    should_set_password: true,
                                    email_confirmed: !!email,
                                    email_confirmed_at: email ? new Date() : null
                                });
                            }
                            else {
                                return res.error({
                                    status: 400,
                                    errors: ['api.errors.email.required']
                                });
                            }
                        }
                        else {
                            if (!existingEmailUser.email_confirmed) {
                                // email exists but not confirmed → confirm it & link Apple ID
                                user = yield existingEmailUser.update({
                                    apple_id: appleId,
                                    should_set_password: true,
                                    password: null,
                                    email_confirmed: true,
                                    email_confirmed_at: new Date()
                                });
                            }
                            else {
                                // email exists and already confirmed → just link Apple ID
                                user = yield existingEmailUser.update({
                                    apple_id: appleId
                                });
                            }
                        }
                    }
                    // generate token
                    res.success({
                        status: 200,
                        data: {
                            token: etherial.http_auth.generateToken({
                                user_id: user.id
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
                else if (!decoded || !decoded.sub) {
                    res.error({
                        status: 400,
                        errors: ['api.apple.invalid_token']
                    });
                }
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
    ShouldValidateYupForm(AuthFormApple),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHUserLeafAuthAppleController.prototype, "authApple", null);
ETHUserLeafAuthAppleController = __decorate([
    Controller()
], ETHUserLeafAuthAppleController);
export default ETHUserLeafAuthAppleController;
