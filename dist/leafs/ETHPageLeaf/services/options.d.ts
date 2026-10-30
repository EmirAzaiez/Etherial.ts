import type { PageFonts } from './fonts.js';
/** A text in each language: `{ en: '…', ar: '…' }`, or one text for all. */
export type Localized = string | Record<string, string>;
/** `start` is left in English and right in Arabic; `end` the other way. */
export type Align = 'start' | 'center' | 'end';
/**
 * A color: one of the page's own, which each place that draws the page takes
 * from its theme (the web from `theme.colors`, the app from its palette), or
 * `#RRGGBB`.
 */
export type PageColor = (typeof COLOR_TOKENS)[number] | `#${string}`;
export declare const COLOR_TOKENS: readonly ["primary", "text", "muted", "subtle", "white", "black"];
/** none 0 · sm 8 · md 20 · lg 36 · xl 56 (pixels, points in the app). */
export type Space = 'none' | 'sm' | 'md' | 'lg' | 'xl';
/** A run of text with its marks. `\n` in it is a line break. */
export interface Span {
    text: string;
    bold?: true;
    italic?: true;
    underline?: true;
    strike?: true;
    color?: PageColor;
    /** `https://`, `mailto:`, `tel:`, or `page:<slug>` to open another page. */
    link?: string;
}
/** Text as the editor writes it: paragraphs and lists, top to bottom. */
export type RichNode = {
    type: 'paragraph';
    spans: Span[];
} | {
    type: 'list';
    ordered?: true;
    items: Span[][];
};
export type RichText = RichNode[];
/** The box any block can sit in. */
export interface BlockStyle {
    background?: PageColor;
    /** The color of the text in the box. Default the page's, white on a dark background. */
    color?: PageColor;
    /** Space inside the box. Default `md` when it has a background, else `none`. */
    padding?: Space;
    /** Rounded corners, the theme's radius. */
    rounded?: boolean;
    /** Edge to edge, out of the page's side margins. */
    bleed?: boolean;
    /** Space above the block. Default `none`, `md` for a heading that is not the first block. */
    above?: Space;
    /** Space below the block. Default `md`. */
    below?: Space;
    /** The font of all its words, titles and text (an id of `FONTS`). Default the page's. */
    font?: string;
    /** Its corners, 0 to 32 pixels, instead of the theme's radius: its buttons', pictures', map's, items' and box's. */
    radius?: number;
}
/** An image: uploaded from the back-office, or an address. */
export interface PageImage {
    src: string;
    /** The media row of an uploaded image, so the orphan cleanup keeps it. */
    media?: number;
    /** For screen readers. */
    alt?: string;
}
/** A button: its words and where it goes. */
export interface PageLink {
    label: string;
    url: string;
}
/** Width:height an image is cut to. `auto` keeps the image's own. */
export type Ratio = 'auto' | '16:9' | '4:3' | '1:1' | '3:4';
export type ContactKind = 'phone' | 'whatsapp' | 'email' | 'map' | 'website';
/**
 * The icons a block can show: a details card's rows, a features block's
 * items, a button. One a row or an item leaves out is guessed from its words
 * (`iconFor`); the web draws Lucide's, the app its own of the same meaning.
 */
export declare const PAGE_ICONS: readonly ["info", "check", "time", "calendar", "call", "mail", "globe", "location", "navigate", "price", "people", "car", "shirt", "dining", "cafe", "wifi", "water", "fitness", "accessible", "pets", "bike", "beach", "sun", "leaf", "snow", "shop", "ticket", "star", "boat", "moon", "tour", "play", "arrow", "download"];
export type PageIcon = (typeof PAGE_ICONS)[number];
/**
 * The pieces a page is made of, top to bottom. Every link (a button's, a
 * span's, a card's) is `https://`, `mailto:`, `tel:` or `page:<slug>`.
 * Texts the editor formats are `Span[]` (one line) or `RichText`.
 */
export type PageBlock = (
/**
 * `eyebrow`: a short line above the title, after a short rule, in the accent color: "Find us" over "Location".
 * `weight`: the title's, instead of its level's.
 */
{
    type: 'heading';
    text: Span[];
    level?: 1 | 2 | 3;
    align?: Align;
    eyebrow?: string;
    weight?: (typeof HEAD_WEIGHTS)[number];
} | {
    type: 'text';
    text: RichText;
    align?: Align;
    size?: 'sm' | 'md' | 'lg';
}
/**
 * `soft`: the color, faint, behind the label. `color` replaces the primary one. `icon`: before the label.
 * `shape`: `round`, the theme's corners (default); `cut`, square with the bottom right corner cut, as an app's buttons.
 * `size`: `sm`, 45 pixels high, its words smaller in the text's regular weight, spaced: an app's buttons.
 */
 | {
    type: 'button';
    label: string;
    url: string;
    align?: Align;
    variant?: 'primary' | 'outline' | 'soft';
    color?: PageColor;
    full?: boolean;
    icon?: PageIcon;
    shape?: 'round' | 'cut';
    size?: 'sm' | 'md';
}
/** `width`: at most this many pixels wide. */
 | {
    type: 'image';
    image: PageImage;
    caption?: string;
    url?: string;
    width?: number;
    align?: Align;
    ratio?: Ratio;
}
/** A picture across the page with words on it. `overlay`: how dark it gets under them, 0 to 90 (%), default 35. */
 | {
    type: 'hero';
    image: PageImage;
    title?: string;
    subtitle?: string;
    button?: PageLink;
    height?: 'sm' | 'md' | 'lg';
    overlay?: number;
    align?: Align;
    position?: 'top' | 'center' | 'bottom';
}
/** `slides`: a carousel of big photos, their captions on them, as an app's gallery. */
 | {
    type: 'gallery';
    images: (PageImage & {
        caption?: string;
    })[];
    layout?: 'carousel' | 'grid' | 'slides';
    ratio?: Ratio;
}
/** YouTube, Vimeo, or a video file's address. `media`: the file's media row when it was uploaded, so the orphan cleanup keeps it. */
 | {
    type: 'video';
    url: string;
    media?: number;
    poster?: PageImage;
    caption?: string;
} | {
    type: 'cards';
    items: {
        image?: PageImage;
        title: string;
        text?: string;
        url?: string;
    }[];
    columns?: 1 | 2;
}
/** An image beside a text, on the `side` it says (on a phone, above it). */
 | {
    type: 'media-text';
    image: PageImage;
    title?: string;
    text: RichText;
    button?: PageLink;
    side?: 'start' | 'end';
} | {
    type: 'faq';
    items: {
        question: string;
        answer: RichText;
    }[];
}
/** Ways to reach someone: a phone number, a WhatsApp number, an email address, a map's link, a site. `card`: rows in a bordered card. */
 | {
    type: 'contact';
    items: {
        kind: ContactKind;
        value: string;
        label?: string;
    }[];
    layout?: 'buttons' | 'list' | 'card';
}
/** `date` / `endDate`: `YYYY-MM-DD`; `startTime` / `endTime`: `HH:MM`, in the project's `timezone`. */
 | {
    type: 'event';
    title?: string;
    date: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    place?: string;
    mapUrl?: string;
    /** The "Add to calendar" link. Default true. */
    calendar?: boolean;
} | {
    type: 'quote';
    text: string;
    author?: string;
}
/** Key figures: "120 · Villas". */
 | {
    type: 'stats';
    items: {
        value: string;
        label: string;
    }[];
}
/** A boxed sentence that must not be missed. */
 | {
    type: 'note';
    title?: string;
    text: RichText;
    tone?: 'info' | 'success' | 'warning' | 'danger';
}
/**
 * Label / value lines: the hours, the place, the phone number. `card`: each row with its icon, in a bordered card.
 * `rows`: each label small above its value, a hairline between them, as an app's "About".
 */
 | {
    type: 'details';
    rows: {
        label: string;
        value: string;
        icon?: PageIcon;
    }[];
    layout?: 'table' | 'card' | 'rows';
}
/**
 * A place: its address, a map, and a link to the directions. `lat` / `lng` in degrees; `zoom` 3 to 20, default 15.
 * `plain`: the address as a line, then the map alone (a tap opens the directions), without the card.
 */
 | {
    type: 'map';
    lat: number;
    lng: number;
    zoom?: number;
    address?: string;
    layout?: 'card' | 'plain';
}
/**
 * Short items with an icon, two by two: what a place offers ("Parking", "Kids area").
 * `soft`: on a faint shade of the primary color, the icon without its circle, as an app's amenities.
 */
 | {
    type: 'features';
    items: {
        label: string;
        icon?: PageIcon;
    }[];
    columns?: 1 | 2;
    variant?: 'card' | 'soft';
} | {
    type: 'divider';
} | {
    type: 'spacer';
    size?: Space;
}) & {
    style?: BlockStyle;
};
export type PageBlockType = PageBlock['type'];
export type BlockOf<T extends PageBlockType> = Extract<PageBlock, {
    type: T;
}>;
export declare const BLOCK_TYPES: PageBlockType[];
/** A page's blocks, one list per language. */
export type PageBlocks = Record<string, PageBlock[]>;
/**
 * What the app and the web get on top of a block, worked out by the API in
 * the page's language (`resolveBlocks`): nothing to compute on the phone.
 */
export interface ResolvedExtras {
    /**
     * event: "14", "Nov", "Friday 14 November 2026", "19:00 – 22:00", the "Add
     * to calendar" link (the API's, which answers what the phone can take; or
     * Google Calendar's), and for a computer the calendars to pick from.
     */
    event?: {
        day: string;
        month: string;
        date: string;
        time: string | null;
        calendarUrl: string | null;
        calendars?: {
            google: string;
            outlook: string;
            file: string;
        } | null;
    };
    /** video: what it is, the picture to show before it plays (YouTube's own when none is given), its player for a web page. */
    video?: {
        provider: 'youtube' | 'vimeo' | 'file' | 'link';
        poster: string | null;
        embedUrl: string | null;
    };
    /** contact: each item's link (`tel:`, `https://wa.me/…`, `mailto:`, the map, the site) and its words. */
    contact?: {
        href: string;
        label: string;
    }[];
    /** details, features: each row's or item's icon, its own or the one its words suggest. */
    icons?: PageIcon[];
    /** map: the link to its directions (Google Maps), and its picture when the leaf has a Google key (`maps.key`). */
    map?: {
        directions: string;
        image: string | null;
    };
}
/** A block as the app gets it. */
export type ResolvedBlock = PageBlock & {
    resolved?: ResolvedExtras;
};
export interface PageTheme {
    /** Above every page on the web, and in the tab's title. */
    brandName?: Localized;
    logoUrl?: string;
    /** Logo height in pixels. Default 28. */
    logoHeight?: number;
    colors?: {
        /** Buttons, links and the notes' bar. */
        primary?: string;
        /** Text on the buttons. */
        onPrimary?: string;
        text?: string;
        /** Secondary text. */
        muted?: string;
        background?: string;
        border?: string;
        /** The notes' background. */
        subtle?: string;
        /** Eyebrows, and the icons of the cards and features. Default primary. */
        accent?: string;
    };
    /**
     * The fonts of the pages (ids of `FONTS`) until the back-office picks
     * others: the app's own, so that the web looks like it.
     */
    fonts?: PageFonts;
    /** What the words are drawn in without a font of `FONTS`. Default the system's. */
    font?: string;
    fontRtl?: string;
    /** Corner radius of the buttons and images, in pixels. Default 12. */
    radius?: number;
    /**
     * How every page opens until the back-office sets another look: its cover
     * photo, its title. A key left out is `DEFAULT_HEAD`'s.
     */
    head?: PageHead;
}
export declare const HEAD_COVERS: readonly ["none", "sm", "md", "lg"];
export declare const HEAD_SIZES: readonly ["sm", "md", "lg", "xl"];
export declare const HEAD_WEIGHTS: readonly ["light", "regular", "medium", "bold"];
/**
 * How a page opens: the record's cover photo across the top (a news' own),
 * then the title and the line under it. Set for every page in the
 * back-office's settings, and page by page: a key a page leaves out is the
 * settings', then the theme's.
 */
export interface PageHead {
    /** The cover's height; `none` leaves it out. A page without a cover has none to show. */
    cover?: (typeof HEAD_COVERS)[number];
    /** The title and the line under it. */
    align?: Align;
    size?: (typeof HEAD_SIZES)[number];
    weight?: (typeof HEAD_WEIGHTS)[number];
    /** In capitals. */
    upper?: boolean;
    color?: PageColor;
    /** A font of `FONTS`; without it, the titles' font. */
    font?: string;
    /** Its font in a right-to-left language (an app's Arabic titles are often another font); without it, `font`. */
    fontRtl?: string;
    /**
     * The title on a sheet that rises over the cover, its top corners rounded,
     * the cover darker at its edges: an app's detail screen. Its record's logo
     * (`page.logo`) sits on the sheet's edge.
     */
    sheet?: boolean;
    /**
     * Without a sheet: its record's logo (`page.logo`) in a big circle, half
     * over the cover's bottom edge, and the title under it cut in two lines in
     * the middle of its words, as an app's place screen.
     */
    logo?: boolean;
    /** This page's own photo across the top, over its record's (a news' photo on the list). A page's only: every page's look has none. */
    photo?: PageImage;
}
/** How a page opens when nothing says otherwise: the look pages had before it could be set. */
export declare const DEFAULT_HEAD: Required<Omit<PageHead, 'font' | 'fontRtl' | 'photo'>>;
/** Claude, writing a page from a few words in the editor ("Write with AI"). Needs the admin leaf's `features.ai`. */
export interface PageAIConfig {
    /** Default the assistant leaf's, else `ANTHROPIC_API_KEY`. */
    apiKey?: string;
    /** Default the assistant leaf's, else `ANTHROPIC_BASE_URL`, else Anthropic's. */
    baseUrl?: string;
    /** Default `claude-opus-5-5`. */
    model?: string;
    /** How long Claude thinks before it writes. Default `low`: the first block comes sooner. */
    effort?: 'low' | 'medium' | 'high' | 'max';
    /** Ask another model when the first declines (`fallbacks: "default"`). Default on, off for Haiku. */
    fallbacks?: boolean;
}
export interface ETHPageLeafConfig {
    /** The languages a page is written in. Default `['en']`. */
    locales?: string[];
    /** Shown when a page has nothing in the language asked. Default the first of `locales`. */
    defaultLocale?: string;
    /** Default `['ar', 'he', 'fa', 'ur']`. */
    rtlLocales?: string[];
    /** The events' times are in it (`Asia/Dubai`): their "Add to calendar" link says so. */
    timezone?: string;
    /**
     * The API's address as phones reach it (`https://api.example.com`): an
     * event's "Add to calendar" goes through it, to give an iPhone or a
     * computer the event as a file and an Android phone Google Calendar.
     * Without it the link is Google Calendar's.
     */
    publicUrl?: string;
    /**
     * The media leaf's folder the pages live in: their images, uploaded from
     * the back-office, and their HTML (`<folder>/<slug>/<locale>.html`). It
     * must be one of the media leaf's `public-read` folders. Default `pages`.
     */
    folder?: string;
    /** The HTML's `Cache-Control`: short, so a change shows soon. Default `public, max-age=60`. */
    cacheControl?: string;
    theme?: PageTheme;
    /** Where the back-office lists them. Default the `Content` group. */
    admin?: {
        group?: string;
        order?: number;
        icon?: string;
    };
    /** "Write with AI" in the editor: on when the admin leaf's AI is and a key is found. `false`: off. */
    ai?: PageAIConfig | false;
    /**
     * A map block's picture: Google's Static Maps with this key (a browser key,
     * it is in the page). Without it the web shows Google's map in a frame.
     */
    maps?: {
        key?: string;
    };
    /**
     * The project's own ready-made pages, written in code: first among the
     * editor's templates, every language's blocks and how the page opens. A
     * picture left empty is one to add.
     */
    templates?: PageReadyMade[];
}
/** A page the project wrote in code to start others from. */
export interface PageReadyMade {
    /** Stays the same: the back-office keys it. */
    id: string;
    name: string;
    /** A line under its name. */
    description?: string;
    blocks: Partial<Record<string, PageBlock[]>>;
    head?: PageHead;
}
/** Not `pages`: the back-office's own pages are at `/pages/<page>`. */
export declare const COLLECTION = "content-pages";
export declare const BLOCKS_TYPE = "page-blocks";
/** The `html` column on the back-office: the links of each language, to open or copy. */
export declare const LINKS_TYPE = "page-links";
/**
 * A field of another collection whose content is a page (a news' text): its
 * blocks are written in that record's form, like a file in a media field, and
 * the page is saved and deleted with the record. The column keeps its id.
 */
export declare const PAGE_TYPE = "page";
/** What a `page` field says next to its type: `{ name: 'page_id', type: 'page', page: { title: 'title' } }`. */
export interface PageFieldOptions {
    /** The record's column the page's title comes from. Default `title`. */
    title?: string;
    /** The record's column the line under the title comes from. None by default. */
    summary?: string;
    /** The record's column with its cover photo (a media field): above the title, across the page. None by default. */
    cover?: string;
    /** The record's column with its logo (a media field): on the edge of a `sheet` head, or over the cover with the head's `logo`. None by default. */
    logo?: string;
}
declare module '../../ETHAdminLeaf/features/ActionRegistry.js' {
    interface FieldDefinition {
        page?: PageFieldOptions;
    }
}
/** The agent's name wherever a person reads it: the errors of Write with AI. */
export declare const AGENT_NAME = "DLS Assistant";
export declare class PageError extends Error {
    status: number;
    constructor(message: string, status?: number);
}
export declare function defaultLocaleOf(config: ETHPageLeafConfig): string;
/** The languages a page is written in, the default one first. */
export declare function localesOf(config: ETHPageLeafConfig): string[];
export declare function rtlOf(config: ETHPageLeafConfig, locale: string): boolean;
export declare function folderOf(config: ETHPageLeafConfig): string;
/** The text in `locale`, else in the default language, else the first one written. */
export declare function localize(text: Localized | undefined | null, locale: string, fallback: string): string;
/** `ar-AE,ar;q=0.9` → `ar`. */
export declare function languageOf(value: unknown): string | null;
export declare function languageName(locale: string): string;
