import { Request, Response } from 'etherial/components/http/provider';
import { UserLeafBase } from '../models/User.js';
import { EmailValidationSendFormType, EmailValidationConfirmFormType } from '../forms/user_form.js';
export default class ETHUserLeafEmailController {
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
    sendEmailValidation(req: Request & {
        form: EmailValidationSendFormType;
        user: UserLeafBase;
    }, res: Response): Promise<any>;
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
    confirmEmailValidation(req: Request & {
        form: EmailValidationConfirmFormType;
        user: UserLeafBase;
    }, res: Response): Promise<any>;
}
