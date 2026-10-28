import { PageBlock, PageHead, PageImage, PageTheme } from './options.js';
import { PageFonts } from './fonts.js';
export interface RenderInput {
    title: string;
    summary: string;
    blocks: PageBlock[];
    locale: string;
    rtl: boolean;
    theme: PageTheme;
    brand: string;
    /** Where a `page:<slug>` link goes. */
    pageHref: (slug: string) => string;
    /** The page in each language, this one included: the switch at the top. */
    languages: {
        locale: string;
        href: string;
    }[];
    /** The address it is served at, for the previews of a shared link. */
    canonical?: string;
    /** The project's: an event's "Add to calendar" link says its times are in it. */
    timezone?: string;
    /** The brand above and below, the language switch. Default true; off for a page shown inside something else. */
    chrome?: boolean;
    /** A block being written: an image not uploaded yet is a grey box, a button without its link is drawn anyway. */
    draft?: boolean;
    /** Each block's outermost element says which one it is (`data-block`), for the back-office to point at. */
    marks?: boolean;
    /** With `marks`: each block's place in the list the back-office sent, when some were left out. */
    indexes?: number[];
    /** The fonts of the titles and of the text, those the back-office set. Default the theme's `font`. */
    fonts?: PageFonts;
    /** How it opens: the cover's height, the title's place, size, color and font. Default `DEFAULT_HEAD`. */
    head?: PageHead;
    /** The photo across the top, above the title: the cover of the record the page belongs to. */
    cover?: PageImage | null;
    /** A line above everything: a preview link says the page is not on the web. */
    notice?: string;
    /** Kept out of search engines, its address out of the Referer of its links: a preview link. */
    unlisted?: boolean;
}
export declare const COLORS: {
    primary: string;
    onPrimary: string;
    text: string;
    muted: string;
    background: string;
    border: string;
    subtle: string;
};
export declare const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
export declare const FONT_RTL = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, Arial, sans-serif";
export declare const RADIUS = 12;
type Palette = typeof COLORS;
/** The theme's colors over the defaults: what the page is drawn with, and what the editor shows. */
export declare function paletteOf(theme: PageTheme | undefined): Palette;
/** The theme's corner radius, in pixels. */
export declare function radiusOf(theme: PageTheme | undefined): number;
export declare function render(input: RenderInput): string;
export {};
