import { Etherial } from 'etherial'

import { Request, Response } from 'etherial/components/http/provider'

import bodyParser from 'body-parser'
import cors from 'cors'
import methodOverride from 'method-override'

export default class App {
    beforeRun({ http }: Etherial) {
        http.app.use(cors())
        http.app.use(methodOverride())
        http.app.use(bodyParser.json())
    }

    run({ http, database, reactive, http_auth }: Etherial) {
        http_auth.setCustomAuthentificationChecker(({ user_id }) => {
            return User.findOne({
                where: {
                    id: user_id,
                },
            })
        })

        http.app.use((err: { name: string }, req: Request, res: Response, next: any) => {
            if (err.name === 'UnauthorizedError') {
                res.error({ status: 403, errors: [{ location: 'api', param: '0', value: '0', msg: 'api.errors.token.invalid' }] })
            } else {
                next()
            }
        })

        http.notFoundRoute((req, res) => {
            res.error({ status: 404, error: 'api.not_found' })
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
