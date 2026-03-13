import { Request, Response } from 'etherial/components/http/provider';
import { AuthFormAppleType } from '../forms/auth_form.js';
export default class ETHUserLeafAuthAppleController {
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
    authApple(req: Request & {
        form: AuthFormAppleType;
    }, res: Response): Promise<any>;
}
