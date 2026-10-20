import { DayMetrics, DayRow, ReviewRow } from './common.js';
import { ETHStoreLeafConfig, StoreName } from './options.js';
/** Past this, a sync that never said it ended is taken for dead (its server stopped). */
export declare const SYNC_TTL_MS: number;
/** The first day kept: `backfill` days back from yesterday, `limit` at most. */
export declare function firstDay(backfill: number, limit?: number): string;
/**
 * The days to ask for, oldest first: the last week (from the last day with a
 * report, if the server was off longer), and the days never asked for.
 */
export declare function daysToRead(status: {
    backfilled_from: string | null;
    data_through: string | null;
} | null, backfill: number, limit: number): string[];
/** One store's day of downloads, as the report gives it: the countries no longer in it go. */
export declare function writeDay(store: StoreName, day: string, rows: DayRow[]): Promise<void>;
/** A day's figures from one report, on the all-countries row: those it gives replace theirs, the rest stay. */
export declare function writeMetrics(store: StoreName, day: string, metrics: DayMetrics): Promise<void>;
/** The reviews as the store has them now: a new one is added, one read before takes its edits and its reply. */
export declare function upsertReviews(store: StoreName, reviews: ReviewRow[]): Promise<void>;
/** Whether a sync has anything to read for the store: its keys, or Apple's public rating. */
export declare function readsSomething(config: ETHStoreLeafConfig, store: StoreName): boolean;
/**
 * Syncs the stores due — their last sync older than `syncEveryHours` — or
 * all of them with `force`. One server at a time: false when another one is
 * already at it.
 */
export declare function syncStores({ force, only }?: {
    force?: boolean;
    only?: StoreName;
}): Promise<boolean>;
