import etherial from 'etherial'
// Request/Response are type-only — `import type` so tsc doesn't emit a runtime
// `import { Response } from 'express'` (fails under Node ESM: express is CJS,
// no runtime Response export). emitDecoratorMetadata falls back to Object.
import type { Request, Response } from 'express'
import {
    Controller,
    Post,
} from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'

const getAdminLeaf = () => (etherial as any).eth_admin_leaf

@Controller()
export default class AdminPagesController {

    /**
     * POST /admin/pages/:page/submit
     * Submit a custom page form
     */
    @Post('/admin/pages/:page/submit')
    @ShouldBeAuthenticated()
    async submitForm(
        req: Request & { user: any; params: { page: string }; body: any },
        res: Response
    ): Promise<any> {
        const { page: pageName } = req.params
        const adminLeaf = getAdminLeaf()

        if (!adminLeaf) {
            return (res as any).error?.({ status: 500, errors: ['admin_leaf_not_configured'] })
        }

        const hasAdminAccess = await adminLeaf.canAccessAdmin(req.user)
        if (!hasAdminAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        const page = adminLeaf.getPage(pageName)
        if (!page) {
            return (res as any).error?.({ status: 404, errors: ['page_not_found'] })
        }

        if (typeof page.canAccess === 'function') {
            try {
                const allowed = await page.canAccess(req.user)
                if (!allowed) {
                    return (res as any).error?.({ status: 403, errors: ['forbidden'] })
                }
            } catch {
                return (res as any).error?.({ status: 403, errors: ['forbidden'] })
            }
        }

        const handler = adminLeaf.getPageFormHandler(pageName)
        if (!handler) {
            return (res as any).error?.({ status: 400, errors: ['no_form_handler_registered'] })
        }

        try {
            const result = await handler(req.body, req)
            return (res as any).success?.({ status: 200, data: result })
        } catch (err: any) {
            console.error(`[ETHAdminLeaf] Page form submit error for "${pageName}":`, err)
            return (res as any).error?.({ status: 400, errors: [err.message] })
        }
    }
}

export const AvailableRouteMethods = ['submitForm'] as const
