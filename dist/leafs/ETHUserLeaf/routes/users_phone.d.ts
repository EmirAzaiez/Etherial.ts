import { Request, Response } from 'etherial/components/http/provider';
import { UserLeafBase } from '../models/User.js';
import { PhoneValidationConfirmFormType, PhoneValidationSendFormType } from '../forms/user_phone_form.js';
export default class ETHUserLeafPhoneController {
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
    sendPhoneValidation(req: Request & {
        form: PhoneValidationSendFormType;
        user: UserLeafBase;
    }, res: Response): Promise<any>;
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
    confirmPhoneValidation(req: Request & {
        form: PhoneValidationConfirmFormType;
        user: UserLeafBase;
    }, res: Response): Promise<any>;
}
