import { Request, Response } from 'etherial/components/http/provider';
import { AuthFormGoogleType } from '../forms/auth_form.js';
export default class ETHUserLeafAuthGoogleController {
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
    authGoogle(req: Request & {
        form: AuthFormGoogleType;
    }, res: Response): Promise<any>;
}
