import etherial from 'etherial'
import { Router, Request, Response } from 'express'
import {
    Controller,
    Get
} from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'

const getAdminLeaf = () => (etherial as any).eth_admin_leaf

@Controller()
export default class AuthController {
    /**
     * Check if the authenticated user has access to the admin panel
     * Returns { hasAccess: boolean }
     */
    @Get('/admin/auth/check')
    @ShouldBeAuthenticated()
    async checkAdminAuthAccess(req: Request & { user: any }, res: Response): Promise<any> {
        const adminLeaf = getAdminLeaf()

        if (!adminLeaf) {
            return (res as any).error?.({ status: 500, errors: ['admin_leaf_not_configured'] })
        }

        try {
            const hasAccess = await adminLeaf.canAccessAdmin(req.user)

            return (res as any).success?.({
                status: 200,
                data: {
                    has_access: hasAccess
                }
            })
        } catch (err: any) {
            return (res as any).error?.({ status: 500, errors: [err.message] })
        }
    }
}

export const AvailableRouteMethods = ['checkAdminAuthAccess'] as const
