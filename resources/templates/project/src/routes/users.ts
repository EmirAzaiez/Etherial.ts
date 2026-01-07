import { Controller, Get, Request, Response } from 'etherial/components/http/provider'
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
    users(req, res) {
        return User.findAll()
    }

}
