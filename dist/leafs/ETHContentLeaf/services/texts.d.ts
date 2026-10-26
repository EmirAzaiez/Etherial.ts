import { Localized } from './options.js';
/**
 * A text in the default language alone, on one line: the one every other
 * language falls back to, so the one that can't be missing.
 */
export declare function ownText(text: Localized | undefined | null): string;
/**
 * The back-office label of a text the row can't go without: its default
 * language's. Throws, so the back-office shows why it can't be saved.
 */
export declare function requiredLabel(text: Localized | undefined | null, what: string): string;
/** A JSON column's texts, trimmed, the empty ones left out. */
export declare function cleanTexts(text: unknown): Record<string, string>;
/** Empty strings from the back-office's form as null. */
export declare function orNull(value: unknown): string | null;
