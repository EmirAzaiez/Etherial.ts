import { LocalBlock, MailBlock } from './options.js';
/** The project's blocks with every text in `locale`. */
export declare function localizeBlocks(blocks: MailBlock[], locale: string, fallback: string): LocalBlock[];
/** Blocks as the back-office sent them, checked: anything unknown is refused, not dropped. */
export declare function normalizeBlocks(input: unknown): LocalBlock[];
/** The subject or preheader as the back-office sent it. */
export declare function normalizeLine(value: unknown, field: string, required: boolean): string;
/** Every `{{variable}}` a version of an email uses. */
export declare function placeholdersOf(parts: {
    subject: string;
    preheader?: string;
    blocks: LocalBlock[];
}): string[];
