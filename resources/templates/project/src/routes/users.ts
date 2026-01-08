import { Controller, Get, Request, Response, OpenAPIResponseSchema } from 'etherial/components/http/provider'
import { User } from '../models/User'

@Controller()
export default class HomeController {

    @Get('/')
    index(req: Request, res: Response) {
        res.success({
            status: 200,
            data: 'Welcome to your Etherial API!',
        })
    }

    @Get('/users')
    @OpenAPIResponseSchema(User, { isArray: true })
    users(req, res) {
        return User.findAll()
    }

    @Get('/users/me')
    @OpenAPIResponseSchema(User)
    getMe(req, res) {
        return User.findByPk(1)
    }

    @Get('/stats')
    @OpenAPIResponseSchema({
        totalUsers: { type: 'number' },
        activeToday: { type: 'number' },
        serverTime: { type: 'string', format: 'date-time' }
    })
    getStats(req, res) {
        res.success({
            status: 200,
            data: { totalUsers: 100, activeToday: 25, serverTime: new Date() }
        })
    }

}
