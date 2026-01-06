import { Controller, Get } from 'etherial/components/http'

@Controller()
export class HomeController {
    @Get('/')
    index() {
        return {
            message: 'Welcome to your Etherial API!',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
        }
    }

}
