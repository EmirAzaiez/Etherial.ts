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
import { PhoneValidationConfirmForm, PhoneValidationSendForm } from '../forms/user_phone_form.js';
import * as crypto from 'crypto';
import { Op } from 'sequelize';
const getModels = () => {
    const models = etherial.database.sequelize.models;
    return {
        User: models.User,
    };
};
let ETHUserLeafPhoneController = class ETHUserLeafPhoneController {
    /**
     * Send Phone Validation
     *
     * Sends a validation code to the authenticated user's phone number.
     * This endpoint allows users to verify their phone by receiving a confirmation code via SMS.
     *
     * @route POST /users/me/phone/send
     * @access Private (requires authentication)
     * @param {Request} req - Request object containing authenticated user and optional phone number
     * @param {Response} res - Response object
     *
     * @returns {Promise<any>} JSON response with success/error status
     *
     * @success {200} Validation code sent successfully
     * @error {400} Phone already confirmed
     * @error {404} User not found
     * @error {429} Too many requests - validation already requested within last minute
     * @error {500} Internal server error
     *
     * @example
     * Request Body:
     * {
     *   "phone": "+21612345678"
     * }
     *
     * Success Response:
     * {
     *   "status": 200,
     *   "data": {
     *     "message": "Phone validation code sent successfully"
     *   }
     * }
     *
     * Error Response:
     * {
     *   "status": 400,
     *   "errors": ["api.phone.already_confirmed"]
     * }
     *
     * Rate Limit Error Response:
     * {
     *   "status": 429,
     *   "errors": ["api.phone.validation_too_frequent"]
     * }
     */
    sendPhoneValidation(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { User } = getModels();
                const user = yield User.unscoped().findByPk(req.user.id);
                if (!user) {
                    return res.error({ status: 404, errors: ['api.user.not_found'] });
                }
                if (user.phone_verified) {
                    return res.error({ status: 400, errors: ['api.phone.already_confirmed'] });
                }
                if (!user.phone_temporary && !req.form.phone) {
                    return res.error({ status: 400, errors: ['api.phone.already_taken'] });
                }
                // Check if the phone is already taken by another user
                const phonesToCheck = [...(user.phone_temporary ? [{ phone: user.phone_temporary }] : []), ...(req.form.phone ? [{ phone: req.form.phone }] : [])];
                const existing = yield User.unscoped().findOne({
                    where: {
                        [Op.or]: phonesToCheck,
                        id: { [Op.ne]: user.id }
                    }
                });
                if (existing) {
                    return res.error({ status: 400, errors: ['api.phone.already_taken'] });
                }
                // Rate limit: one request per minute
                const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
                if (user.phone && user.phone_verified_at > oneMinuteAgo) {
                    return res.error({ status: 429, errors: ['api.phone.validation_too_frequent'] });
                }
                // Generate secure random code and update user
                const confirmationCode = crypto.randomInt(100000, 1000000).toString();
                yield user.update(Object.assign({ phone_verification_token: confirmationCode, phone_verified_at: new Date(), phone_verified: false }, (req.form.phone && { phone_temporary: req.form.phone })));
                yield user.sendSmsForPhoneVerification(confirmationCode);
                return res.success({
                    status: 200,
                    data: { message: 'Phone validation code sent successfully' }
                });
            }
            catch (error) {
                console.error('Error during phone validation send:', error);
                res.error({
                    status: 500,
                    errors: ['api.internal_error']
                });
            }
        });
    }
    /**
     * Confirm Phone Validation
     *
     * Confirms the user's phone number using the code sent via SMS.
     * This endpoint verifies the provided confirmation code, ensures that
     * the phone number is not already taken by another user, and finalizes
     * the phone number confirmation for the authenticated user.
     *
     * @route POST /users/me/phone/confirm
     * @access Private (requires authentication)
     * @param {Request} req - Request object containing form data and authenticated user
     * @param {string} req.form.token - Phone confirmation code from SMS
     * @param {Response} res - Response object
     *
     * @returns {Promise<any>} JSON response with success/error status
     *
     * @success {200} Phone number confirmed successfully
     * @error {400} Invalid code | Phone already confirmed | Phone already taken
     * @error {404} User not found
     * @error {500} Internal server error
     *
     * @example
     * Request Body:
     * {
     *   "token": "123456"
     * }
     *
     * Success Response:
     * {
     *   "status": 200,
     *   "data": {
     *     "message": "Phone number has been confirmed successfully"
     *   }
     * }
     *
     * Error Response (Invalid Token):
     * {
     *   "status": 400,
     *   "errors": ["api.phone.confirmation_token_invalid"]
     * }
     *
     * Error Response (Already Taken):
     * {
     *   "status": 400,
     *   "errors": ["api.phone.already_taken"]
     * }
     */
    confirmPhoneValidation(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { User } = getModels();
                const user = yield User.unscoped().findByPk(req.user.id);
                if (!user) {
                    return res.error({ status: 404, errors: ['api.user.not_found'] });
                }
                if (user.phone_verified) {
                    return res.error({ status: 400, errors: ['api.phone.already_confirmed'] });
                }
                if (!user.isConfirmationTokenValid(req.form.token, 'phone')) {
                    return res.error({ status: 400, errors: ['api.phone.confirmation_token_invalid'] });
                }
                // Check if another user already owns this phone
                const existing = yield User.unscoped().findOne({
                    where: {
                        phone: user.phone_temporary,
                        id: { [Op.ne]: user.id }
                    }
                });
                if (existing) {
                    return res.error({ status: 400, errors: ['api.phone.already_taken'] });
                }
                yield user.update({
                    phone: user.phone_temporary,
                    phone_verified: true,
                    phone_verified_at: new Date(),
                    phone_verification_token: null,
                    phone_temporary: null
                });
                yield user.reload();
                // Remove temp phones from others
                yield User.unscoped().update({ phone_temporary: null }, { where: { phone_temporary: user.phone } });
                return res.success({
                    status: 200,
                    data: { message: 'Phone number has been confirmed successfully' }
                });
            }
            catch (error) {
                console.error('Error during phone validation confirmation:', error);
                res.error({
                    status: 500,
                    errors: ['api.internal_error']
                });
            }
        });
    }
};
__decorate([
    Post('/users/me/phone/send'),
    ShouldValidateYupForm(PhoneValidationSendForm),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHUserLeafPhoneController.prototype, "sendPhoneValidation", null);
__decorate([
    Post('/users/me/phone/confirm'),
    ShouldBeAuthenticated(),
    ShouldValidateYupForm(PhoneValidationConfirmForm),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHUserLeafPhoneController.prototype, "confirmPhoneValidation", null);
ETHUserLeafPhoneController = __decorate([
    Controller()
], ETHUserLeafPhoneController);
export default ETHUserLeafPhoneController;
