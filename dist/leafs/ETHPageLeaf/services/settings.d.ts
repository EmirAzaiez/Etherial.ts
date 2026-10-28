import { PageFonts } from './fonts.js';
import { PageHead } from './options.js';
/** Reads the row again; a database that fails keeps what was read before. */
export declare function loadSettings(): Promise<void>;
/** The fonts the pages are drawn in now: the back-office's, else the theme's. */
export declare function pageFonts(): PageFonts;
/** How a page opens when it sets nothing: the theme's look, under it `DEFAULT_HEAD`. */
export declare function themeHead(): PageHead;
/**
 * How a page opens: its own choices, over every page's (`look`, else the
 * back-office's), over the theme's. `look` is the one the settings are
 * trying out, not saved yet. The page's own photo isn't in it: it is the
 * page's cover (`photoOf`).
 */
export declare function pageHead(own?: PageHead | null, look?: PageHead | null): PageHead;
export interface SettingsOut {
    /** What the back-office picked: null is the theme's. */
    fonts: {
        title: string | null;
        text: string | null;
    };
    /** How every page opens, as the back-office set it: a key left out is the theme's. */
    head: PageHead;
}
export declare function readSettings(): Promise<SettingsOut>;
/**
 * `{ fonts: { title?, text? }, head? }`: a font given replaces the one set,
 * null goes back to the theme's; a head replaces every page's look, null
 * goes back to the theme's. `changed`: the pages' HTML has to be written again.
 */
export declare function saveSettings(body: Record<string, any>): Promise<{
    settings: SettingsOut;
    changed: boolean;
}>;
/**
 * True once after the theme (or the way pages are drawn) changed since the
 * HTML was last written: the boot then writes every page again.
 */
export declare function lookChanged(): Promise<boolean>;
