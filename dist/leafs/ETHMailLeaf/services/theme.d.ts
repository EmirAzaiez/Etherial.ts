import { COLORS } from './render.js';
import { Align, MailTheme } from './options.js';
export type ColorKey = keyof typeof COLORS;
export declare const COLOR_KEYS: ColorKey[];
/** The theme as the back-office edits it: every field set, texts in every language. */
export interface EditableTheme {
    brandName: Record<string, string>;
    logoUrl: string;
    logoWidth: number;
    logoAlign: Align;
    colors: Record<ColorKey, string>;
    font: string;
    fontRtl: string;
    radius: number;
    footer: Record<string, string>;
    links: {
        label: Record<string, string>;
        url: string;
    }[];
}
/** A theme from the config or the back-office, checked, with every field set. */
export declare function normalizeTheme(input: unknown): EditableTheme;
/** The theme emails go out with: the back-office's when it has one, else the config's. Cached 30 s. */
export declare function activeTheme(): Promise<MailTheme>;
export declare function readTheme(): Promise<{
    locales: string[];
    defaultLocale: string;
    rtlLocales: string[];
    default: EditableTheme;
    custom: {
        updatedAt: Date;
        updatedBy: number;
        brandName: Record<string, string>;
        logoUrl: string;
        logoWidth: number;
        logoAlign: Align;
        colors: Record<ColorKey, string>;
        font: string;
        fontRtl: string;
        radius: number;
        footer: Record<string, string>;
        links: {
            label: Record<string, string>;
            url: string;
        }[];
    };
    defaults: {
        colors: {
            primary: string;
            onPrimary: string;
            text: string;
            muted: string;
            background: string;
            card: string;
            border: string;
            subtle: string;
        };
        font: string;
        fontRtl: string;
        logoWidth: number;
        radius: number;
    };
}>;
export declare function saveTheme(input: unknown, userId: number | null): Promise<{
    locales: string[];
    defaultLocale: string;
    rtlLocales: string[];
    default: EditableTheme;
    custom: {
        updatedAt: Date;
        updatedBy: number;
        brandName: Record<string, string>;
        logoUrl: string;
        logoWidth: number;
        logoAlign: Align;
        colors: Record<ColorKey, string>;
        font: string;
        fontRtl: string;
        radius: number;
        footer: Record<string, string>;
        links: {
            label: Record<string, string>;
            url: string;
        }[];
    };
    defaults: {
        colors: {
            primary: string;
            onPrimary: string;
            text: string;
            muted: string;
            background: string;
            card: string;
            border: string;
            subtle: string;
        };
        font: string;
        fontRtl: string;
        logoWidth: number;
        radius: number;
    };
}>;
export declare function resetTheme(): Promise<{
    locales: string[];
    defaultLocale: string;
    rtlLocales: string[];
    default: EditableTheme;
    custom: {
        updatedAt: Date;
        updatedBy: number;
        brandName: Record<string, string>;
        logoUrl: string;
        logoWidth: number;
        logoAlign: Align;
        colors: Record<ColorKey, string>;
        font: string;
        fontRtl: string;
        radius: number;
        footer: Record<string, string>;
        links: {
            label: Record<string, string>;
            url: string;
        }[];
    };
    defaults: {
        colors: {
            primary: string;
            onPrimary: string;
            text: string;
            muted: string;
            background: string;
            card: string;
            border: string;
            subtle: string;
        };
        font: string;
        fontRtl: string;
        logoWidth: number;
        radius: number;
    };
}>;
