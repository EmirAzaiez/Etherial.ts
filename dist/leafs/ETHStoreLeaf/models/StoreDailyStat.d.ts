import { Model } from 'etherial/components/database/provider';
/**
 * One store, one day, one country — or every country together when `country`
 * is empty. Every figure is the store's own report (null when that store
 * does not give it), except Apple's rating: the public one, read that day.
 * The countries rows hold the downloads only; the rest is on the
 * all-countries row.
 */
export declare class StoreDailyStat extends Model<StoreDailyStat> {
    id: number;
    /** `apple` or `google`. */
    store: string;
    /** The day as the store reports it. */
    date: string;
    /** Two letters (`SA`), or empty for every country together. */
    country: string;
    /** First installs: Apple's first downloads, Google's new users. */
    downloads: number | null;
    /** Installed again by someone who had it: Apple's re-downloads, Google's other installs. */
    redownloads: number | null;
    updates: number | null;
    /** Google: people who removed it from all their devices. Apple: deletions, of the people who share their data only. */
    uninstalls: number | null;
    /** Google only: devices that have it installed that day. */
    active_devices: number | null;
    /** Apple: its public rating, read that day. Google: the average of every rating given up to that day. */
    rating_average: number | null;
    /** Apple only: how many have rated it, from the public page. */
    ratings_count: number | null;
    /** Apple only: the app's icon seen in a list (search results, charts, Today). */
    impressions: number | null;
    /** Apple: product page views. Google: store listing visitors. */
    page_views: number | null;
    /** Of them, the first downloads from that page: Apple's from the product page, Google's store listing acquisitions. */
    acquisitions: number | null;
    /** Apple only, of the people who share their data: how often the app was opened. */
    sessions: number | null;
    /** The sessions' length together, in seconds. */
    session_seconds: number | null;
    /** The devices the sessions came from. */
    session_devices: number | null;
    /** Apple: of the people who share their data only. */
    crashes: number | null;
    /** Google only: "Application Not Responding", the app frozen long enough for Android to offer to close it. */
    anrs: number | null;
    /** The first downloads by where they came from: `{ "search": 12, "browse": 3 }`. */
    sources: Record<string, number> | null;
}
