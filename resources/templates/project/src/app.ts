import { Etherial } from 'etherial'
import express from 'express'
import { Request, Response } from 'etherial/components/http/provider'
import { User } from './models/User'

export default class App {
    run({ http, database, reactive, http_auth }: Etherial) {
        // Capture the raw body BEFORE the JSON parser on routes that need byte-level
        // payload integrity (Stripe webhooks signature verification, etc.).
        // Without this, signature checks silently fail or — worse — re-serialized
        // JSON happens to match and forged events get accepted.
        http.app.use('/webhooks/stripe', express.raw({ type: 'application/json' }), (req, _res, next) => {
            ;(req as any).rawBody = req.body
            next()
        })

        http_auth.setAuthChecker(({ user_id }) => {
            return User.findOne({
                where: {
                    id: user_id,
                },
            })
        })

        http_auth.setRoleChecker((user: User, role: any) => {
            return true
        })

        http.app.use((err: { name: string }, req: Request, res: Response, next: any) => {
            if (err.name === 'UnauthorizedError') {
                res.error({ status: 403, errors: [{ location: 'api', param: '0', value: '0', msg: 'api.errors.token.invalid' }] })
            } else {
                next()
            }
        })

        http.notFoundRoute((req: Request, res: Response) => {
            res.error({ status: 404, errors: ['api.not_found'] })
        })

        return Promise.all([
            http.listen(),
            // reactive.listen(),
            database.sequelize.sync({
                alter: true,
            }),
        ])
    }

    commands() {
        return []
    }
}
