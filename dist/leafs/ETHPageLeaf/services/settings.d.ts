import { PageFonts } from './fonts.js';
/** Reads the row again; a database that fails keeps what was read before. */
export declare function loadSettings(): Promise<void>;
/** The fonts the pages are drawn in now: the back-office's, else the theme's. */
export declare function pageFonts(): PageFonts;
export interface SettingsOut {
    /** What the back-office picked: null is the theme's. */
    fonts: {
        title: string | null;
        text: string | null;
    };
}
export declare function readSettings(): Promise<SettingsOut>;
/**
 * `{ fonts: { title?, text? } }`: a font given replaces the one set, null goes
 * back to the theme's. `changed`: the pages' HTML has to be written again.
 */
export declare function saveSettings(body: Record<string, any>): Promise<{
    settings: SettingsOut;
    changed: boolean;
}>;
