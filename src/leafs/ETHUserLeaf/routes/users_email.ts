import etherial from 'etherial'

import { Controller, Post, Request, Response } from 'etherial/components/http/provider'

import { ShouldValidateYupForm } from 'etherial/components/http/yup.validator'

import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'
import { ShouldProtectBruteForce, ShouldUseLimiter } from 'etherial/components/http.security/provider'

import { UserLeafBase } from '../models/User.js'

import { EmailValidationSendForm, EmailValidationSendFormType, EmailValidationConfirmForm, EmailValidationConfirmFormType } from '../forms/user_form.js'

import * as crypto from 'crypto'

const getModels = () => {
    const models = etherial.database!.sequelize.models
    return {
        User: models.User as any,
    }
}

@Controller()
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
    @Post('/users/me/email/send')
    @ShouldBeAuthenticated()
    @ShouldUseLimiter({ windowMs: 60_000, max: 5 })
    @ShouldValidateYupForm(EmailValidationSendForm)
    public async sendEmailValidation(req: Request & { form: EmailValidationSendFormType; user: UserLeafBase }, res: Response): Promise<any> {

        try {
            const { User } = getModels()
            const user = await User.unscoped().findByPk(req.user.id)

            if (user && !user.email_confirmed) {
                // Check if an email validation was requested within the last minute
                const oneMinuteAgo = new Date(Date.now() - 60 * 1000)

                if (!user.email_confirmed_at || user.email_confirmed_at <= oneMinuteAgo) {
                    // 6-digit code for UX (kept) but stored hashed and capped by attempt counter.
                    const confirmationToken = crypto.randomInt(100000, 1000000).toString()
                    const confirmationTokenHash = User.hashToken(confirmationToken)

                    await user.update({
                        email_confirmation_token: confirmationTokenHash,
                        email_confirmation_expires_at: new Date(Date.now() + 15 * 60 * 1000),
                        email_confirmation_attempts: 0,
                        email_confirmed_at: new Date(), // last request time
                        email_confirmed: false,
                    })

                    await user.sendEmailForEmailVerification(confirmationToken)

                    res.success({
                        status: 200,
                        data: {
                            message: 'Email validation sent successfully',
                        },
                    })

                    user.insertAuditLog({
                        req: req,
                        status: 'Success',
                        action: 'USER_EMAIL_VALIDATION_SENT',
                        resource: 'user',
                    })
                } else {
                    res.error({
                        status: 429, // Too Many Requests
                        errors: ['api.email.validation_too_frequent'],
                    })
                }
            } else if (user && user.email_confirmed) {
                res.error({
                    status: 400,
                    errors: ['api.email.already_confirmed'],
                })
            } else {
                res.error({
                    status: 404,
                    errors: ['api.user.not_found'],
                })
            }
        } catch (error) {
            console.error('Error during email validation send:', error)
            res.error({
                status: 500,
                errors: ['api.internal_error'],
            })
        }
    }

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
    @Post('/users/me/email/confirm')
    @ShouldBeAuthenticated()
    @ShouldUseLimiter({ windowMs: 60_000, max: 10 })
    @ShouldProtectBruteForce({
        freeRetries: 5,
        minWait: 1_000,
        maxWait: 15 * 60_000,
        lifetime: 60 * 60,
        keyGenerator: (req: any) => `email_confirm:${req.user?.id || 'anon'}`
    })
    @ShouldValidateYupForm(EmailValidationConfirmForm)
    public async confirmEmailValidation(req: Request & { form: EmailValidationConfirmFormType; user: UserLeafBase }, res: Response): Promise<any> {
        try {
            const { User } = getModels()
            const user = await User.unscoped().findByPk(req.user.id)

            if (!user) {
                return res.error({ status: 404, errors: ['api.user.not_found'] })
            }

            if (user.email_confirmed) {
                return res.error({ status: 400, errors: ['api.email.already_confirmed'] })
            }

            if (user.isConfirmationTokenValid(req.form.token)) {
                await user.update({
                    email_confirmed: true,
                    email_confirmed_at: new Date(),
                    email_confirmation_token: null,
                    email_confirmation_expires_at: null,
                    email_confirmation_attempts: 0,
                })

                ;(req as any).resetBruteForce?.()

                res.success({
                    status: 200,
                    data: {
                        message: 'Email has been confirmed successfully',
                    },
                })

                user.insertAuditLog({
                    req: req,
                    status: 'Success',
                    action: 'USER_EMAIL_VALIDATION_CONFIRMED',
                    resource: 'user',
                })
            } else {
                // Increment the per-token attempt counter. Once it hits CONFIRMATION_MAX_ATTEMPTS,
                // isConfirmationTokenValid will refuse further checks even if the right code is guessed.
                await user.increment('email_confirmation_attempts')

                res.error({
                    status: 400,
                    errors: ['api.email.confirmation_token_invalid'],
                })
            }
        } catch (error) {
            console.error('Error during email validation confirmation:', error)
            res.error({
                status: 500,
                errors: ['api.internal_error'],
            })
        }
    }
}
