import { PageBlocks, PageHead, PageImage, ResolvedBlock } from './options.js';
/** What publishing reads of a page: the saved row, or the row about to be saved. */
export interface PageLike {
    slug: string;
    title: Record<string, string>;
    summary: Record<string, string>;
    blocks: PageBlocks;
    published: boolean;
    /** How it opens, its own choices: the rest is every page's. */
    head?: PageHead | null;
    /** The photo across the top: its record's cover. */
    cover?: PageImage | null;
    html?: Record<string, string> | null;
    published_slug?: string | null;
    published_at?: Date | null;
    preview_key?: string | null;
}
/** A page in one language, as the app and the web get it. */
export interface PageIn {
    /** The language it is written in: the one asked for, or the default when that one has no blocks. */
    locale: string;
    dir: 'ltr' | 'rtl';
    title: string;
    summary: string;
    /** With what each one needs worked out in this language (`resolved`): an event's date, a video's player. */
    blocks: ResolvedBlock[];
}
/** Where the bucket's public files are read from: the CDN, else the bucket itself. */
export declare function publicBase(): string;
export declare function keyOf(slug: string, locale: string): string;
/** The languages with blocks of their own, the default one first (always: a page has at least it). */
export declare function writtenLocales(blocks: PageBlocks): string[];
export declare function pageIn(page: Pick<PageLike, 'title' | 'summary' | 'blocks'>, asked: string): PageIn;
/** Every language of the page, rendered as the bucket gets it. */
export declare function renderAll(page: PageLike): {
    locale: string;
    key: string;
    url: string;
    html: string;
}[];
/**
 * Puts the page's HTML where it belongs before the row is saved: the columns
 * to save with it, and the files of its old address to take down once it is.
 * A bucket that refuses fails the save, so the back-office never shows a page
 * as published while the web has the old one.
 */
export declare function publish(next: PageLike, previous: PageLike | null): Promise<{
    columns: {
        html: {
            [k: string]: string;
        };
        published_slug: string;
        published_at: Date;
    };
    stale: string[];
}>;
/**
 * Files no page uses any more, deleted in the background: a slow bucket holds
 * neither a save nor a delete. A failure only leaves a file behind (the media
 * leaf logs it).
 */
export declare function takeDown(keys: string[]): void;
/** A page deleted: its files go, its preview link says it no longer works. */
export declare function takeDownPage(page: Pick<PageLike, 'published_slug' | 'html' | 'preview_key'>): void;
export declare function previewKeyOf(key: string, locale: string): string;
/** The page written under its preview link: when the link is made, and on each save after. */
export declare function putPreview(page: PageLike, key: string): Promise<void>;
/** A preview link stopped: its files say it no longer works, in their language. */
export declare function retirePreview(key: string): Promise<void>;
/** Every published page written into the bucket again, and every preview link: after a change of theme or of fonts. */
export declare function republishAll(): Promise<number>;
/** `republishAll` in a few seconds, in the background: what the back-office's settings call when they change. */
export declare function republishSoon(why: string): void;
