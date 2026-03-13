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
import { Controller, Post, Put } from 'etherial/components/http/provider';
import { ShouldValidateYupForm } from 'etherial/components/http/yup.validator';
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
import { UpdatePasswordForm, PasswordResetRequestForm, PasswordResetConfirmForm, CreatePasswordForm, } from '../forms/user_form.js';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
const getModels = () => {
    const models = etherial.database.sequelize.models;
    return {
        User: models.User,
    };
};
let ETHUserLeafAuthController = class ETHUserLeafAuthController {
    /**
     * Définit le mot de passe d'un utilisateur
     *
     * Cette méthode permet à un utilisateur authentifié de définir son mot de passe.
     * Elle est principalement utilisée pour les utilisateurs qui se sont connectés via Google ou Apple
     * et qui n'ont pas encore défini de mot de passe local.
     *
     * **Point important** : Le champ `should_set_password` est défini à `true` uniquement lorsque
     * l'utilisateur se connecte via les providers externes (Google/Apple). Cela indique que
     * l'utilisateur doit définir un mot de passe local pour pouvoir se connecter directement
     * avec email/mot de passe par la suite.
     *
     * Fonctionnement :
     * 1. Vérifie que l'utilisateur existe
     * 2. Contrôle si l'utilisateur doit définir un mot de passe (should_set_password === true)
     * 3. Hash le nouveau mot de passe avec bcrypt
     * 4. Met à jour l'utilisateur avec :
     *    - Le mot de passe hashé
     *    - credentials_expired à false
     *    - credentials_expire_at à 90 jours à partir de maintenant
     *
     * @route POST /users/me/password
     * @middleware ShouldBeAuthenticated - Vérifie que l'utilisateur est authentifié
     * @middleware ShouldValidateYupForm - Valide le formulaire avec CreatePasswordForm
     * @param req.form.password - Le nouveau mot de passe à définir
     * @param req.user - L'utilisateur authentifié
     *
     * @returns 200 - Mot de passe défini avec succès
     * @returns 400 - Le mot de passe est déjà défini (should_set_password === false)
     * @returns 404 - Utilisateur non trouvé
     * @returns 500 - Erreur interne du serveur
     */
    setUserPassword(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { User } = getModels();
                const user = yield User.unscoped().findByPk(req.user.id);
                if (user) {
                    if (user.should_set_password) {
                        const hashedNewPassword = yield bcrypt.hash(req.form.password, 10);
                        yield user.update({
                            password: hashedNewPassword,
                            should_set_password: false,
                            credentials_expired: false,
                            credentials_expire_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                        });
                        yield user.sendEmailForPasswordNotification('configuration');
                        yield user.insertAuditLog({
                            req: req,
                            action: 'USER_PASSWORD_SET',
                            status: 'Success',
                            resource: 'user',
                        });
                        res.success({
                            status: 200,
                            data: {},
                        });
                    }
                    else {
                        res.error({
                            status: 400,
                            errors: ['api.password.already_set'],
                        });
                    }
                }
                else {
                    res.error({
                        status: 404,
                        errors: ['api.user.not_found'],
                    });
                }
            }
            catch (error) {
                console.error('Erreur lors de la mise en place du mot de passe:', error);
                res.error({
                    status: 500,
                    errors: ['api.internal_error'],
                });
            }
        });
    }
    /**
     * Update User Password
     *
     * Updates the authenticated user's password after validating the current password.
     * This endpoint provides secure password change functionality with the following features:
     *
     * @route PUT /users/me/password
     * @access Private (requires authentication)
     * @param {Request} req - Request object containing form data and authenticated user
     * @param {string} req.form.current_password - User's current password for verification
     * @param {string} req.form.new_password - New password to set
     * @param {Response} res - Response object
     *
     * @returns {Promise<any>} JSON response with success/error status
     *
     * @success {200} Password updated successfully
     * @error {400} Current password incorrect | New password same as current
     * @error {404} User not found
     * @error {500} Internal server error
     *
     * @example
     * Request Body:
     * {
     *   "current_password": "oldPassword123",
     *   "new_password": "newSecurePassword456"
     * }
     *
     * Success Response:
     * {
     *   "status": 200,
     *   "data": {}
     * }
     *
     * Error Response:
     * {
     *   "status": 400,
     *   "errors": ["api.password.current_incorrect"]
     * }
     */
    userUpdatePassword(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { User } = getModels();
                const user = yield User.unscoped().findByPk(req.user.id);
                if (user) {
                    const isCurrentPasswordValid = yield bcrypt.compare(req.form.current_password, user.password);
                    if (isCurrentPasswordValid) {
                        const isSamePassword = yield bcrypt.compare(req.form.new_password, user.password);
                        if (!isSamePassword) {
                            const hashedNewPassword = yield bcrypt.hash(req.form.new_password, 10);
                            yield user.update({
                                password: hashedNewPassword,
                                credentials_expired: false,
                                credentials_expire_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                            });
                            yield user.sendEmailForPasswordNotification('update');
                            yield user.insertAuditLog({
                                req: req,
                                action: 'USER_PASSWORD_UPDATED',
                                status: 'Success',
                                resource: 'user',
                            });
                            res.success({
                                status: 200,
                                data: {},
                            });
                        }
                        else {
                            res.error({
                                status: 400,
                                errors: ['api.password.same_as_current'],
                            });
                        }
                    }
                    else {
                        res.error({
                            status: 400,
                            errors: ['api.password.current_incorrect'],
                        });
                    }
                }
                else {
                    res.error({
                        status: 404,
                        errors: ['api.user.not_found'],
                    });
                }
            }
            catch (error) {
                console.error('Erreur lors de la mise à jour du mot de passe:', error);
                res.error({
                    status: 500,
                    errors: ['api.internal_error'],
                });
            }
        });
    }
    /**
     * Request Password Reset
     *
     * Initiates a password reset process by sending a reset token via email.
     * This endpoint allows users to request a password reset when they've forgotten their password.
     *
     * @route POST /users/password/reset/request
     * @access Public
     * @param {Request} req - Request object containing form data
     * @param {string} req.form.email - Email address to send reset link to
     * @param {Response} res - Response object
     *
     * @returns {Promise<any>} JSON response with success status
     *
     * @success {200} Reset email sent (or would be sent if email exists)
     * @error {429} Too many requests - reset already requested within last minute
     * @error {500} Internal server error
     *
     * @example
     * Request Body:
     * {
     *   "email": "user@example.com"
     * }
     *
     * Success Response:
     * {
     *   "status": 200,
     *   "data": {
     *     "message": "If this email exists, a password reset link has been sent"
     *   }
     * }
     *
     * Rate Limit Error Response:
     * {
     *   "status": 429,
     *   "errors": ["api.password.reset_too_frequent"]
     * }
     */
    requestPasswordReset(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { User } = getModels();
                const user = yield User.unscoped().findOne({
                    where: { email: req.form.email },
                });
                if (user) {
                    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
                    if (!user.password_reset_requested_at || user.password_reset_requested_at <= oneMinuteAgo) {
                        // Generate secure random token
                        const resetToken = crypto.randomInt(100000, 1000000).toString();
                        // Set expiration to 1 hour from now
                        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
                        yield user.update({
                            password_reset_token: resetToken,
                            password_reset_requested_at: new Date(),
                            password_reset_expires_at: expiresAt,
                        });
                        user.insertAuditLog({
                            req: req,
                            action: 'USER_PASSWORD_RESET_REQUESTED',
                            status: 'Success',
                            resource: 'auth',
                        });
                        yield user.sendEmailForPasswordReset(resetToken);
                    }
                    else {
                        res.error({
                            status: 429,
                            errors: ['api.password.reset_too_frequent'],
                        });
                        return;
                    }
                }
                res.success({
                    status: 200,
                    data: {
                        message: 'If this email exists, a password reset link has been sent',
                    },
                });
            }
            catch (error) {
                console.error('Error during password reset request:', error);
                res.error({
                    status: 500,
                    errors: ['api.internal_error'],
                });
            }
        });
    }
    /**
     * Confirm Password Reset
     *
     * Completes the password reset process using the token sent via email.
     * This endpoint allows users to set a new password using their reset token.
     *
     *
     * @route POST /users/password/reset/confirm
     * @access Public
     * @param {Request} req - Request object containing form data
     * @param {string} req.form.email - Email address of the user
     * @param {string} req.form.token - Password reset token from email
     * @param {string} req.form.new_password - New password to set
     * @param {Response} res - Response object
     *
     * @returns {Promise<any>} JSON response with success/error status
     *
     * @success {200} Password reset successfully
     * @error {400} Invalid or expired token
     * @error {404} User not found
     * @error {500} Internal server error
     *
     * @example
     * Request Body:
     * {
     *   "email": "user@example.com",
     *   "token": "abc123def456...",
     *   "new_password": "newSecurePassword123"
     * }
     *
     * Success Response:
     * {
     *   "status": 200,
     *   "data": {
     *     "message": "Password has been reset successfully"
     *   }
     * }
     *
     * Error Response:
     * {
     *   "status": 400,
     *   "errors": ["api.password.reset_token_invalid"]
     * }
     */
    confirmPasswordReset(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { User } = getModels();
                const user = yield User.unscoped().findOne({
                    where: { email: req.form.email },
                });
                if (user && user.isPasswordResetTokenValid(req.form.token)) {
                    const hashedNewPassword = yield bcrypt.hash(req.form.new_password, 10);
                    yield user.update({
                        password: hashedNewPassword,
                        password_reset_token: null,
                        password_reset_requested_at: null,
                        password_reset_expires_at: null,
                        credentials_expired: false,
                        credentials_expire_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                    });
                    user.insertAuditLog({
                        req: req,
                        action: 'USER_PASSWORD_RESET_CONFIRMED',
                        status: 'Success',
                        resource: 'user',
                    });
                    res.success({
                        status: 200,
                        data: {
                            message: 'Password has been reset successfully',
                        },
                    });
                }
                else if (!user) {
                    res.error({
                        status: 404,
                        errors: ['api.user.not_found'],
                    });
                }
                else {
                    res.error({
                        status: 400,
                        errors: ['api.password.reset_token_invalid'],
                    });
                }
            }
            catch (error) {
                console.error('Error during password reset confirmation:', error);
                res.error({
                    status: 500,
                    errors: ['api.internal_error'],
                });
            }
        });
    }
};
__decorate([
    Post('/users/me/password'),
    ShouldBeAuthenticated(),
    ShouldValidateYupForm(CreatePasswordForm),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHUserLeafAuthController.prototype, "setUserPassword", null);
__decorate([
    Put('/users/me/password'),
    ShouldBeAuthenticated(),
    ShouldValidateYupForm(UpdatePasswordForm),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHUserLeafAuthController.prototype, "userUpdatePassword", null);
__decorate([
    Post('/users/password/reset/request'),
    ShouldValidateYupForm(PasswordResetRequestForm),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHUserLeafAuthController.prototype, "requestPasswordReset", null);
__decorate([
    Post('/users/password/reset/confirm'),
    ShouldValidateYupForm(PasswordResetConfirmForm),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHUserLeafAuthController.prototype, "confirmPasswordReset", null);
ETHUserLeafAuthController = __decorate([
    Controller()
], ETHUserLeafAuthController);
export default ETHUserLeafAuthController;
