import etherial from 'etherial'

import { Controller, Post, Get, Request, Response } from 'etherial/components/http/provider'

import { ShouldValidateYupForm } from 'etherial/components/http/yup.validator'

import { User } from '../../models/User'

import { AuthFormEmail, AuthFormEmailType, AuthFormUsername, AuthFormUsernameType } from '../forms/auth_form'

import * as bcrypt from 'bcrypt'

@Controller()
export default class ETHUserLeafAuthController {
    @Post('/auth/email')
    @ShouldValidateYupForm(AuthFormEmail)
    public async authEmail(req: Request & { form: AuthFormEmailType }, res: Response): Promise<any> {
        let user = await User.unscoped().findOne({
            where: {
                email: req.form.email.toLowerCase(),
            },
        })

        if (user) {
            if (bcrypt.compareSync(req.form.password, user.password)) {
                res.success({
                    status: 200,
                    data: {
                        token: etherial.http_auth.generateToken({
                            user_id: user.id,
                            device: req.form.device,
                        }),
                    },
                })

                user.insertAuditLog({
                    req: req,
                    action: 'USER_LOGIN_EMAIL',
                    status: 'Success',
                    resource: 'auth',
                    metadata: {
                        device: req.form.device,
                    },
                })
            } else {
                res.error({
                    status: 400,
                    errors: ['api.form.errors.invalid_login'],
                })
            }
        } else {
            res.error({
                status: 400,
                errors: ['api.form.errors.invalid_login'],
            })
        }
    }

    @Post('/auth/username')
    @ShouldValidateYupForm(AuthFormUsername)
    public async authUsername(req: Request & { form: AuthFormUsernameType }, res: Response): Promise<any> {
        let user = await User.unscoped().findOne({
            where: {
                username: req.form.username,
            },
        })

        if (user) {
            if (bcrypt.compareSync(req.form.password, user.password)) {
                res.success({
                    status: 200,
                    data: {
                        token: etherial.http_auth.generateToken({
                            user_id: user.id,
                            device: req.form.device,
                        }),
                    },
                })

                user.insertAuditLog({
                    req: req,
                    action: 'USER_LOGIN_USERNAME',
                    status: 'Success',
                    resource: 'auth',
                    metadata: {
                        device: req.form.device,
                    },
                })
            } else {
                res.error({
                    status: 400,
                    errors: ['api.form.errors.invalid_login'],
                })
            }
        } else {
            res.error({
                status: 400,
                errors: ['api.form.errors.invalid_login'],
            })
        }
    }
}
