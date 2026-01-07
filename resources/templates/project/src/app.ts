import { Etherial } from 'etherial'
import { Request, Response } from 'etherial/components/http/provider'
import { User } from './models/User'

export default class App {
    run({ http, database, reactive, http_auth }: Etherial) {
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
