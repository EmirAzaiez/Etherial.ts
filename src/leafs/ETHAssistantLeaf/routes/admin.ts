import etherial from 'etherial'
import type { Request, Response } from 'express'
import { Controller, Post } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'

import { AssistantError } from '../services/anthropic.js'
import { REQUESTS_COLLECTION } from '../services/options.js'
import { ask, parseInput } from '../services/run.js'
import { state } from '../services/state.js'

type AuthedRequest = Request & { user: any }

/** Whoever may list what was asked may ask, unless the project says otherwise. */
async function mayUse(user: any): Promise<boolean> {
    const adminLeaf = (etherial as any).eth_admin_leaf
    if (!adminLeaf || !(await adminLeaf.canAccessAdmin(user))) return false
    if (state.config.canUse) return !!(await state.config.canUse(user))
    return !!(await adminLeaf.checkAccess(user, REQUESTS_COLLECTION, 'list'))
}

@Controller()
export default class ETHAssistantAdminController {
    /**
     * POST /admin/assistant/ask
     * { task: 'ask' | 'summarize' | 'draft', messages: [{ role, content }], context?: { collection, id?, filters?, search? }, language?: 'en' | 'ar' }
     * → { answer, steps, model, usage }
     */
    @Post('/admin/assistant/ask')
    @ShouldBeAuthenticated()
    async ask(req: AuthedRequest, res: Response): Promise<any> {
        if (!(await mayUse(req.user))) return (res as any).error({ status: 403, errors: ['forbidden'] })
        try {
            const input = parseInput(req.body)
            return (res as any).success({ status: 200, data: await ask(req.user, input) })
        } catch (err: any) {
            if (err instanceof AssistantError) return (res as any).error({ status: err.status, errors: [err.code], message: err.message })
            console.error('[ETHAssistantLeaf] Request failed:', err?.message || err)
            return (res as any).error({ status: 500, errors: ['assistant_failed'] })
        }
    }
}
