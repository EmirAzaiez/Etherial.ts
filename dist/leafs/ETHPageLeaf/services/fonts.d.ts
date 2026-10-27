export interface PageFont {
    id: string;
    /** Its name, in a stylesheet and in the editor. */
    family: string;
    category: 'sans' | 'serif';
    /** Has the Arabic letters. Without them, an Arabic page shows its words in the phone's own font. */
    arabic: boolean;
    weights: number[];
    italic: boolean;
    /** Its TTF files, those it has of `'400'`, `'500'`, `'600'`, `'700'` and `'400i'` (italic). */
    files: Record<string, string>;
}
/** A page's fonts: the ids of `FONTS`. One left out is the theme's, else the system's. */
export interface PageFonts {
    title?: string;
    text?: string;
}
export declare const FONTS: PageFont[];
export declare function fontOf(id: unknown): PageFont | undefined;
/** The id of a font the pages can use; anything else is no font. */
export declare function fontIdOf(id: unknown): string | undefined;
/** The fonts the back-office picks from: what the editor lists, without the files. */
export declare function fontCatalog(): {
    id: string;
    /** Its name, in a stylesheet and in the editor. */
    family: string;
    category: "sans" | "serif";
    /** Has the Arabic letters. Without them, an Arabic page shows its words in the phone's own font. */
    arabic: boolean;
    weights: number[];
    italic: boolean;
}[];
/** A font, then what the system shows when it is not there yet (or for the letters it doesn't have). */
export declare function fontStack(font: PageFont | undefined, fallback: string): string;
/** Google's stylesheet for these fonts, in the weights they have. */
export declare function googleFontsHref(fonts: PageFont[]): string;
/** Every font these words are drawn in: the page's two, and the blocks' own. */
export declare function fontsIn(fonts: PageFonts, blocks: {
    style?: {
        font?: string;
    };
}[]): PageFont[];
