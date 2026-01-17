import etherial from 'etherial'
import { Controller, Post, Request, Response } from 'etherial/components/http/provider'

/**
 * Admin Authentication Controller
 */
@Controller()
export default class ETHAdminAuthController {
    /**
     * POST /admin/auth
     * Admin login
     */
    @Post('/admin/auth')
    async login(req: Request, res: Response): Promise<any> {
        const { email, password } = req.body

        if (!email || !password) {
            return res.error?.({
                status: 400,
                errors: ['email_and_password_required']
            })
        }

        if (!etherial.http_auth) {
            return res.error?.({
                status: 500,
                errors: ['http_auth_not_configured']
            })
        }

        // Generate token
        const token = etherial.http_auth.generateToken({
            email,
            isAdmin: true
        })

        return res.success?.({
            status: 200,
            data: { token }
        })
    }
}

export const AvailableRouteMethods = ['login'] as const
