import { Model } from 'etherial/components/database/provider';
import type { PageBlocks, PageHead, PageImage } from '../services/options.js';
/**
 * A page written in the back-office: a title and blocks in each language.
 * The app draws the blocks itself; the same page is also published as HTML in
 * the bucket, for a shared link and for the app's web view.
 */
export declare class Page extends Model<Page> {
    id: number;
    /** Its address: `pages/<slug>/<locale>.html` in the bucket, `page:<slug>` in a link. */
    slug: string;
    /** `{ en, ar }` */
    title: Record<string, string>;
    /** A line under the title, and in the app's list of pages. `{ en, ar }` */
    summary: Record<string, string>;
    /** `{ en: [blocks], ar: [blocks] }` */
    blocks: PageBlocks;
    /** How it opens (cover, title), for this page only: a key left out is the settings'. Null: as every page. */
    head: PageHead | null;
    /** The photo across the top: the cover of the record the page belongs to (a news'). Null: none. */
    cover: PageImage | null;
    /** Its record's logo (a place's), on the edge of a `sheet` head or over the cover with the head's `logo`. Null: none. */
    logo: PageImage | null;
    /** Off: the app no longer sees it, and its HTML leaves the bucket. */
    published: boolean;
    /** Listed in the app's menu. Off, it opens only from a link, a push or a banner. */
    in_menu: boolean;
    /**
     * The collection of the record the page is the content of (a news): it is
     * written in that record's form and deleted with it, never in the menu nor
     * in the back-office's Pages. Null: a page of its own.
     */
    owner: string | null;
    /** Its place in the app's menu, the smallest first. */
    position: number;
    /** The HTML in the bucket, per language: `{ en: 'https://…/pages/<slug>/en.html' }`. Written by the leaf. */
    html: Record<string, string>;
    /** The address the HTML is under in the bucket, to take it down when the page moves or goes. */
    published_slug: string | null;
    published_at: Date | null;
    /**
     * The key of its preview link (`/pages/preview/<key>`): whoever has the
     * link sees the page as last saved, a draft too. Null: not shared. No
     * index: the plain sync that runs before the alter-sync would build it
     * on a column not added yet, and the boot fails.
     */
    preview_key: string | null;
    created_at: Date;
    updated_at: Date;
}
