import type { Request } from 'express';
/** A text in each language: `{ en: '…', ar: '…' }`, or one text for all. */
export type Localized = string | Record<string, string>;
/**
 * - `languages`: the languages the contents are written in, and those the
 *   app gets, set in the back-office (else `locales`, for good);
 * - `faq`: sections and their questions (Help & FAQ);
 * - `contacts`: the ways to reach the company, and its offices;
 * - `legal`: terms, privacy policy…;
 * - `banners`: the home screen's carousel;
 * - `stories`: full-screen slides behind a bubble;
 * - `versions`: the app's versions on the stores, and what an older one asks.
 */
export type ContentFeature = 'languages' | 'faq' | 'contacts' | 'legal' | 'banners' | 'stories' | 'versions';
export declare const FEATURES: ContentFeature[];
/** Who sees a banner or a story. */
export declare const AUDIENCES: readonly ["everyone", "signed_in", "guests"];
export type Audience = (typeof AUDIENCES)[number];
export declare const CONTACT_KINDS: readonly ["phone", "whatsapp", "email", "website", "instagram", "facebook", "x", "linkedin", "youtube", "tiktok", "snapchat"];
export type ContactKind = (typeof CONTACT_KINDS)[number];
export declare const PLATFORMS: readonly ["ios", "android"];
export type Platform = (typeof PLATFORMS)[number];
export declare const PLATFORM_NAMES: Record<Platform, string>;
/**
 * What an app older than a version does:
 * - `auto`: a banner asks to update when the version is a new major one
 *   (2.0 after 1.x), nothing for a minor one (1.5 after 1.4);
 * - `banner`: a banner asks to update, whatever the version;
 * - `required`: the app is blocked until it is updated.
 */
export declare const PROMPTS: readonly ["auto", "banner", "required"];
export type Prompt = (typeof PROMPTS)[number];
export interface SeedFaqSection {
    title: Localized;
    questions: {
        question: Localized;
        answer: Localized;
    }[];
}
export interface SeedContact {
    kind: ContactKind;
    /** A phone number, an email address, an address on the web. */
    value: string;
    label?: Localized;
    hours?: Localized;
}
export interface SeedOffice {
    name: Localized;
    address?: Localized;
    phone?: string;
    email?: string;
    hours?: Localized;
    latitude?: number;
    longitude?: number;
    map_url?: string;
}
export interface SeedLegal {
    /** `terms`, `privacy`: what the app asks for. */
    slug: string;
    title: Localized;
    /** HTML. */
    body?: Localized;
    /** A page on the project's website, opened instead of the text. */
    url?: Localized;
    version?: string;
}
export interface ETHContentLeafConfig {
    /**
     * The languages the contents are written in. Default `['en']`. With
     * `languages`, those a new server starts with: the back-office's
     * Content › Languages has the say from then on.
     */
    locales?: string[];
    /** Shown when a text has nothing in the language asked. Default the first of `locales`. */
    defaultLocale?: string;
    /** Default `['ar', 'he', 'fa', 'ur']`. */
    rtlLocales?: string[];
    /**
     * The contents this project offers: their tables, collections and routes.
     * Default all of them. Leave out one the project already has its own of,
     * whose route the app calls.
     */
    features?: ContentFeature[];
    /**
     * The media leaf's folder of the banners' and stories' images, uploaded
     * from the back-office. Guests see them: it must be `public-read`.
     * Default `content`.
     */
    folder?: string;
    /** The project's media model, as Sequelize names it. Default `Media`. */
    mediaModel?: string;
    /**
     * Whether the request comes from someone signed in, for the banners and
     * stories of an audience. Default: a valid Bearer token from etherial's
     * auth. A project whose tokens can be revoked (sessions) checks its own.
     */
    signedIn?: (req: Request) => boolean | Promise<boolean>;
    /**
     * The app's page on each store, where the update button leads:
     * `https://apps.apple.com/app/id…`, `https://play.google.com/store/apps/details?id=…`.
     */
    stores?: Partial<Record<Platform, string>>;
    /**
     * What a new server starts with, written on its first boot only: each
     * table is seeded once, while it has never had a row, so a content the
     * team empties stays empty.
     */
    seed?: {
        faq?: SeedFaqSection[];
        contacts?: SeedContact[];
        offices?: SeedOffice[];
        legal?: SeedLegal[];
    };
    /** Where the back-office lists them. Default the `Content` group. */
    admin?: {
        group?: string;
        order?: number;
    };
}
/** The back-office's collections: what goes in a project's `navigation` and in the roles' rights. */
export declare const COLLECTIONS: {
    readonly languages: "content-languages";
    readonly faq: "content-faq";
    readonly faqQuestions: "content-faq-questions";
    readonly contacts: "content-contacts";
    readonly offices: "content-offices";
    readonly legal: "content-legal";
    readonly banners: "content-banners";
    readonly stories: "content-stories";
    readonly storySlides: "content-story-slides";
    readonly versions: "content-app-versions";
};
/**
 * The languages the contents are written in, as the leaf runs them: from the
 * back-office (`languages`), else from the config.
 */
export interface Languages {
    /** Every one, the default first: the back-office's fields. */
    all: string[];
    /** Those the app gets, the default first. The others are being translated. */
    app: string[];
    /** What a text missing in another language falls back to. */
    default: string;
    /** Those written right to left. */
    rtl: string[];
    /** Each one's name, as the app's language picker shows it. */
    names: Record<string, string>;
}
export declare class ContentError extends Error {
    status: number;
    constructor(message: string, status?: number);
}
export declare function defaultLocaleOf(config: ETHContentLeafConfig): string;
/** The languages the contents are written in, the default one first. */
export declare function localesOf(config: ETHContentLeafConfig): string[];
export declare function rtlOf(config: ETHContentLeafConfig, locale: string): boolean;
/** The config's languages, every one in the app. */
export declare function languagesOf(config: ETHContentLeafConfig): Languages;
export declare function featuresOf(config: ETHContentLeafConfig): ContentFeature[];
export declare function folderOf(config: ETHContentLeafConfig): string;
/** The text in `locale`, else in the default language, else the first one written. */
export declare function localize(text: Localized | undefined | null, locale: string, fallback: string): string;
/** A seed's text as a column holds it: `{ <default locale>: text }` for one text. */
export declare function localizedOf(text: Localized | undefined, fallback: string): Record<string, string>;
/**
 * What the back-office shows of a text in its lists and on a card: the
 * default language's, on one line. Its translations are JSON, which the
 * back-office can neither search nor print as a title.
 */
export declare function labelOf(text: Localized | undefined | null, fallback: string): string;
/** `2.10.1` → `[2, 10, 1]`; null for anything but numbers between dots. */
export declare function parseVersion(value: unknown): number[] | null;
/** `1.10.0` > `1.9.2`: a missing part counts as 0. Versions that aren't one compare as 0. */
export declare function compareVersions(a: string, b: string): number;
/** `fr`, `zh`: the codes a language goes by (`languageOf`). */
export declare function isLocale(value: unknown): value is string;
/** `ar-AE,ar;q=0.9` → `ar`. */
export declare function languageOf(value: unknown): string | null;
/** `Privacy Policy` → `privacy-policy`. */
export declare function slugify(text: string): string;
/** The languages the back-office offers to add: each one's name in English, and in itself. */
export declare const LANGUAGES: Record<string, {
    name: string;
    native: string;
}>;
/** In English, for the back-office's messages. */
export declare function languageName(locale: string): string;
/** In itself, on the back-office's language switch and the app's picker. */
export declare function nativeName(locale: string): string;
