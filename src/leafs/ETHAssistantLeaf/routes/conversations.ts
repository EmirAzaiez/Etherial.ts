import type { Request, Response } from 'express'
import { Controller, Delete, Get, Post, Put } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'

import { mayUse } from '../services/access.js'
import { DECISIONS, Decision, deleteConversation, getConversation, listConversations, recordDecision, renameConversation } from '../services/history.js'
import { aiAllowed } from '../services/options.js'

type AuthedRequest = Request & { user: any }

/** Mounted only with the leaf's `history` on. Each person reaches their own conversations, never another's. */
async function refused(req: AuthedRequest, res: Response): Promise<boolean> {
    if (!aiAllowed()) {
        ;(res as any).error({ status: 503, errors: ['ai_off'] })
        return true
    }
    if (!(await mayUse(req.user))) {
        ;(res as any).error({ status: 403, errors: ['forbidden'] })
        return true
    }
    return false
}

const notFound = (res: Response) => (res as any).error({ status: 404, errors: ['not_found'] })

@Controller()
export default class ETHAssistantConversationsController {
    /** GET /admin/assistant/conversations?q= → { items: [{ id, title, turns, created_at, updated_at }] }, latest first */
    @Get('/admin/assistant/conversations')
    @ShouldBeAuthenticated()
    async list(req: AuthedRequest, res: Response): Promise<any> {
        if (await refused(req, res)) return
        const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : ''
        return (res as any).success({ status: 200, data: { items: await listConversations(req.user.id, q || undefined) } })
    }

    /** GET /admin/assistant/conversations/:id → { id, title, turns, created_at, updated_at } */
    @Get('/admin/assistant/conversations/:id(\\d+)')
    @ShouldBeAuthenticated()
    async show(req: AuthedRequest, res: Response): Promise<any> {
        if (await refused(req, res)) return
        const conversation = await getConversation(req.user.id, req.params.id)
        if (!conversation) return notFound(res)
        return (res as any).success({ status: 200, data: conversation })
    }

    /** PUT /admin/assistant/conversations/:id { title } */
    @Put('/admin/assistant/conversations/:id(\\d+)')
    @ShouldBeAuthenticated()
    async rename(req: AuthedRequest, res: Response): Promise<any> {
        if (await refused(req, res)) return
        const title = typeof req.body?.title === 'string' ? req.body.title.trim().replace(/\s+/g, ' ') : ''
        if (!title) return (res as any).error({ status: 400, errors: ['title_missing'] })
        if (!(await renameConversation(req.user.id, req.params.id, title))) return notFound(res)
        return (res as any).success({ status: 200, data: { id: Number(req.params.id), title: title.slice(0, 200) } })
    }

    /** DELETE /admin/assistant/conversations/:id */
    @Delete('/admin/assistant/conversations/:id(\\d+)')
    @ShouldBeAuthenticated()
    async remove(req: AuthedRequest, res: Response): Promise<any> {
        if (await refused(req, res)) return
        if (!(await deleteConversation(req.user.id, req.params.id))) return notFound(res)
        return (res as any).success({ status: 200, data: { deleted: true } })
    }

    /**
     * POST /admin/assistant/conversations/:id/decisions
     * { proposal, status: 'confirmed' | 'cancelled' | 'failed', error?, createdId? }
     *
     * Only a note on the card, for the conversation to show it when reopened:
     * the change itself went through the back-office's own endpoint.
     */
    @Post('/admin/assistant/conversations/:id(\\d+)/decisions')
    @ShouldBeAuthenticated()
    async decide(req: AuthedRequest, res: Response): Promise<any> {
        if (await refused(req, res)) return
        const proposal = typeof req.body?.proposal === 'string' ? req.body.proposal.slice(0, 64) : ''
        const status = req.body?.status as Decision
        if (!proposal || !DECISIONS.includes(status)) return (res as any).error({ status: 400, errors: ['decision_invalid'] })
        const createdId = typeof req.body?.createdId === 'string' || typeof req.body?.createdId === 'number' ? req.body.createdId : undefined
        const error = typeof req.body?.error === 'string' ? req.body.error : undefined
        if (!(await recordDecision(req.user.id, req.params.id, proposal, { status, error, createdId }))) return notFound(res)
        return (res as any).success({ status: 200, data: { recorded: true } })
    }
}
