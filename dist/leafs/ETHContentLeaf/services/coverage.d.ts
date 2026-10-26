import type { Transaction } from 'sequelize';
/**
 * What would have no text in `locale` were it the default language: each
 * kind of row, and how many. A published legal document needs its text or
 * its page too.
 */
export declare function missingIn(locale: string): Promise<{
    what: string;
    count: number;
}[]>;
/** Each row's `label` in its `locale` text, once it is the default language. Not a change of the row: no hook, same `updated_at`. */
export declare function relabel(locale: string, transaction?: Transaction): Promise<number>;
