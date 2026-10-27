import { Page } from '../models/Page.js';
/** How a page is shared, for the back-office. */
export interface PageLinks {
    published: boolean;
    /** Its HTML in the bucket, language by language: the public links, once published. */
    web: Record<string, string>;
    /** Its preview link in each language it is written in; null while it has none. */
    preview: Record<string, string> | null;
}
/** The page asked for, with the collection whose rights apply to it: the news it is the content of, else the Pages. */
export declare function pageToShare(id: unknown): Promise<{
    page: Page | null;
    collection: string;
}>;
export declare function linksOf(page: Page | null): PageLinks;
/**
 * The page's preview link: made the first time, the same one after. Its files
 * are written again on each click, so one lost in the bucket comes back.
 * `silent`: sharing is not an edit of the page.
 */
export declare function startPreview(page: Page | null): Promise<PageLinks>;
/** Its preview link stopped: whoever has it gets "This link no longer works". The files first: a link still showing the page is not stopped. */
export declare function stopPreview(page: Page | null): Promise<PageLinks>;
