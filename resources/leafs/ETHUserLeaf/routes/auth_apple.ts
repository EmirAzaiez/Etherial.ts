import etherial from 'etherial'

import { Controller, Post, Get, Request, Response } from 'etherial/components/http/provider'
import { ShouldValidateYupForm } from 'etherial/components/http/yup.validator'

import * as jwt from 'jsonwebtoken'

import { AuthFormApple, AuthFormAppleType } from '../forms/auth_form'
import { User } from '../../models/User'

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
            const decoded: any = jwt.decode(req.form.apple_token)

            if (decoded && decoded.sub) {
                const appleId = decoded.sub
                const email = decoded.email

                // Check if user already exists with this Apple ID
                let user = await User.findOne({ where: { apple_id: appleId } })

                if (!user) {
                    // Check if email already exists
                    const existingEmailUser = await User.findOne({ where: { email }, attributes: { include: ['email_confirmed'] } })

                    if (!existingEmailUser) {
                        if (email) {
                            // Create new user when no Apple ID or email match
                            user = await User.create({
                                apple_id: appleId,
                                email: email,
                                firstname: req.form.firstname || 'Emir',
                                lastname: req.form.lastname || 'Etherial',
                                should_set_password: true,
                                email_confirmed: !!email,
                                email_confirmed_at: email ? new Date() : null,
                            })
                        } else {
                            return res.error({
                                status: 400,
                                errors: ['api.errors.email.required'],
                            })
                        }
                    } else {
                        if (!existingEmailUser.email_confirmed) {
                            // email exists but not confirmed → confirm it & link Apple ID
                            user = await existingEmailUser.update({
                                apple_id: appleId,
                                should_set_password: true,
                                password: null,
                                email_confirmed: true,
                                email_confirmed_at: new Date(),
                            })
                        } else {
                            // email exists and already confirmed → just link Apple ID
                            user = await existingEmailUser.update({
                                apple_id: appleId,
                            })
                        }
                    }
                }

                // generate token
                res.success({
                    status: 200,
                    data: {
                        token: etherial.http_auth.generateToken({
                            user_id: user.id,
                        }),
                    },
                })

                user.insertAuditLog({
                    req: req,
                    action: 'USER_LOGIN_APPLE',
                    status: 'Success',
                    resource: 'auth_apple',
                })
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
