import etherial, { Etherial } from 'etherial'
import * as path from 'path'
import { fileURLToPath } from 'url'

import { registerMediaReferences } from '../ETHMediaLeaf/models/Media.js'
import { Page } from './models/Page.js'
import { PageTemplate } from './models/PageTemplate.js'
import { PageSettings } from './models/PageSettings.js'
import { registerPagesAdmin } from './admin/pages.js'
import { mediaIdsOf } from './services/blocks.js'
import { republishAll } from './services/publish.js'
import { fontCatalog } from './services/fonts.js'
import { loadSettings } from './services/settings.js'
import { paletteOf, radiusOf } from './services/render.js'
import { state } from './services/state.js'
import { canGenerate } from './services/generate.js'
import { BLOCKS_TYPE, COLLECTION, ETHPageLeafConfig, PAGE_TYPE, defaultLocaleOf, folderOf, localesOf, rtlOf } from './services/options.js'

export * from './services/options.js'
export { Page } from './models/Page.js'
export { PageTemplate } from './models/PageTemplate.js'
export { PageSettings } from './models/PageSettings.js'
export { FONTS } from './services/fonts.js'
export type { PageFont, PageFonts } from './services/fonts.js'
export { resolveBlocks } from './services/resolve.js'
export type { PageIn } from './services/publish.js'
export { serializePage, publishedPages } from './services/serialize.js'
export type { AppPage } from './services/serialize.js'
export { localeOf } from './services/http.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** What the back-office lets people upload in an image block. */
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/**
 * ETHPageLeaf — simple pages to read, written in the back-office.
 *
 * A page is a title and blocks, in each language: headings and rich texts,
 * buttons, images, a hero, galleries, videos, cards, questions, contacts,
 * events, figures, notes, label / value lines, each in a box of its own
 * (background, padding, edge to edge). The app gets
 * the blocks (`GET /pages`, `GET /pages/:slug`) and draws them itself, so a
 * page it already has opens at once. The same page is published as HTML in
 * the media leaf's bucket, `<folder>/<slug>/<locale>.html`, when it is saved:
 * that is the link to share, and what a web view shows. The API never serves
 * that HTML. A draft has a preview link to send before that, in the bucket
 * too: `<folder>/preview/<key>/<locale>.html`, written again on each save.
 * Needs the media leaf, and one of its public-read folders.
 *
 * A page can also be the content of another collection's record (a news): a
 * `page` field, written in that record's form and kept with it. The project
 * sends it along with the record (`publishedPages`).
 */
export default class ETHPageLeaf {
    readonly etherial_module_name = 'eth_page_leaf'

    public config: ETHPageLeafConfig
    private routes: { route: string; methods: string[] }[] = []

    constructor(config: ETHPageLeafConfig = {}) {
        this.config = config
        state.config = config
        this.routes.push(
            { route: path.join(__dirname, 'routes/app'), methods: ['list', 'show'] },
            { route: path.join(__dirname, 'routes/admin'), methods: ['preview', 'generate', 'attached', 'templates', 'createTemplate', 'updateTemplate', 'deleteTemplate', 'settings', 'updateSettings', 'share', 'startPreview', 'stopPreview'] }
        )
    }

    /**
     * Lifecycle: beforeRun — the table to the database before it syncs, the
     * collection to the back-office before it sets up its history.
     */
    beforeRun({ database }: Etherial) {
        database?.addModels([Page, PageTemplate, PageSettings] as any)
        registerPagesAdmin((etherial as any).eth_admin_leaf, this.config)
        // The images uploaded into a page or a template are only named in its blocks (JSON),
        // anywhere in them: a hero's, a gallery's, a card's, a video's poster.
        registerMediaReferences(async () => {
            const [pages, templates] = await Promise.all([
                Page.findAll({ attributes: ['blocks'], raw: true }),
                PageTemplate.findAll({ attributes: ['blocks'], raw: true }),
            ])
            return mediaIdsOf([...pages, ...templates].map((row: any) => row.blocks))
        })
    }

    run({ http }: Etherial) {
        http?.routes_leafs?.push(...this.routes)

        const media = (etherial as any).eth_media_leaf
        const folder = folderOf(this.config)
        if (!media?.s3) console.warn('[ETHPageLeaf] No media leaf: pages cannot be published, their HTML goes to its bucket')
        else if (media.getRuleForFolder?.(folder)?.visibility !== 'public-read') {
            console.warn(`[ETHPageLeaf] The media leaf has no public-read rule for "${folder}": the images of the pages can't be uploaded`)
        }
    }

    /** Lifecycle: afterRun — tell the back-office how pages are written. */
    afterRun() {
        // The fonts the back-office set, read before the first page is drawn.
        void loadSettings()
        const adminLeaf = (etherial as any).eth_admin_leaf
        if (!adminLeaf?.setFeature) return
        const folder = folderOf(this.config)
        const rule = (etherial as any).eth_media_leaf?.getRuleForFolder?.(folder)
        const locales = localesOf(this.config)
        adminLeaf.setFeature('pages', {
            collection: COLLECTION,
            blocksType: BLOCKS_TYPE,
            locales,
            defaultLocale: defaultLocaleOf(this.config),
            rtlLocales: locales.filter((l) => rtlOf(this.config, l)),
            previewPath: '/admin/content-pages/preview',
            // `<attachedPath>/<collection>/<id>/<field>`: the page of a record's `page` field.
            pageType: PAGE_TYPE,
            attachedPath: '/admin/content-pages/of',
            // The upload of an image block, as a media field would declare it.
            images: {
                folder,
                accept: rule?.mime_types?.length ? IMAGE_TYPES.filter((t) => rule.mime_types.includes(t)) : IMAGE_TYPES,
                maxSize: rule?.max_size ?? null,
            },
            // The colors a block's `primary`, `subtle`… stand for, and the corners: the editor's swatches.
            theme: { colors: paletteOf(this.config.theme), radius: radiusOf(this.config.theme) },
            // GET the list, POST { name, blocks }, PUT / DELETE `<templatesPath>/<id>`.
            templatesPath: '/admin/content-pages/templates',
            // `<sharePath>/<id>` of a saved page: GET its links, POST makes its preview link, DELETE stops it.
            sharePath: '/admin/content-pages/share',
            // The fonts to pick from, the theme's (what a page is in when none is set),
            // and where every page's are read (GET) and set (PUT { fonts: { title, text } }).
            fonts: {
                catalog: fontCatalog(),
                defaults: { title: this.config.theme?.fonts?.title ?? null, text: this.config.theme?.fonts?.text ?? null },
                settingsPath: '/admin/content-pages/settings',
            },
            // "Write with AI" in the editor: POST a few words, the blocks stream back. Absent without a key.
            ai: canGenerate() ? { generatePath: '/admin/content-pages/generate' } : null,
        })
    }

    commands() {
        return [
            {
                command: 'publish',
                description: 'Write the HTML of every published page again (after a change of theme)',
                action: async () => {
                    await loadSettings()
                    const count = await republishAll()
                    return { success: true, message: `Published ${count} page${count === 1 ? '' : 's'} again` }
                },
            },
        ]
    }
}
