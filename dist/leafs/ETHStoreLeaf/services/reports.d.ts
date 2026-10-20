import { StoreName } from './options.js';
export type Metric = 'downloads' | 'redownloads' | 'updates' | 'uninstalls' | 'impressions' | 'page_views' | 'acquisitions' | 'sessions' | 'session_seconds' | 'session_devices' | 'crashes' | 'anrs';
/** What each store's reports give. */
export declare const STORE_METRICS: Record<StoreName, Metric[]>;
/** Apple's, from the people who share their data with developers only: lower than the real ones. */
export declare const STORE_OPT_IN: Record<StoreName, Metric[]>;
export declare class ReportError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string);
}
export interface Range {
    from: string;
    to: string;
    days: number;
    tz: string;
}
export declare function ensurePostgres(): void;
/** `?from=&to=` as calendar days; the last 30 days when not given. Two years at most. */
export declare function rangeOf(query: any): Range;
export declare function overview(query: any): Promise<{
    range: Range;
    stores: {
        store: StoreName;
        label: string;
        public_rating: boolean;
        connected: boolean;
        missing: string[];
        metrics: Metric[];
        opt_in: Metric[];
        app: import("../app.js").StoreAppInfo;
        synced_at: Date;
        syncing: boolean;
        error: string;
        notice: string;
        data_through: string;
        listing_through: any;
        current: Record<Metric, number>;
        previous: Record<Metric, number>;
        active_devices: number;
        active_devices_on: any;
        rating: number;
        ratings_count: number;
        previous_rating: number;
        previous_ratings_count: number;
        sources: any;
        reviews: {
            count: any;
            replied: any;
            average: number;
            stars: any[];
        };
        previous_reviews: {
            count: any;
            replied: any;
            average: number;
            stars: any[];
        };
    }[];
    daily: {
        active_devices: number;
        rating: number;
        ratings: number;
        date: any;
        store: any;
    }[];
    countries: {
        country: string;
        apple: number;
        google: number;
        total: number;
    }[];
    countries_total: number;
}>;
/** GET /admin/stores/reviews: the period's reviews, newest first, a page at a time; `store` and `stars` narrow them. */
export declare function reviewsOf(query: any): Promise<{
    items: any[];
    total: any;
    page: number;
    pages: number;
}>;
