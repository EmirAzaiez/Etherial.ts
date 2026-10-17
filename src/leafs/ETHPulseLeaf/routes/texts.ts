import { Controller, Delete, Get, Put, Request, Response } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'
import etherial from 'etherial'

import { PulseTextError, TEXTS_COLLECTION, listTexts, resetText, saveText } from '../services/texts.js'

type AuthedRequest = Request & { user: any }

/** Reading takes the right to read the texts collection, changing them the right to update it. */
async function guard(req: AuthedRequest, res: Response, method: 'list' | 'update', run: () => Promise<any>) {
    const adminLeaf = (etherial as any).eth_admin_leaf
    const allowed = !!adminLeaf && (await adminLeaf.canAccessAdmin(req.user)) && (await adminLeaf.checkAccess(req.user, TEXTS_COLLECTION, method))
    if (!allowed) return (res as any).error({ status: 403, errors: ['forbidden'] })
    try {
        return (res as any).success({ status: 200, data: await run() })
    } catch (err: any) {
        if (err instanceof PulseTextError) return (res as any).error({ status: err.status, errors: [err.code], message: err.message })
        console.error('[ETHPulseLeaf] Texts route failed:', err)
        return (res as any).error({ status: 500, errors: ['server_error'] })
    }
}

@Controller()
export default class ETHPulseTextsController {
    @Get('/admin/pulse/texts')
    @ShouldBeAuthenticated()
    async listTexts(req: AuthedRequest, res: Response) {
        return guard(req, res, 'list', () => listTexts())
    }

    @Put('/admin/pulse/texts/:key')
    @ShouldBeAuthenticated()
    async saveText(req: AuthedRequest, res: Response) {
        return guard(req, res, 'update', () => saveText(req.params.key, req.body, req.user?.id ?? null))
    }

    @Delete('/admin/pulse/texts/:key')
    @ShouldBeAuthenticated()
    async resetText(req: AuthedRequest, res: Response) {
        return guard(req, res, 'update', () => resetText(req.params.key, req.query.locale))
    }
}
