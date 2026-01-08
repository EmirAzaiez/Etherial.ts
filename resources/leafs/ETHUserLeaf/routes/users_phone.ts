import { Controller, Post, Request, Response } from 'etherial/components/http/provider'
import { ShouldValidateYupForm } from 'etherial/components/http/yup.validator'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'
import { User } from '../../models/User'
import { PhoneValidationConfirmForm, PhoneValidationConfirmFormType, PhoneValidationSendForm, PhoneValidationSendFormType } from '../forms/user_phone_form'
import * as crypto from 'crypto'
import { Op } from 'sequelize'

@Controller()
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
    @Post('/users/me/phone/send')
    @ShouldValidateYupForm(PhoneValidationSendForm)
    @ShouldBeAuthenticated()
    public async sendPhoneValidation(req: Request & { form: PhoneValidationSendFormType; user: User }, res: Response): Promise<any> {
        try {
            const user = await User.unscoped().findByPk(req.user.id)
            if (user && !user.phone_verified) {
                if (user.phone_temporary || req.form.phone) {
                    const existing = await User.unscoped().findOne({
                        where: {
                            [Op.or]: [{ phone: user.phone_temporary }, ...(req.form.phone ? [{ phone: req.form.phone }] : [])],
                            id: { [Op.ne]: user.id },
                        },
                    })

                    if (!existing) {
                        // Check if a phone validation was requested within the last minute
                        const oneMinuteAgo = new Date(Date.now() - 60 * 1000)

                        if (!user.phone || user.phone_verified_at <= oneMinuteAgo) {
                            // Generate secure random code
                            const confirmationCode = crypto.randomInt(100000, 1000000).toString()

                            await user.update({
                                phone_verification_token: confirmationCode,
                                phone_verified_at: new Date(), // We use this field to track last request time
                                phone_verified: false, // Ensure it stays false
                                ...(req.form.phone && { phone_temporary: req.form.phone }),
                            })

                            // Send code via SMS
                            await user.sendSmsForPhoneVerification(confirmationCode)

                            res.success({
                                status: 200,
                                data: {
                                    message: 'Phone validation code sent successfully',
                                },
                            })
                        } else {
                            res.error({
                                status: 429, // Too Many Requests
                                errors: ['api.phone.validation_too_frequent'],
                            })
                        }
                    } else {
                        return res.error({
                            status: 400,
                            errors: ['api.phone.already_taken'],
                        })
                    }
                } else {
                    return res.error({
                        status: 400,
                        errors: ['api.phone.already_taken'],
                    })
                }
            } else if (user && user.phone_verified) {
                res.error({
                    status: 400,
                    errors: ['api.phone.already_confirmed'],
                })
            } else {
                res.error({
                    status: 404,
                    errors: ['api.user.not_found'],
                })
            }
        } catch (error) {
            console.error('Error during phone validation send:', error)
            res.error({
                status: 500,
                errors: ['api.internal_error'],
            })
        }
    }

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
    @Post('/users/me/phone/confirm')
    @ShouldBeAuthenticated()
    @ShouldValidateYupForm(PhoneValidationConfirmForm)
    public async confirmPhoneValidation(req: Request & { form: PhoneValidationConfirmFormType; user: User }, res: Response): Promise<any> {
        try {
            const user = await User.unscoped().findByPk(req.user.id)

            if (user && !user.phone_verified && user.isConfirmationTokenValid(req.form.token)) {
                // Check if another user already owns this phone
                const existing = await User.unscoped().findOne({
                    where: {
                        phone: user.phone_temporary,
                        id: { [Op.ne]: user.id },
                    },
                })

                if (!existing) {
                    // Confirm phone and clear token
                    await user.update({
                        phone: user.phone_temporary,
                        phone_verified: true,
                        phone_verified_at: new Date(),
                        phone_verification_token: null,
                        phone_temporary: null,
                    })

                    // Reload the user
                    await user.reload()

                    // Remove temp phones from others
                    await User.unscoped().update({ phone_temporary: null }, { where: { phone_temporary: user.phone } })

                    res.success({
                        status: 200,
                        data: {
                            message: 'Phone number has been confirmed successfully',
                        },
                    })
                } else {
                    return res.error({
                        status: 400,
                        errors: ['api.phone.already_taken'],
                    })
                }
            } else if (!user) {
                res.error({
                    status: 404,
                    errors: ['api.user.not_found'],
                })
            } else if (user.phone_verified) {
                res.error({
                    status: 400,
                    errors: ['api.phone.already_confirmed'],
                })
            } else {
                res.error({
                    status: 400,
                    errors: ['api.phone.confirmation_token_invalid'],
                })
            }
        } catch (error) {
            console.error('Error during phone validation confirmation:', error)
            res.error({
                status: 500,
                errors: ['api.internal_error'],
            })
        }
    }
}
