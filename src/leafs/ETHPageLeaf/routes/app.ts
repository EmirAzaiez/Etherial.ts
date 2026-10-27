import type { Request, Response } from 'express'
import { Controller, Get } from 'etherial/components/http/provider'

import { Page } from '../models/Page.js'
import { localeOf } from '../services/http.js'
import { serializePage } from '../services/serialize.js'

/** No sign-in: a page is public, its HTML is in the bucket for anyone with the link. */
@Controller()
export default class ETHPageAppController {
    /**
     * GET /pages
     *
     * Every published page, in the app's language, blocks included: the app
     * keeps them and opens a page without waiting. Its menu lists those
     * `in_menu`, in `position` order; the others open from a link or a push.
     * The pages of other records (a news) come with them, not here.
     */
    @Get('/pages')
    async list(req: Request, res: Response): Promise<any> {
        const locale = localeOf(req)
        const pages = await Page.findAll({
            where: { published: true, owner: null },
            order: [
                ['position', 'ASC'],
                ['id', 'ASC'],
            ],
        })
        return (res as any).success({ status: 200, data: pages.map((p) => serializePage(p, locale)) })
    }

    /** GET /pages/:slug — one published page, in the menu or not, a news' one too: its link opens it. */
    @Get('/pages/:slug')
    async show(req: Request, res: Response): Promise<any> {
        const slug = String(req.params.slug ?? '').toLowerCase()
        const page = /^[a-z0-9-]{1,80}$/.test(slug) ? await Page.findOne({ where: { slug, published: true } }) : null
        if (!page) return (res as any).error({ status: 404, errors: ['page_not_found'] })
        return (res as any).success({ status: 200, data: serializePage(page, localeOf(req)) })
    }
}
