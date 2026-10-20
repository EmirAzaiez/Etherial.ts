import type { StoreAppInfo } from '../models/StoreStatus.js';
import { DayRow, ReviewRow, StoreError } from './common.js';
import { AppleStoreConfig } from './options.js';
export declare const API = "https://api.appstoreconnect.apple.com/v1";
/** A bearer for App Store Connect: ES256, valid 20 minutes at most — this one 15. */
export declare function appleToken(c: AppleStoreConfig): string;
/** A bearer that renews itself: a long sync outlives one token. */
export declare function appleBearer(c: AppleStoreConfig): () => string;
export declare function appleError(res: Response): Promise<string>;
/** What Apple's refusal means, for the admins. `what` names what was asked: "the reviews". */
export declare function appleRefusal(res: Response, what: string): Promise<StoreError>;
/** A GET on App Store Connect: a path (`/apps/…`) or a `links.next` it gave. */
export declare function appleGet(url: string, bearer: () => string, what: string): Promise<any>;
/** Every page of a list, `maxPages` at most. */
export declare function appleList(path: string, bearer: () => string, what: string, maxPages?: number): Promise<{
    data: any[];
    included: any[];
}>;
/**
 * The public rating on the storefronts listed, weighted by how many rated in
 * each: Apple counts them per country. Null when none of them has the app.
 */
export declare function applePublicRating(c: AppleStoreConfig): Promise<{
    rating: number | null;
    ratings_count: number;
} | null>;
/**
 * The app as App Store Connect has it: its id (found from the bundle id when
 * not given), its name, and the version on sale with its build's icon.
 */
export declare function appleApp(c: AppleStoreConfig, bearer: () => string): Promise<StoreAppInfo>;
/**
 * The written reviews, newest first, down to `since` (a few days before the
 * newest one kept, to see edits and replies), or `FIRST_REVIEW_PAGES` pages
 * the first time. A rating with no text is not a review: Apple lists none.
 */
export declare function appleReviews(appId: string, bearer: () => string, since: Date | null): Promise<ReviewRow[]>;
/** `SAU` → `SA`, as the sales reports name countries. */
export declare function territoryOf(code: string | undefined): string | null;
export declare function appleReviewRow(review: any, responses: Map<string, any>): ReviewRow | null;
/**
 * One day of the vendor's sales summary, kept to the app: its rows by
 * country, and every country together. Null when Apple has not put the day
 * out yet (the day after, in the morning, Pacific time).
 */
export declare function appleSalesDay(c: AppleStoreConfig, appId: string, day: string, token: string): Promise<DayRow[] | null>;
/** A sales summary's units for the app, by country and in all: first downloads, re-downloads, updates. */
export declare function parseSales(tsv: string, appId: string): DayRow[];
