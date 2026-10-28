import { Etherial } from 'etherial';
import { ETHPageLeafConfig } from './services/options.js';
export * from './services/options.js';
export { Page } from './models/Page.js';
export { PageTemplate } from './models/PageTemplate.js';
export { PageSettings } from './models/PageSettings.js';
export { FONTS } from './services/fonts.js';
export type { PageFont, PageFonts } from './services/fonts.js';
export { resolveBlocks } from './services/resolve.js';
export type { PageIn } from './services/publish.js';
export { serializePage, publishedPages } from './services/serialize.js';
export type { AppPage } from './services/serialize.js';
export { localeOf } from './services/http.js';
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
    readonly etherial_module_name = "eth_page_leaf";
    config: ETHPageLeafConfig;
    private routes;
    constructor(config?: ETHPageLeafConfig);
    /**
     * Lifecycle: beforeRun — the table to the database before it syncs, the
     * collection to the back-office before it sets up its history.
     */
    beforeRun({ database }: Etherial): void;
    run({ http }: Etherial): void;
    /** Lifecycle: afterRun — tell the back-office how pages are written. */
    afterRun(): void;
    /**
     * At boot: the pages of records get their record's cover (those written
     * before pages had one), and every page is written again when the theme
     * or the way pages are drawn changed. In the background.
     */
    private catchUp;
    /** Each `page` field with a `cover`: its pages without one take their record's. */
    private fillCovers;
    commands(): {
        command: string;
        description: string;
        action: () => Promise<{
            success: boolean;
            message: string;
        }>;
    }[];
}
