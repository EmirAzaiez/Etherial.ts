import etherial from 'etherial'

import { Controller, Post, Request, Response } from 'etherial/components/http/provider'

import { ShouldValidateYupForm } from 'etherial/components/http/yup.validator'

import {
    ShouldProtectBruteForce,
    ShouldUseLimiter
} from 'etherial/components/http.security/provider'

import { AuthFormEmail, AuthFormEmailType, AuthFormUsername, AuthFormUsernameType } from '../forms/auth_form.js'

import * as bcrypt from 'bcrypt'

const getModels = () => {
    const models = etherial.database!.sequelize.models
    return {
        User: models.User as any,
    }
}

@Controller()
export default class ETHUserLeafAuthController {
    @Post('/auth/email')
    @ShouldUseLimiter({ windowMs: 60_000, max: 10 })
    @ShouldProtectBruteForce({
        freeRetries: 5,
        minWait: 1_000,
        maxWait: 15 * 60_000,
        lifetime: 60 * 60,
        keyGenerator: (req: any) => {
            const email = req.body?.email?.toString().toLowerCase() || 'unknown'
            return `email:${email}`
        }
    })
    @ShouldValidateYupForm(AuthFormEmail)
    public async authEmail(req: Request & { form: AuthFormEmailType }, res: Response): Promise<any> {
        const { User } = getModels()
        const user = await User.unscoped().findOne({
            where: {
                email: req.form.email.toLowerCase()
            }
        })

        // Constant-ish work either way: dummy compare to avoid user-enumeration timing.
        const passwordOk = user && user.password
            ? await bcrypt.compare(req.form.password, user.password)
            : await bcrypt.compare(req.form.password, '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid.')

        if (user && passwordOk) {
            (req as any).resetBruteForce?.()

            res.success({
                status: 200,
                data: {
                    token: etherial.http_auth.generateToken({
                        user_id: user.id,
                        tv: user.token_version,
                        device: req.form.device
                    })
                }
            })

            user.insertAuditLog({
                req: req,
                action: 'USER_LOGIN_EMAIL',
                status: 'Success',
                resource: 'auth',
                metadata: {
                    device: req.form.device
                }
            })
        } else {
            res.error({
                status: 400,
                errors: ['api.form.errors.invalid_login']
            })
        }
    }

    @Post('/auth/username')
    @ShouldUseLimiter({ windowMs: 60_000, max: 10 })
    @ShouldProtectBruteForce({
        freeRetries: 5,
        minWait: 1_000,
        maxWait: 15 * 60_000,
        lifetime: 60 * 60,
        keyGenerator: (req: any) => {
            const username = req.body?.username?.toString().toLowerCase() || 'unknown'
            return `username:${username}`
        }
    })
    @ShouldValidateYupForm(AuthFormUsername)
    public async authUsername(req: Request & { form: AuthFormUsernameType }, res: Response): Promise<any> {
        const { User } = getModels()
        const user = await User.unscoped().findOne({
            where: {
                username: req.form.username
            }
        })

        const passwordOk = user && user.password
            ? await bcrypt.compare(req.form.password, user.password)
            : await bcrypt.compare(req.form.password, '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid.')

        if (user && passwordOk) {
            (req as any).resetBruteForce?.()

            res.success({
                status: 200,
                data: {
                    token: etherial.http_auth.generateToken({
                        user_id: user.id,
                        tv: user.token_version,
                        device: req.form.device
                    })
                }
            })

            user.insertAuditLog({
                req: req,
                action: 'USER_LOGIN_USERNAME',
                status: 'Success',
                resource: 'auth',
                metadata: {
                    device: req.form.device
                }
            })
        } else {
            res.error({
                status: 400,
                errors: ['api.form.errors.invalid_login']
            })
        }
    }
}
