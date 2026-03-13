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
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
import { EmailValidationSendForm, EmailValidationConfirmForm } from '../forms/user_form';
import * as crypto from 'crypto';
const getModels = () => {
    const models = etherial.database.sequelize.models;
    return {
        User: models.User,
    };
};
let ETHUserLeafEmailController = class ETHUserLeafEmailController {
    /**
     * Send Email Validation
     *
     * Sends a validation token to the authenticated user's email address.
     * This endpoint allows users to verify their email address by receiving a confirmation token.
     *
     *
     * @route POST /users/me/email/send
     * @access Private (requires authentication)
     * @param {Request} req - Request object containing authenticated user
     * @param {Response} res - Response object
     *
     * @returns {Promise<any>} JSON response with success/error status
     *
     * @success {200} Validation email sent successfully
     * @error {400} Email already confirmed
     * @error {429} Too many requests - validation already requested within last minute
     * @error {500} Internal server error
     *
     * @example
     * Request Body: {} (empty - uses authenticated user's email)
     *
     * Success Response:
     * {
     *   "status": 200,
     *   "data": {
     *     "message": "Email validation sent successfully"
     *   }
     * }
     *
     * Error Response:
     * {
     *   "status": 400,
     *   "errors": ["api.email.already_confirmed"]
     * }
     *
     * Rate Limit Error Response:
     * {
     *   "status": 429,
     *   "errors": ["api.email.validation_too_frequent"]
     * }
     */
    sendEmailValidation(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { User } = getModels();
                const user = yield User.unscoped().findByPk(req.user.id);
                if (user && !user.email_confirmed) {
                    // Check if an email validation was requested within the last minute
                    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
                    if (!user.email_confirmed_at || user.email_confirmed_at <= oneMinuteAgo) {
                        // Generate secure random token
                        const confirmationToken = crypto.randomInt(100000, 1000000).toString();
                        yield user.update({
                            email_confirmation_token: confirmationToken,
                            email_confirmed_at: new Date(), // We use this field to track last request time
                            email_confirmed: false, // Ensure it stays false
                        });
                        yield user.sendEmailForEmailVerification(confirmationToken);
                        res.success({
                            status: 200,
                            data: {
                                message: 'Email validation sent successfully',
                            },
                        });
                        user.insertAuditLog({
                            req: req,
                            status: 'Success',
                            action: 'USER_EMAIL_VALIDATION_SENT',
                            resource: 'user',
                        });
                    }
                    else {
                        res.error({
                            status: 429, // Too Many Requests
                            errors: ['api.email.validation_too_frequent'],
                        });
                    }
                }
                else if (user && user.email_confirmed) {
                    res.error({
                        status: 400,
                        errors: ['api.email.already_confirmed'],
                    });
                }
                else {
                    res.error({
                        status: 404,
                        errors: ['api.user.not_found'],
                    });
                }
            }
            catch (error) {
                console.error('Error during email validation send:', error);
                res.error({
                    status: 500,
                    errors: ['api.internal_error'],
                });
            }
        });
    }
    /**
     * Confirm Email Validation
     *
     * Confirms the user's email address using the token sent via email.
     * This endpoint allows users to verify their email address using their confirmation token.
     *
     * @route POST /users/me/email/confirm
     * @access Private (requires authentication)
     * @param {Request} req - Request object containing form data and authenticated user
     * @param {string} req.form.token - Email confirmation token from email
     * @param {Response} res - Response object
     *
     * @returns {Promise<any>} JSON response with success/error status
     *
     * @success {200} Email confirmed successfully
     * @error {400} Invalid token | Email already confirmed
     * @error {404} User not found
     * @error {500} Internal server error
     *
     * @example
     * Request Body:
     * {
     *   "token": "abc123def456..."
     * }
     *
     * Success Response:
     * {
     *   "status": 200,
     *   "data": {
     *     "message": "Email has been confirmed successfully"
     *   }
     * }
     *
     * Error Response:
     * {
     *   "status": 400,
     *   "errors": ["api.email.confirmation_token_invalid"]
     * }
     */
    confirmEmailValidation(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { User } = getModels();
                const user = yield User.unscoped().findByPk(req.user.id);
                if (user && !user.email_confirmed && user.isConfirmationTokenValid(req.form.token)) {
                    // Confirm email and clear token
                    yield user.update({
                        email_confirmed: true,
                        email_confirmed_at: new Date(),
                        email_confirmation_token: null,
                    });
                    res.success({
                        status: 200,
                        data: {
                            message: 'Email has been confirmed successfully',
                        },
                    });
                    user.insertAuditLog({
                        req: req,
                        status: 'Success',
                        action: 'USER_EMAIL_VALIDATION_CONFIRMED',
                        resource: 'user',
                    });
                }
                else if (!user) {
                    res.error({
                        status: 404,
                        errors: ['api.user.not_found'],
                    });
                }
                else if (user.email_confirmed) {
                    res.error({
                        status: 400,
                        errors: ['api.email.already_confirmed'],
                    });
                }
                else {
                    res.error({
                        status: 400,
                        errors: ['api.email.confirmation_token_invalid'],
                    });
                }
            }
            catch (error) {
                console.error('Error during email validation confirmation:', error);
                res.error({
                    status: 500,
                    errors: ['api.internal_error'],
                });
            }
        });
    }
};
__decorate([
    Post('/users/me/email/send'),
    ShouldBeAuthenticated(),
    ShouldValidateYupForm(EmailValidationSendForm),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHUserLeafEmailController.prototype, "sendEmailValidation", null);
__decorate([
    Post('/users/me/email/confirm'),
    ShouldBeAuthenticated(),
    ShouldValidateYupForm(EmailValidationConfirmForm),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHUserLeafEmailController.prototype, "confirmEmailValidation", null);
ETHUserLeafEmailController = __decorate([
    Controller()
], ETHUserLeafEmailController);
export default ETHUserLeafEmailController;
