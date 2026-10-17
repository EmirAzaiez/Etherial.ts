import { RenderedMail } from './render.js';
import { LocalBlock, MailDefinition, MailTheme } from './options.js';
export interface MailVersion {
    subject: string;
    preheader: string;
    blocks: LocalBlock[];
}
export interface SendInput {
    /** One address or several. */
    to: string | string[];
    /** What fills the `{{variables}}`. */
    data?: Record<string, unknown>;
    /** Wins over the user's language. */
    locale?: string | null;
    /** Gives the language (through the config's `locale`) and the id the message log is filed under. */
    user?: any;
    userId?: number | null;
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string;
    attachments?: any[];
}
export interface SendResult extends RenderedMail {
    key: string;
    sent: boolean;
    messageId?: string;
    error?: string;
}
export declare function definitions(): MailDefinition[];
export declare function definition(key: string): MailDefinition;
/** A language the project writes in, else a 400. */
export declare function checkLocale(locale: unknown): string;
export declare function codeVersion(def: MailDefinition, locale: string): MailVersion;
/** Changes when the code's version of this email changes. */
export declare function hashOf(version: MailVersion): string;
/** The version that goes out: the back-office's when it has one (unless the email is locked), else the code's. */
export declare function activeVersion(def: MailDefinition, locale: string): Promise<{
    version: MailVersion;
    custom: boolean;
}>;
/** `theme` is the one emails go out with (`activeTheme()`), or a draft the back-office previews. */
export declare function renderVersion(version: MailVersion, locale: string, data: Record<string, unknown>, theme: MailTheme, notice?: string): RenderedMail;
/** The language an email goes out in: the one asked, else the person's, else the default. */
export declare function resolveLocale(input: {
    locale?: string | null;
    user?: any;
}): Promise<string>;
export declare function renderMail(key: string, input?: {
    data?: Record<string, unknown>;
    locale?: string | null;
    user?: any;
}): Promise<RenderedMail>;
export declare function pulse(): any;
/** Renders and sends through ETHPulseLeaf, which logs it in the person's timeline. Never throws on a send failure: reads `sent`. */
export declare function sendMail(key: string, input: SendInput, options?: {
    subjectPrefix?: string;
}): Promise<SendResult>;
export declare function listMails(): Promise<{
    key: string;
    name: string;
    description: string;
    category: string;
    editable: boolean;
    subject: string;
    customized: string[];
    outdated: string[];
    updatedAt: Date;
}[]>;
export declare function readMail(key: string, localeInput: unknown): Promise<{
    variables: {
        used: boolean;
        name: string;
        label: string;
        example: string;
    }[];
    /** Written in a version, but the code never fills it in: it will come out blank. */
    unknown: string[];
    key: string;
    name: string;
    description: string;
    category: string;
    editable: boolean;
    locale: string;
    locales: string[];
    defaultLocale: string;
    dir: string;
    default: MailVersion;
    custom: {
        updatedAt: Date;
        updatedBy: number;
        outdated: boolean;
        subject: string;
        preheader: string;
        blocks: LocalBlock[];
    };
}>;
/** A version as the back-office sent it, checked. Missing parts are the code's. */
export declare function draftOf(def: MailDefinition, locale: string, body: any): MailVersion;
/** Renders a draft without saving it, with the examples: what the editor shows as you type. */
export declare function previewMail(key: string, body: any): Promise<{
    unknown: string[];
    subject: string;
    preheader: string;
    html: string;
    text: string;
    locale: string;
    dir: "ltr" | "rtl";
    missing: string[];
}>;
/** An email as it goes out (its saved version, the examples), in a theme the back-office is editing. */
export declare function previewTheme(body: any): Promise<RenderedMail>;
export declare function saveMail(key: string, body: any, userId: number | null): Promise<{
    variables: {
        used: boolean;
        name: string;
        label: string;
        example: string;
    }[];
    /** Written in a version, but the code never fills it in: it will come out blank. */
    unknown: string[];
    key: string;
    name: string;
    description: string;
    category: string;
    editable: boolean;
    locale: string;
    locales: string[];
    defaultLocale: string;
    dir: string;
    default: MailVersion;
    custom: {
        updatedAt: Date;
        updatedBy: number;
        outdated: boolean;
        subject: string;
        preheader: string;
        blocks: LocalBlock[];
    };
}>;
export declare function resetMail(key: string, localeInput: unknown, userId?: number | null): Promise<{
    variables: {
        used: boolean;
        name: string;
        label: string;
        example: string;
    }[];
    /** Written in a version, but the code never fills it in: it will come out blank. */
    unknown: string[];
    key: string;
    name: string;
    description: string;
    category: string;
    editable: boolean;
    locale: string;
    locales: string[];
    defaultLocale: string;
    dir: string;
    default: MailVersion;
    custom: {
        updatedAt: Date;
        updatedBy: number;
        outdated: boolean;
        subject: string;
        preheader: string;
        blocks: LocalBlock[];
    };
}>;
/** The saves and resets of one email in one language, newest first. */
export declare function listVersions(key: string, localeInput: unknown): Promise<{
    id: number;
    action: "save" | "reset";
    subject: string;
    createdAt: Date;
    createdBy: {
        id: number;
        name: string;
    };
    restoredFrom: number;
    /** What goes out now: the newest save, while the back-office's version is in place. */
    current: boolean;
}[]>;
export declare function readVersion(key: string, idInput: unknown): Promise<{
    id: number;
    locale: string;
    action: "save" | "reset";
    subject: string;
    preheader: string;
    blocks: any[];
    createdAt: Date;
    createdBy: {
        id: number;
        name: string;
    };
    restoredFrom: number;
}>;
/** Sends the draft (or the saved version) to one address, with the examples, `[Test]` in front of the subject. */
export declare function testMail(key: string, body: any, fallbackTo: string | null): Promise<{
    sent: boolean;
    to: any;
    subject: string;
    messageId: any;
}>;
