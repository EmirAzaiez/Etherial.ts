import { ContactKind, PageBlock, ResolvedBlock } from './options.js';
export interface ResolveOptions {
    /** The page's language: the dates and the default words are in it. */
    locale: string;
    /** The page's title: an event without its own title is put in the calendar under it. */
    title?: string;
    /** The project's (`Asia/Dubai`): an event's times are in it. */
    timezone?: string;
}
export declare function contactHref(kind: ContactKind, value: string): string;
/** The blocks with what each one needs worked out (`resolved`), for the app and the web. */
export declare function resolveBlocks(blocks: PageBlock[], options: ResolveOptions): ResolvedBlock[];
