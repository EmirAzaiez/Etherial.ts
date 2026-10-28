import type { Response } from 'express';
import { AuthedRequest } from '../services/http.js';
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
    preview(req: AuthedRequest, res: Response): Promise<any>;
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
    generate(req: AuthedRequest, res: Response): Promise<any>;
    /**
     * GET /admin/content-pages/of/:collection/:id/:field
     *
     * The page of a record's `page` field (a news' content), for its form:
     * null while it has none. To whoever may open the record.
     */
    attached(req: AuthedRequest, res: Response): Promise<any>;
    /**
     * GET /admin/content-pages/share/:id
     *
     * How a saved page is shared: `{ published, web, preview }`. `web`, its
     * public links once published (`{ <locale>: url }`); `preview`, its
     * preview link in each language (in the bucket too), null while it has
     * none: whoever has it sees the page as last saved, a draft too. To
     * whoever may open the page.
     */
    share(req: AuthedRequest, res: Response): Promise<any>;
    /** POST /admin/content-pages/share/:id — its preview link made, the same one while it isn't stopped. To whoever may edit the page. */
    startPreview(req: AuthedRequest, res: Response): Promise<any>;
    /** DELETE /admin/content-pages/share/:id — its preview link stopped: it opens "This link no longer works". */
    stopPreview(req: AuthedRequest, res: Response): Promise<any>;
    /**
     * GET /admin/content-pages/templates
     *
     * The blocks saved to start a page from, the newest first:
     * `[{ id, name, blocks, created_at, updated_at }]`. Any back-office user, like the
     * preview: a news is written with them too.
     */
    templates(req: AuthedRequest, res: Response): Promise<any>;
    /** POST /admin/content-pages/templates  { name, blocks } — the template saved. */
    createTemplate(req: AuthedRequest, res: Response): Promise<any>;
    /** PUT /admin/content-pages/templates/:id  { name?, blocks? } — renamed or rewritten, checked as when saved. */
    updateTemplate(req: AuthedRequest, res: Response): Promise<any>;
    /** DELETE /admin/content-pages/templates/:id */
    deleteTemplate(req: AuthedRequest, res: Response): Promise<any>;
    /**
     * GET /admin/content-pages/settings
     *
     * What is set for every page: `{ fonts: { title, text }, head }`, ids of
     * the fonts (the feature's `fonts.catalog`), null for the theme's; how
     * they open, a key left out the theme's. Any back-office user: the editor
     * of a news draws its page with them.
     */
    settings(req: AuthedRequest, res: Response): Promise<any>;
    /**
     * PUT /admin/content-pages/settings  { fonts?: { title?, text? }, head? }
     *
     * A font given replaces the one set, null goes back to the theme's; a
     * head replaces how every page opens, null goes back to the theme's. Every
     * published page is written into the bucket again, in the background. To
     * whoever may edit the pages.
     */
    updateSettings(req: AuthedRequest, res: Response): Promise<any>;
}
