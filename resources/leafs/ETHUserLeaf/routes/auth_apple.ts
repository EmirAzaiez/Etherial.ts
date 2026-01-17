import etherial from 'etherial'

import { Controller, Post, Get, Request, Response } from 'etherial/components/http/provider'
import { ShouldValidateYupForm } from 'etherial/components/http/yup.validator'

import * as jwt from 'jsonwebtoken'

import { AuthFormApple, AuthFormAppleType } from '../forms/auth_form'
import { User } from '../../models/User'

import appleSignin from "apple-signin-auth"

@Controller()
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

    @Post('/auth/apple')
    @ShouldValidateYupForm(AuthFormApple)
    public async authApple(req: Request & { form: AuthFormAppleType }, res: Response): Promise<any> {
        try {

            const decoded = await appleSignin.verifyIdToken(
                req.form.apple_token,
                {
                    audience: etherial.eth_user_leaf.apple_client_id,
                    ignoreExpiration: false,
                }
            )

            if (decoded && decoded.sub) {
                const appleId = decoded.sub
                const email = decoded.email

                const user = await User.createOrFetchUserFromApple(
                    appleId,
                    req.form.firstname,
                    req.form.lastname,
                    email,
                )

                if (user) {
                    user.insertAuditLog({
                        req: req,
                        action: 'USER_LOGIN_APPLE',
                        status: 'Success',
                        resource: 'auth_apple',
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
                        errors: ['api.errors.invalid_apple_token'],
                    })
                }

            } else if (!decoded || !decoded.sub) {
                res.error({
                    status: 400,
                    errors: ['api.apple.invalid_token'],
                })
            }
        } catch (err) {
            console.error('Error during Apple authentication:', err)
            res.error({
                status: 500,
                errors: ['api.internal_error'],
            })
        }
    }
}
