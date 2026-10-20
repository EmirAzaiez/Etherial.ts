/** A store said no, or could not be reached: the message is shown to the admins as is. */
export declare class StoreError extends Error {
}
/** One day's downloads in one country, or in all of them when `country` is empty. Left out: that report does not give it. */
export interface DayRow {
    country: string;
    downloads: number | null;
    redownloads: number | null;
    updates: number | null;
    uninstalls?: number | null;
    active_devices?: number | null;
}
/**
 * A day's figures from the other reports, on the all-countries row. Each
 * report replaces its own figures as a whole; what it leaves out stays.
 */
export interface DayMetrics {
    rating_average?: number | null;
    ratings_count?: number | null;
    uninstalls?: number | null;
    impressions?: number | null;
    page_views?: number | null;
    acquisitions?: number | null;
    sessions?: number | null;
    session_seconds?: number | null;
    session_devices?: number | null;
    crashes?: number | null;
    anrs?: number | null;
    sources?: Record<string, number> | null;
}
/** The columns `DayMetrics` may write: the SQL is built from these names only. */
export declare const METRIC_COLUMNS: (keyof DayMetrics)[];
/** A written review, the same fields for both stores. */
export interface ReviewRow {
    review_id: string;
    rating: number;
    title: string | null;
    body: string | null;
    author: string | null;
    territory: string | null;
    language: string | null;
    version: string | null;
    device: string | null;
    written_at: Date;
    reply: string | null;
    replied_at: Date | null;
    url: string | null;
}
/**
 * Where the first downloads came from, in the same words for both stores:
 * the store's search, browsing it, another app, a website (Apple tells them
 * apart; Google says "referral" for both), an ad, or anything else.
 */
export type SourceKey = 'search' | 'browse' | 'app' | 'web' | 'referral' | 'ads' | 'other';
export declare function addTo(counts: Record<string, number>, key: string, n: number): void;
export declare function errorMessage(err: any): string;
/** `fetch`, given up after a while, with a message that says which service did not answer. */
export declare function request(url: string, init?: RequestInit, timeoutMs?: number): Promise<Response>;
/** The rows of a CSV (or a TSV), keyed by its header line. Quoted fields may hold the separator. */
export declare function parseTable(text: string, separator?: string): Record<string, string>[];
/** A number in a report's cell: `1234`, `1,234`, `4.31`. Null when empty, or `NA`. */
export declare function numberOf(value: string | undefined): number | null;
/** A report as the store sends it, gzipped or not. */
export declare function gunzipped(buffer: Buffer): Buffer;
/** The first of the columns that holds a number: reports rename theirs over the years. */
export declare function cell(row: Record<string, string>, ...names: string[]): number | null;
/** `2026-10-18`, `Oct 18, 2026` or `10/18/2026` → `2026-10-18`. */
export declare function dayOf(value: string | undefined): string | null;
/** Empty cells as null, the rest trimmed. */
export declare function textOf(value: string | undefined): string | null;
export declare function shiftDay(day: string, by: number): string;
export declare function todayIn(tz: string): string;
