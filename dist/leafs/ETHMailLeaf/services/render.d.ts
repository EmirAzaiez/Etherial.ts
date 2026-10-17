import { LocalBlock, MailTheme } from './options.js';
export interface RenderInput {
    subject: string;
    preheader?: string;
    blocks: LocalBlock[];
    data: Record<string, unknown>;
    locale: string;
    fallbackLocale: string;
    rtl: boolean;
    theme: MailTheme;
    /** A line under the footer, same syntax as a text block: a campaign's unsubscribe link. */
    notice?: string;
}
export interface RenderedMail {
    subject: string;
    preheader: string;
    html: string;
    text: string;
    locale: string;
    dir: 'ltr' | 'rtl';
    /** `{{variables}}` the email uses that the data left empty: they came out blank. */
    missing: string[];
}
export declare const COLORS: {
    primary: string;
    onPrimary: string;
    text: string;
    muted: string;
    background: string;
    card: string;
    border: string;
    subtle: string;
};
export declare const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
export declare const FONT_RTL = "-apple-system, 'Segoe UI', Tahoma, Arial, sans-serif";
export declare function render(input: RenderInput): RenderedMail;
