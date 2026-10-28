import type { Response } from 'express'
import { Controller, Delete, Get, Post, Put } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'

import { attachedPage } from '../services/attached.js'
import { AuthedRequest, guard, streamed } from '../services/http.js'
import { generatePage } from '../services/generate.js'
import { previewPage } from '../services/preview.js'
import { createTemplate, deleteTemplate, listTemplates, updateTemplate } from '../services/templates.js'
import { readSettings, saveSettings } from '../services/settings.js'
import { republishSoon } from '../services/publish.js'
import { COLLECTION } from '../services/options.js'
import { PageLinks, linksOf, pageToShare, startPreview, stopPreview } from '../services/share.js'
import type { Page } from '../models/Page.js'

/** A route on one page, to whoever may `action` its collection (a news' page: the news'). */
async function onPage(req: AuthedRequest, res: Response, action: 'show' | 'update', run: (page: Page | null) => Promise<PageLinks> | PageLinks) {
    const { page, collection } = await pageToShare(req.params.id)
    return guard(req, res, async () => run(page), (adminLeaf) => adminLeaf.checkAccess(req.user, collection, action))
}

@Controller()
export default class ETHPageAdminController {
    /**
     * POST /admin/content-pages/preview  { locale, title, summary, blocks, chrome? }
     *
     * The page as the web will show it, from the form being written: the
     * back-office's phone preview. A block not finished yet is drawn as it is
     * (an image to upload is a grey box) instead of failing the preview, and
     * each block's element says which one it is (`data-block`). `chrome:
     * false`: without the brand and the language switch. Any back-office user:
     * it draws what it is sent and reads nothing (a news is written by people
     * who may not see the Pages).
     */
    @Post('/admin/content-pages/preview')
    @ShouldBeAuthenticated()
    async preview(req: AuthedRequest, res: Response) {
        return guard(req, res, async () => previewPage(req.body ?? {}), async () => true)
    }

    /**
     * POST /admin/content-pages/generate  { prompt, locales, mode, blocks?, title?, summary?, images?, documents?, links? }
     *
     * Claude writes the page from a few words, and the blocks come as they are
     * written, in server-sent events: `status` ({ phase: reading | thinking |
     * writing }), one `source` per link read ({ url, kind: page | pdf, title,
     * images }), one `block` per block ({ index, blocks: { <locale>: block } }),
     * then `done` ({ count, images, links, note, cut, model }) or `error`
     * ({ status, message }). `mode`: `new` writes the page, `add` only blocks
     * to add to `blocks`, `change` the whole of `blocks` again, changed.
     * `images`: [{ mediaType, data (base64) }], screenshots to make the page
     * from (12 at most, 5 MB each). `documents`: [{ name, data (base64) }],
     * PDFs (2 at most, 15 MB together). The API's JSON limit must allow them.
     * `links`: up to 3 https links to pages of websites (or PDFs), opened by
     * the server first; only public addresses are, never its own network. Nothing
     * is saved: the editor puts the blocks in the page. Any back-office user,
     * like the preview, when the project's AI is on (the feature's `ai`).
     */
    @Post('/admin/content-pages/generate')
    @ShouldBeAuthenticated()
    async generate(req: AuthedRequest, res: Response) {
        return streamed(req, res, (send, signal) => generatePage(req.body ?? {}, ({ event, data }) => send(event, data), signal))
    }

    /**
     * GET /admin/content-pages/of/:collection/:id/:field
     *
     * The page of a record's `page` field (a news' content), for its form:
     * null while it has none. To whoever may open the record.
     */
    @Get('/admin/content-pages/of/:collection/:id(\\d+)/:field')
    @ShouldBeAuthenticated()
    async attached(req: AuthedRequest, res: Response) {
        const { collection, id, field } = req.params as Record<string, string>
        return guard(
            req,
            res,
            async () => attachedPage(collection, id, field),
            (adminLeaf) => adminLeaf.checkAccess(req.user, collection, 'show')
        )
    }

    /**
     * GET /admin/content-pages/share/:id
     *
     * How a saved page is shared: `{ published, web, preview }`. `web`, its
     * public links once published (`{ <locale>: url }`); `preview`, its
     * preview link in each language (in the bucket too), null while it has
     * none: whoever has it sees the page as last saved, a draft too. To
     * whoever may open the page.
     */
    @Get('/admin/content-pages/share/:id(\\d+)')
    @ShouldBeAuthenticated()
    async share(req: AuthedRequest, res: Response) {
        return onPage(req, res, 'show', linksOf)
    }

    /** POST /admin/content-pages/share/:id — its preview link made, the same one while it isn't stopped. To whoever may edit the page. */
    @Post('/admin/content-pages/share/:id(\\d+)')
    @ShouldBeAuthenticated()
    async startPreview(req: AuthedRequest, res: Response) {
        return onPage(req, res, 'update', startPreview)
    }

    /** DELETE /admin/content-pages/share/:id — its preview link stopped: it opens "This link no longer works". */
    @Delete('/admin/content-pages/share/:id(\\d+)')
    @ShouldBeAuthenticated()
    async stopPreview(req: AuthedRequest, res: Response) {
        return onPage(req, res, 'update', stopPreview)
    }

    /**
     * GET /admin/content-pages/templates
     *
     * The blocks saved to start a page from, the newest first:
     * `[{ id, name, blocks, created_at, updated_at }]`. Any back-office user, like the
     * preview: a news is written with them too.
     */
    @Get('/admin/content-pages/templates')
    @ShouldBeAuthenticated()
    async templates(req: AuthedRequest, res: Response) {
        return guard(req, res, async () => listTemplates(), async () => true)
    }

    /** POST /admin/content-pages/templates  { name, blocks } — the template saved. */
    @Post('/admin/content-pages/templates')
    @ShouldBeAuthenticated()
    async createTemplate(req: AuthedRequest, res: Response) {
        return guard(req, res, async () => createTemplate(req.body ?? {}), async () => true)
    }

    /** PUT /admin/content-pages/templates/:id  { name?, blocks? } — renamed or rewritten, checked as when saved. */
    @Put('/admin/content-pages/templates/:id(\\d+)')
    @ShouldBeAuthenticated()
    async updateTemplate(req: AuthedRequest, res: Response) {
        return guard(req, res, async () => updateTemplate(req.params.id, req.body ?? {}), async () => true)
    }

    /** DELETE /admin/content-pages/templates/:id */
    @Delete('/admin/content-pages/templates/:id(\\d+)')
    @ShouldBeAuthenticated()
    async deleteTemplate(req: AuthedRequest, res: Response) {
        return guard(req, res, async () => deleteTemplate(req.params.id), async () => true)
    }

    /**
     * GET /admin/content-pages/settings
     *
     * What is set for every page: `{ fonts: { title, text }, head }`, ids of
     * the fonts (the feature's `fonts.catalog`), null for the theme's; how
     * they open, a key left out the theme's. Any back-office user: the editor
     * of a news draws its page with them.
     */
    @Get('/admin/content-pages/settings')
    @ShouldBeAuthenticated()
    async settings(req: AuthedRequest, res: Response) {
        return guard(req, res, async () => readSettings(), async () => true)
    }

    /**
     * PUT /admin/content-pages/settings  { fonts?: { title?, text? }, head? }
     *
     * A font given replaces the one set, null goes back to the theme's; a
     * head replaces how every page opens, null goes back to the theme's. Every
     * published page is written into the bucket again, in the background. To
     * whoever may edit the pages.
     */
    @Put('/admin/content-pages/settings')
    @ShouldBeAuthenticated()
    async updateSettings(req: AuthedRequest, res: Response) {
        return guard(
            req,
            res,
            async () => {
                const { settings, changed } = await saveSettings(req.body ?? {})
                if (changed) republishSoon('New look')
                return settings
            },
            (adminLeaf) => adminLeaf.checkAccess(req.user, COLLECTION, 'update')
        )
    }
}
