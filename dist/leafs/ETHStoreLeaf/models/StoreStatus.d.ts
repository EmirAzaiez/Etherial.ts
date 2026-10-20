import { Model } from 'etherial/components/database/provider';
/** The app as the store's API describes it, kept from the last read. */
export interface StoreAppInfo {
    id: string | null;
    name: string | null;
    icon: string | null;
    url: string | null;
    /** The version on sale. */
    version: string | null;
}
/** Where the leaf stands with the store's reports between two syncs: never shown. */
export interface StoreCursor {
    /** Apple: the analytics report requests the leaf reads: the daily one, and the history. */
    ongoing?: string;
    snapshot?: string;
    /** Apple: per request and report (`ongoing:downloads`), the processing date read last. */
    read?: Record<string, string>;
    /** Apple: per report, the first day the daily request gave: the history is kept to the days before it. */
    covered?: Record<string, string>;
    /** Apple: the first day kept when the history was read: reading further back reads it again. */
    since?: string;
}
/** Where each store's sync stands: one row per store, shared by every server. */
export declare class StoreStatus extends Model<StoreStatus> {
    store: string;
    /** The last sync that ended, well or not. */
    synced_at: Date | null;
    /** Set while a sync runs: the back-office shows it, and asks again. */
    sync_started_at: Date | null;
    /** What went wrong in the last sync; null when it went through. */
    error: string | null;
    /** Not an error: what the admins should know, such as reports Apple is still preparing. */
    notice: string | null;
    /** The last day the store had a downloads report for. */
    data_through: string | null;
    /** The first day asked for: reading back further later starts from there. */
    backfilled_from: string | null;
    app: StoreAppInfo | null;
    cursor: StoreCursor | null;
}
