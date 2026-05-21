import etherial from 'etherial'

import { Controller, Post, Request, Response } from 'etherial/components/http/provider'
import { ShouldValidateYupForm } from 'etherial/components/http/yup.validator'
import { ShouldProtectBruteForce, ShouldUseLimiter } from 'etherial/components/http.security/provider'

import { AuthFormApple, AuthFormAppleType } from '../forms/auth_form.js'
import { verifyAppleIdentityToken } from '../utils/apple_token_verifier.js'

const getModels = () => {
    const models = etherial.database!.sequelize.models
    return {
        User: models.User as any,
    }
}

@Controller()
export default class ETHUserLeafAuthAppleController {
    /**
     * Apple Sign-In.
     *
     * The identity token from Apple is REQUIRED to be cryptographically verified
     * against Apple's JWKS — signature, issuer, audience and expiration are all
     * enforced. Email is treated as a hint, never as proof of identity: account
     * linking is done strictly on the verified `sub` claim. An attacker who can
     * forge a JWT with the right email therefore cannot take over another user.
     *
     * @route POST /auth/apple
     */
    @Post('/auth/apple')
    @ShouldUseLimiter({ windowMs: 60_000, max: 10 })
    @ShouldProtectBruteForce({
        freeRetries: 10,
        minWait: 1_000,
        maxWait: 15 * 60_000,
        lifetime: 60 * 60,
    })
    @ShouldValidateYupForm(AuthFormApple)
    public async authApple(req: Request & { form: AuthFormAppleType }, res: Response): Promise<any> {
        try {
            const { User } = getModels()
            const appleConfig = (etherial as any).eth_user_leaf?.config?.apple

            if (!appleConfig || !appleConfig.audience) {
                console.error(
                    '[auth/apple] Refusing to verify Apple token: ETHUserLeafConfig.apple.audience is not set. ' +
                    'Configure your Service ID / bundle identifier to enable Sign in with Apple.'
                )
                return res.error({
                    status: 500,
                    errors: ['api.apple.not_configured']
                })
            }

            let payload
            try {
                payload = await verifyAppleIdentityToken(req.form.apple_token, {
                    audience: appleConfig.audience,
                })
            } catch (verifyErr: any) {
                console.warn('[auth/apple] Identity token rejected:', verifyErr.message)
                return res.error({
                    status: 401,
                    errors: ['api.apple.invalid_token']
                })
            }

            const appleId = payload.sub
            const verifiedEmail = payload.email
            const emailIsVerified =
                payload.email_verified === true || payload.email_verified === 'true'

            // 1. Match on verified Apple sub — the only trustworthy identifier.
            let user = await User.findOne({ where: { apple_id: appleId } })

            if (!user) {
                // 2. Optional email-based linking: only if Apple itself says the email
                //    is verified AND that local account has NOT confirmed its email
                //    yet (so we're not silently grafting Apple onto a confirmed,
                //    independently-owned account based on a hint claim).
                if (verifiedEmail && emailIsVerified) {
                    const existingEmailUser = await User.findOne({
                        where: { email: verifiedEmail },
                        attributes: { include: ['email_confirmed'] }
                    })

                    if (existingEmailUser) {
                        if (!existingEmailUser.email_confirmed) {
                            user = await existingEmailUser.update({
                                apple_id: appleId,
                                should_set_password: true,
                                password: null,
                                email_confirmed: true,
                                email_confirmed_at: new Date()
                            })
                        } else {
                            // Account exists with a confirmed email but no Apple link.
                            // Refuse to silently bind — the legitimate owner should sign in
                            // with their password and link Apple from their settings page.
                            return res.error({
                                status: 409,
                                errors: ['api.apple.email_already_in_use']
                            })
                        }
                    } else {
                        user = await User.create({
                            apple_id: appleId,
                            email: verifiedEmail,
                            firstname: req.form.firstname || '',
                            lastname: req.form.lastname || '',
                            should_set_password: true,
                            email_confirmed: true,
                            email_confirmed_at: new Date()
                        })
                    }
                } else {
                    // No verified email and no existing Apple link — we have nothing
                    // safe to bind on. Apple omits email on subsequent sign-ins, so
                    // the client must surface this on first sign-in.
                    return res.error({
                        status: 400,
                        errors: ['api.errors.email.required']
                    })
                }
            }

            ;(req as any).resetBruteForce?.()

            res.success({
                status: 200,
                data: {
                    token: etherial.http_auth.generateToken({
                        user_id: user.id,
                        tv: user.token_version
                    })
                }
            })

            user.insertAuditLog({
                req: req,
                action: 'USER_LOGIN_APPLE',
                status: 'Success',
                resource: 'auth_apple'
            })
        } catch (err) {
            console.error('Error during Apple authentication:', err)
            res.error({
                status: 500,
                errors: ['api.internal_error']
            })
        }
    }
}
