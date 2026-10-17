/** `https://api…/mail/unsubscribe?e=…&t=…`: the link at the bottom of a campaign email. */
export declare function unsubscribeUrl(base: string, email: string, campaignId: number | null, locale: string): Promise<string>;
/** The address a link was signed for, or null. */
export declare function emailFromLink(query: any): Promise<string | null>;
export declare function isUnsubscribed(email: string): Promise<boolean>;
/** Which of these addresses unsubscribed. */
export declare function unsubscribedAmong(emails: string[]): Promise<Set<string>>;
/** Records it once; the campaign whose link was used counts it. */
export declare function unsubscribe(email: string, campaignInput: unknown): Promise<void>;
type PageState = 'confirm' | 'done' | 'invalid';
/** The footer line of a campaign email, when the config doesn't write one. */
export declare const DEFAULT_UNSUBSCRIBE_TEXT: Record<string, string>;
export declare function unsubscribeNotice(locale: string): string;
/** A small page in the brand's colors, in the person's language. */
export declare function unsubscribePage(pageState: PageState, query: any, email: string | null): Promise<string>;
export {};
