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
import { AuthFormGoogle } from '../forms/auth_form.js';
import axios from 'axios';
const getModels = () => {
    const models = etherial.database.sequelize.models;
    return {
        User: models.User,
    };
};
let ETHUserLeafAuthGoogleController = class ETHUserLeafAuthGoogleController {
    /**
     * Google Authentication
     *
     * Authenticates a user using Google OAuth by validating the provided Google access token.
     * If the user does not exist, a new account is created.
     * If a user exists with the same email, the Google ID will be linked to that account.
     * A session token is always generated upon successful authentication.
     *
     * @route POST /auth/google
     * @access Public
     * @param {Request & { form: AuthFormGoogleType }} req - Request object containing Google access token
     * @param {string} req.form.google_token - Google access token
     * @param {Response} res - Response object
     *
     * @returns {Promise<any>} JSON response with token or error status
     *
     * @success {200} Authentication successful - returns a session token
     * @error {400} Missing Google token | Invalid Google access token
     * @error {500} Internal server error
     *
     * @example
     * Request Body:
     * {
     *   "google_token": "ya29.a0ARrdaM-example-google-access-token"
     * }
     *
     * Success Response:
     * {
     *   "status": 200,
     *   "data": {
     *     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     *   }
     * }
     *
     * Error Response (No Token):
     * {
     *   "status": 400,
     *   "errors": ["No Google access token provided"]
     * }
     *
     * Error Response (Invalid Token):
     * {
     *   "status": 400,
     *   "errors": ["Invalid Google access token"]
     * }
     */
    authGoogle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { User } = getModels();
                // Fetch user information from Google using the access token
                const googleAccount = yield axios.get('https://www.googleapis.com/userinfo/v2/me', {
                    headers: {
                        Authorization: `Bearer ${req.form.google_token}`
                    }
                });
                const { id: googleId, email, name, picture, given_name, family_name } = googleAccount.data;
                // Check if user already exists with this Google ID
                let user = yield User.findOne({ where: { google_id: googleId } });
                if (!user) {
                    // Check if email already exists
                    const existingEmailUser = yield User.findOne({ where: { email }, attributes: { include: ['email_confirmed'] } });
                    if (!existingEmailUser) {
                        // Create new user account when no Google ID or email match
                        user = yield User.create({
                            google_id: googleId,
                            email: email,
                            firstname: given_name,
                            lastname: family_name,
                            username: name,
                            avatar: picture,
                            should_set_password: true,
                            email_confirmed: true,
                            email_confirmed_at: new Date()
                        });
                    }
                    else {
                        if (!existingEmailUser.email_confirmed) {
                            // email exists but not confirmed → confirm it & link Google ID
                            user = yield existingEmailUser.update({
                                google_id: googleId,
                                should_set_password: true,
                                password: null,
                                email_confirmed: true,
                                email_confirmed_at: new Date()
                            });
                        }
                        else {
                            // email exists and already confirmed → just link Google ID
                            user = yield existingEmailUser.update({
                                google_id: googleId
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
                    action: 'USER_LOGIN_GOOGLE',
                    status: 'Success',
                    resource: 'auth_google'
                });
            }
            catch (err) {
                console.error('Error during Google authentication:', err);
                return res.error({
                    status: 400,
                    errors: ['api.errors.invalid_Google_access_token']
                });
            }
        });
    }
};
__decorate([
    Post('/auth/google'),
    ShouldValidateYupForm(AuthFormGoogle),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHUserLeafAuthGoogleController.prototype, "authGoogle", null);
ETHUserLeafAuthGoogleController = __decorate([
    Controller()
], ETHUserLeafAuthGoogleController);
export default ETHUserLeafAuthGoogleController;
