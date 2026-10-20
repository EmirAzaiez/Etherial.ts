import type { StoreAppInfo } from '../models/StoreStatus.js';
import { DayMetrics, DayRow, ReviewRow, SourceKey } from './common.js';
import { GoogleServiceAccount, GoogleStoreConfig } from './options.js';
/** The service account from the config: the object, its JSON, or that JSON in base64. */
export declare function serviceAccountOf(c: GoogleStoreConfig): GoogleServiceAccount;
/** `gs://pubsite_prod_rev_0123/stats` → `pubsite_prod_rev_0123`. */
export declare function bucketOf(c: GoogleStoreConfig): string;
/** Play Console writes its reports in UTF-16 with a byte-order mark; older ones in UTF-8. */
export declare function decode(buffer: Buffer): string;
/**
 * A row of the installs report as the leaf counts it. Downloads are the
 * people installing it for the first time; re-downloads the other installs
 * (again, or on one more device); uninstalls the people who removed it
 * from all their devices.
 */
export declare function installsRow(row: Record<string, string>, country: string): DayRow;
/** The days of the two installs files of a month, every country together first. */
export declare function parseInstalls(overview: string, byCountry: string | null): Map<string, DayRow[]>;
/** The ratings file: the average of every rating given up to that day. `NA` on a day nobody had rated yet. */
export declare function parseRatings(csv: string): Map<string, DayMetrics>;
export declare function parseCrashes(csv: string): Map<string, DayMetrics>;
/** The store listing by country: its visitors and the first installs from it, every country together. */
export declare function parseListing(csv: string): Map<string, DayMetrics>;
export declare function googleSource(type: string | undefined): SourceKey;
/** The store listing by traffic source: the first installs, by where they came from. */
export declare function parseSources(csv: string): Map<string, DayMetrics>;
/** A month's reviews: those with words only (a star alone is a rating), the last version of each. */
export declare function parseReviews(csv: string): ReviewRow[];
/** What Play Console wrote for one month (`202610`); null for a report not written yet. */
export interface GoogleMonth {
    installs: Map<string, DayRow[]> | null;
    ratings: Map<string, DayMetrics> | null;
    crashes: Map<string, DayMetrics> | null;
    listing: Map<string, DayMetrics> | null;
    sources: Map<string, DayMetrics> | null;
    reviews: ReviewRow[] | null;
}
export declare function googleMonth(c: GoogleStoreConfig, month: string): Promise<GoogleMonth>;
/** The app's name (as set in Play Console) and the release now on the production track. */
export declare function googleApp(c: GoogleStoreConfig): Promise<StoreAppInfo>;
