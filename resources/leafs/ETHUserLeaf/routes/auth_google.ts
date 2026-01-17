import etherial from 'etherial'

import { Controller, Post, Request, Response } from 'etherial/components/http/provider'

import { ShouldValidateYupForm } from 'etherial/components/http/yup.validator'

import { User } from '../../models/User'

import { AuthFormGoogle, AuthFormGoogleType } from '../forms/auth_form'

import axios from 'axios'

import { OAuth2Client } from "google-auth-library"


@Controller()
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
    @Post('/auth/google')
    @ShouldValidateYupForm(AuthFormGoogle)
    public async authGoogle(req: Request & { form: AuthFormGoogleType }, res: Response): Promise<any> {
        try {

            const client = new OAuth2Client(etherial.eth_user_leaf.google_client_id)

            const ticket = await client.verifyIdToken({
                idToken: req.form.google_token,
                audience: etherial.eth_user_leaf.google_client_id,
            })

            const payload = ticket.getPayload()

            if (!payload) {
                return res.error({
                    status: 400,
                    errors: ['api.errors.invalid_Google_access_token'],
                })
            }

            const { id: googleId, email, picture, given_name, family_name } = payload

            try {

                const user = await User.createOrFetchUserFromGoogle(
                    googleId,
                    given_name,
                    family_name,
                    email,
                    picture,
                )

                if (user) {
                    user.insertAuditLog({
                        req: req,
                        action: 'USER_LOGIN_GOOGLE',
                        status: 'Success',
                        resource: 'auth_google',
                    })

                    res.success({
                        status: 200,
                        data: {
                            token: etherial.http_auth.generateToken({
                                user_id: user.id,
                            }),
                        },
                    })
                } else {
                    return res.error({
                        status: 400,
                        errors: ['api.errors.invalid_Google_access_token'],
                    })
                }

            } catch (error) {
                console.error('Error during Google authentication:', error)
                return res.error({
                    status: 400,
                    errors: ['api.errors.invalid_Google_access_token'],
                })
            }


        } catch (err) {
            console.error('Error during Google authentication:', err)
            return res.error({
                status: 400,
                errors: ['api.errors.invalid_Google_access_token'],
            })
        }
    }
}
