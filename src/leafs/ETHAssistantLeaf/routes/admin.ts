import type { Request, Response } from 'express'
import { Controller, Post } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'

import { mayUse } from '../services/access.js'
import { AssistantError } from '../services/anthropic.js'
import { ask, parseInput } from '../services/run.js'

type AuthedRequest = Request & { user: any }

@Controller()
export default class ETHAssistantAdminController {
    /**
     * POST /admin/assistant/ask
     * { task: 'ask' | 'summarize' | 'draft', messages: [{ role, content }], context?: { collection, id?, filters?, search? }, language?: 'en' | 'ar',
     *   conversationId?, where? }
     * → { answer, steps, model, usage, proposals?, conversationId? }
     *
     * `proposals`: changes prepared for the person to confirm (leaf's `proposals` on).
     * `conversationId`: where the turn was kept (leaf's `history` on); sent back
     * with the next question to carry on the same conversation.
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
