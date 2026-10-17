/** A text in each language: `{ en: '…', ar: '…' }`, or one text for all. */
export type Localized = string | Record<string, string>;
/** `start` is left in English and right in Arabic; `end` the other way. */
export type Align = 'start' | 'center' | 'end';
/**
 * The pieces an email is made of, top to bottom. Texts take `{{variables}}`,
 * `**bold**` and `[links](https://…)`; a blank line starts a new paragraph.
 * `T` is `Localized` in the project's code, a plain string once a language is
 * picked (and in what the back-office saves, one language at a time).
 */
export type MailBlockOf<T> = {
    type: 'heading';
    text: T;
    align?: Align;
} | {
    type: 'text';
    text: T;
    align?: Align;
    muted?: boolean;
} | {
    type: 'button';
    label: T;
    url: string;
    align?: Align;
    style?: 'primary' | 'outline';
}
/** A code to type somewhere: big, spaced out, always left to right. */
 | {
    type: 'code';
    value: string;
    label?: T;
} | {
    type: 'image';
    src: string;
    alt?: T;
    width?: number;
    url?: string;
    align?: Align;
}
/** A boxed sentence that must not be missed: "Never share this code." */
 | {
    type: 'note';
    text: T;
    tone?: 'info' | 'warning';
}
/** Label / value lines: the date, the place, the reference. */
 | {
    type: 'details';
    rows: {
        label: T;
        value: T;
    }[];
} | {
    type: 'divider';
} | {
    type: 'spacer';
    size?: 'sm' | 'md' | 'lg';
};
export type MailBlock = MailBlockOf<Localized>;
export type LocalBlock = MailBlockOf<string>;
export type MailBlockType = MailBlock['type'];
export declare const BLOCK_TYPES: MailBlockType[];
export interface MailVariable {
    /** What the back-office calls it: "Sign-in code". */
    label?: string;
    /** Shown in previews and test sends instead of real data. */
    example?: string | number;
}
export interface MailDefinition {
    /** Stable id the code sends with: `login_code`. */
    key: string;
    /** What the back-office calls it: "Sign-in code". */
    name: string;
    /** When it leaves, for the back-office: "Sent when a resident signs in by email." */
    description?: string;
    /** Groups the list in the back-office: "Account", "Appointments". */
    category?: string;
    /** The `{{variables}}` the code fills in, with an example each (or just the example). */
    variables?: Record<string, MailVariable | string | number>;
    subject: Localized;
    /** The line inboxes show after the subject. */
    preheader?: Localized;
    blocks: MailBlock[];
    /** `false` keeps the back-office from rewriting it: it can still preview and test it. Default true. */
    editable?: boolean;
}
export interface MailTheme {
    /** Names the sender in the footer, and the logo for those who block images. */
    brandName?: Localized;
    logoUrl?: string;
    /** Logo width in pixels. Default 120. */
    logoWidth?: number;
    logoAlign?: Align;
    colors?: {
        /** Buttons and links. */
        primary?: string;
        /** Text on the buttons. */
        onPrimary?: string;
        text?: string;
        /** Secondary text and the footer. */
        muted?: string;
        /** Around the email. */
        background?: string;
        /** Behind the content. */
        card?: string;
        border?: string;
        /** Behind codes and notes. */
        subtle?: string;
    };
    /** CSS font stack. Arabic and the other right-to-left languages use `fontRtl`. */
    font?: string;
    fontRtl?: string;
    /** Corner radius in pixels. Default 8. */
    radius?: number;
    /** Under the email, small: the company's name and address. Same syntax as a text block. */
    footer?: Localized;
    links?: {
        label: Localized;
        url: string;
    }[];
}
export interface ETHMailLeafConfig {
    emails?: MailDefinition[];
    theme?: MailTheme;
    /** Languages the emails are written in. Default `['en']`. */
    locales?: string[];
    /** Used when no language is asked, or when a text lacks the one asked. Default the first of `locales`. */
    defaultLocale?: string;
    /** Written right to left. Default `['ar', 'fa', 'he', 'ur']`. */
    rtlLocales?: string[];
    /** A person's language, when `send()` is given a user and no locale. */
    locale?: (user: any) => string | null | undefined | Promise<string | null | undefined>;
    /** ETHPulseLeaf email provider to send with. Default Pulse's default. */
    provider?: string;
    /** Sender, `"Brand" <no-reply@brand.com>`. Default the provider's. */
    from?: string;
    replyTo?: string;
    /** Emails written in the back-office and sent to an audience. Off without it. */
    campaigns?: MailCampaignsConfig;
}
/** Who a campaign can go to: "All residents", "Segment: Villa owners". */
export interface MailAudience {
    /** Stable id the campaign keeps: `all`, `segment:12`. */
    key: string;
    label: string;
    description?: string;
    /** Groups the back-office's list: "Segments". */
    group?: string;
}
/** One person a campaign goes to. */
export interface MailRecipient {
    email: string;
    /** Files the email in the person's message log. */
    userId?: number | null;
    /** Their language. Else the config's `locale(user)`, else the default language. */
    locale?: string | null;
    user?: any;
    /** What fills their `{{variables}}`: `{ first_name: 'Sara' }`. */
    data?: Record<string, unknown>;
}
export interface MailCampaignsConfig {
    /** The audiences the back-office offers. Read each time it opens a campaign. */
    audiences: () => MailAudience[] | Promise<MailAudience[]>;
    /** The people in an audience, when a campaign leaves (and to count them). */
    recipients: (audience: string) => MailRecipient[] | Promise<MailRecipient[]>;
    /** What a recipient's `data` holds, for the editor: `{ first_name: { label: 'First name', example: 'Sara' } }`. */
    variables?: Record<string, MailVariable | string | number>;
    /**
     * The API's public address, for the unsubscribe links: `https://api.example.com`.
     * Default: the address the back-office reached the API at when it scheduled the campaign.
     */
    publicUrl?: string;
    /** Emails sent per minute at most, all campaigns together: an SMTP server limits it (Office 365: 30). Default 60. */
    perMinute?: number;
    /** The line at the bottom of every campaign email. `{{unsubscribe_url}}` is the link. */
    unsubscribeText?: Localized;
}
export declare const TEMPLATES_COLLECTION = "mail-templates";
export declare const CAMPAIGNS_COLLECTION = "mail-campaigns";
export declare const DEFAULT_RTL: string[];
/** An error the back-office routes turn into `{ status, errors: [code] }`. */
export declare class MailError extends Error {
    code: string;
    status: number;
    constructor(code: string, status?: number, message?: string);
}
export declare function localesOf(config: ETHMailLeafConfig): {
    locales: string[];
    defaultLocale: string;
    rtlLocales: string[];
};
/** The text in `locale`, else in the default language, else the first one written. */
export declare function localize(text: Localized | undefined | null, locale: string, fallback: string): string;
/** `ar-SA`, `AR`, `ar_SA` → `ar`. */
export declare function languageOf(value: unknown): string | null;
/** One of the configured languages, else the default one. */
export declare function pickLocale(config: ETHMailLeafConfig, ...candidates: unknown[]): string;
export declare function isRtl(config: ETHMailLeafConfig, locale: string): boolean;
export declare function variablesOf(definition: MailDefinition): {
    name: string;
    label: string;
    example: string;
}[];
export declare function examplesOf(definition: MailDefinition): Record<string, string>;
