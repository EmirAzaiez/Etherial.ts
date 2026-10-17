import type { Request, Response } from 'express'
import { Controller, Get, Post } from 'etherial/components/http/provider'

import { emailFromLink, unsubscribe, unsubscribePage } from '../services/unsubscribe.js'

function page(res: Response, status: number, html: string) {
    res.status(status).set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }).send(html)
}

/** The link at the bottom of a campaign email. No account needed: the link is signed for the address. */
@Controller()
export default class ETHMailPublicController {
    /** Asks first: mail scanners open links on their own. */
    @Get('/mail/unsubscribe')
    async unsubscribeForm(req: Request, res: Response) {
        try {
            const email = await emailFromLink(req.query)
            return page(res, email ? 200 : 400, await unsubscribePage(email ? 'confirm' : 'invalid', req.query, email))
        } catch (err) {
            console.error('[ETHMailLeaf] Unsubscribe page failed:', err)
            return res.status(500).send('Something went wrong. Please try again later.')
        }
    }

    /** The page's button, and the inbox's own (RFC 8058, `List-Unsubscribe=One-Click`). */
    @Post('/mail/unsubscribe')
    async unsubscribeConfirm(req: Request, res: Response) {
        try {
            const email = await emailFromLink(req.query)
            if (!email) return page(res, 400, await unsubscribePage('invalid', req.query, null))
            await unsubscribe(email, req.query.c)
            return page(res, 200, await unsubscribePage('done', req.query, email))
        } catch (err) {
            console.error('[ETHMailLeaf] Unsubscribe failed:', err)
            return res.status(500).send('Something went wrong. Please try again later.')
        }
    }
}
