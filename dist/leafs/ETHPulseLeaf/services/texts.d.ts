export type PulseLocalized = string | Record<string, string>;
export interface PulseTextVariable {
    label?: string;
    example?: string | number;
}
export interface PulseTextDefinition {
    /** Stable id the code sends with: `appointment.confirmed`. */
    key: string;
    /** What the back-office shows: "Appointment confirmed". */
    name: string;
    /** When it is sent. */
    description?: string;
    /** Groups the back-office's list: "Appointments". */
    category?: string;
    /** Where it shows, for the back-office's preview. Default `push`. */
    channel?: 'push' | 'sms' | 'inbox';
    /** What the code fills in: `{ time: { label: 'Appointment time', example: 'Sun 12 Oct, 10:00' } }`. */
    variables?: Record<string, PulseTextVariable | string | number>;
    /** The code's text, in each language. `{{variable}}` is filled at send time. */
    text: PulseLocalized;
    /** Longest text the back-office accepts. Default 240 (a push shows about 180). */
    maxLength?: number;
    /** false: read in the back-office, changed only in the code. */
    editable?: boolean;
}
export interface PulseTextsConfig {
    /** Languages the texts are written in. The first is the default. */
    locales: string[];
    defaultLocale?: string;
    /** Written right to left. Default `['ar', 'fa', 'he', 'ur']`. */
    rtlLocales?: string[];
    /** A person's language, when `text()` is given a user and no locale. */
    locale?: (user: any) => string | null | undefined | Promise<string | null | undefined>;
    items: PulseTextDefinition[];
}
export declare class PulseTextError extends Error {
    code: string;
    status: number;
    constructor(code: string, status?: number, message?: string);
}
export declare const TEXTS_COLLECTION = "pulse-texts";
export declare function setTextsConfig(input: PulseTextsConfig | undefined): void;
export declare function textsEnabled(): boolean;
export declare function textLocales(): {
    locales: string[];
    defaultLocale: string;
    rtlLocales: string[];
};
/**
 * The text a notification goes out with: the back-office's for that language
 * when it has one, else the code's. The language is `locale`, else the
 * user's, else the default one.
 */
export declare function pulseText(key: string, input?: {
    user?: any;
    locale?: string | null;
    data?: Record<string, unknown>;
}): Promise<string>;
export declare function listTexts(): Promise<{
    locales: string[];
    defaultLocale: string;
    rtlLocales: string[];
    items: {
        key: string;
        name: string;
        description: string;
        category: string;
        channel: "push" | "sms" | "inbox";
        variables: {
            name: string;
            label: string;
            example: string;
        }[];
        maxLength: number;
        editable: boolean;
        texts: {
            [k: string]: {
                default: string;
                custom: string;
                updatedAt: Date;
                updatedBy: {
                    id: number;
                    name: string;
                };
                /** The code's text changed since this one was saved. */
                outdated: boolean;
            };
        };
    }[];
}>;
export declare function saveText(key: string, body: any, userId: number | null): Promise<{
    locales: string[];
    defaultLocale: string;
    rtlLocales: string[];
    items: {
        key: string;
        name: string;
        description: string;
        category: string;
        channel: "push" | "sms" | "inbox";
        variables: {
            name: string;
            label: string;
            example: string;
        }[];
        maxLength: number;
        editable: boolean;
        texts: {
            [k: string]: {
                default: string;
                custom: string;
                updatedAt: Date;
                updatedBy: {
                    id: number;
                    name: string;
                };
                /** The code's text changed since this one was saved. */
                outdated: boolean;
            };
        };
    }[];
}>;
export declare function resetText(key: string, localeInput: unknown): Promise<{
    locales: string[];
    defaultLocale: string;
    rtlLocales: string[];
    items: {
        key: string;
        name: string;
        description: string;
        category: string;
        channel: "push" | "sms" | "inbox";
        variables: {
            name: string;
            label: string;
            example: string;
        }[];
        maxLength: number;
        editable: boolean;
        texts: {
            [k: string]: {
                default: string;
                custom: string;
                updatedAt: Date;
                updatedBy: {
                    id: number;
                    name: string;
                };
                /** The code's text changed since this one was saved. */
                outdated: boolean;
            };
        };
    }[];
}>;
