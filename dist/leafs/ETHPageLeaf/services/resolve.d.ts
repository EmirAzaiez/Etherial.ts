import { ContactKind, PageBlock, ResolvedBlock } from './options.js';
export interface ResolveOptions {
    /** The page's language: the dates and the default words are in it. */
    locale: string;
    /** The page's title: an event without its own title is put in the calendar under it. */
    title?: string;
    /** The project's (`Asia/Dubai`): an event's times are in it. */
    timezone?: string;
    /** The leaf's Google key (`maps.key`): a map is a picture of Google's. */
    mapsKey?: string;
}
export declare function contactHref(kind: ContactKind, value: string): string;
/**
 * The blocks with what each one needs worked out (`resolved`), for the app and the web.
 * An event titled like the page loses its title: the page's is right above the card.
 */
export declare function resolveBlocks(blocks: PageBlock[], options: ResolveOptions): ResolvedBlock[];
