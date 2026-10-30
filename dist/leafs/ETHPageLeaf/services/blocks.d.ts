import { Localized, PageBlock, PageBlocks, PageColor, PageHead, PageImage, RichText, Span } from './options.js';
/** `strict` refuses a block not finished; `draft` keeps it. */
export type Mode = 'strict' | 'draft';
/** `page:opening-hours`: opens another page, in the app as on the web. */
export declare const PAGE_LINK: RegExp;
/** A link that opens something: `https://`, `mailto:`, `tel:`, `page:<slug>`. Anything else is ''. */
export declare function linkOf(value: unknown): string;
/** A color token, or `#RRGGBB` (`#abc` is written out in full). Anything else is undefined. */
export declare function colorOf(value: unknown): PageColor | undefined;
export declare function spansLength(spans: Span[]): number;
/** The words of a line, without their marks. */
export declare function spansText(spans: Span[]): string;
/** The words of a rich text, without their marks: a link's words stay, its address goes. */
export declare function richText(rich: RichText): string;
/**
 * One language's blocks, checked, each with its place in the list it came
 * from: a draft drops what it can't read, and the preview still points at the
 * block the editor has under its eyes. `where` names the language in the
 * messages.
 */
export declare function normalizeBlockList(input: unknown, where: string, mode?: Mode): {
    index: number;
    block: PageBlock;
}[];
/** One language's blocks, checked. */
export declare function normalizeBlocks(input: unknown, where: string, mode?: Mode): PageBlock[];
/** Every language's blocks; a language the project dropped is dropped with it. */
export declare function normalizePageBlocks(input: unknown, locales: string[], mode?: Mode): PageBlocks;
/** How a page opens, as the back-office sends it: a choice it doesn't have is left out. Null when none is made. */
export declare function normalizeHead(input: unknown): PageHead | null;
/** The photo across the top of a page: its own, else its record's. */
export declare function photoOf(page: {
    head?: unknown;
    cover?: PageImage | null;
}): PageImage | null;
/** A cover photo: an https address, with the upload it is when there is one. Null otherwise. */
export declare function coverOf(input: unknown): PageImage | null;
/** Every uploaded file named in blocks, however deep: any `{ src, media }` in the JSON, and a video's `{ url, media }`. */
export declare function mediaIdsOf(value: unknown, out?: number[]): number[];
/** A title, or a summary, in each language: trimmed, single line. */
export declare function normalizeLocalized(input: unknown, field: string, locales: string[], max: number): Record<string, string>;
/** "Opening hours & map" → `opening-hours-map`. Empty when nothing in it is Latin (an Arabic title). */
export declare function slugify(title: string): string;
export declare function checkSlug(slug: unknown): string;
/** The first text a localized value has, for messages and fallbacks. */
export declare function firstOf(value: Localized | undefined | null, locales: string[]): string;
