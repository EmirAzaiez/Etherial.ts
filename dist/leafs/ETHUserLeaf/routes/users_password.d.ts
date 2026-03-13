import { Request, Response } from 'etherial/components/http/provider';
import { UserLeafBase } from '../models/User.js';
import { UpdatePasswordFormType, PasswordResetRequestFormType, PasswordResetConfirmFormType, CreatePasswordFormType } from '../forms/user_form.js';
export default class ETHUserLeafAuthController {
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
    setUserPassword(req: Request & {
        form: CreatePasswordFormType;
        user: UserLeafBase;
    }, res: Response): Promise<any>;
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
    userUpdatePassword(req: Request & {
        form: UpdatePasswordFormType;
        user: UserLeafBase;
    }, res: Response): Promise<any>;
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
    requestPasswordReset(req: Request & {
        form: PasswordResetRequestFormType;
    }, res: Response): Promise<any>;
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
    confirmPasswordReset(req: Request & {
        form: PasswordResetConfirmFormType;
    }, res: Response): Promise<any>;
}
