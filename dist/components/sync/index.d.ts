import { ExternalSync, SyncStatus } from './models.js';
export { ExternalSync, ExternalSyncTarget, SyncStatus } from './models.js';
export { registerSyncAdmin, SYNCS_COLLECTION, SYNC_TARGETS_COLLECTION } from './admin.js';
/**
 * Sending our records to an outside system (a Case to Salesforce…), when we
 * are the master and the other side only gets a copy.
 *
 * The project writes the send — what to create or update over there, with its
 * own client — and a leaf registers it as a target. This decides when: after
 * the commit of each create and update, then retries at 1 min, 5 min, 30 min,
 * 2 h and 6 h, after which the record is blocked until it changes again or
 * staff resend it. Only the last state goes out, with the fields changed
 * since the last success, and never twice at once for the same record, across
 * servers. Each record's place lives in `external_syncs`, shown in the
 * back-office with its error, a Resend button and a pause per target.
 *
 *     registerSync('cases', {
 *         model: 'Case',
 *         label: 'Salesforce',
 *         send: async (ticket, { externalId, changes, remember }) => { … return { externalId: id } },
 *         link: (id) => `https://example.my.salesforce.com/${id}`,
 *     })
 *
 * Nothing is registered, nothing is created: no table, no timer.
 */
export interface SyncContext {
    /** The copy's id over there; null on the first send, which creates it. */
    externalId: string | null;
    /** The fields changed since the last success; [] when staff resend it. */
    changes: string[];
    /** 1 on the first try of this state, 2 on the first retry… */
    attempt: number;
    /**
     * Keeps the copy's id right away, before the rest of the send: a send
     * that creates the copy then fails further on finds it on the retry,
     * instead of creating a second one.
     */
    remember(externalId: string): Promise<void>;
}
export interface SyncResult {
    /** The copy's id over there; left out, the one known is kept. */
    externalId?: string | null;
}
export interface TrackOptions {
    /** Only changes to these fields are sent (default: any field). */
    fields?: string[];
    /** Changes to these fields alone are not sent (timestamps never are). */
    ignore?: string[];
    /** Only records it accepts are sent, read after the commit. */
    when?: (record: any) => boolean;
}
export interface SyncTarget<R = any> {
    /** The model sent: its name in Sequelize, or a function returning it. */
    model: string | (() => any);
    /**
     * Sends the record's whole current state. Throws on failure: the error
     * is kept and the send retried. It may save the record (the copy's id in
     * a column of its own): that save is not sent back.
     */
    send: (record: R, context: SyncContext) => Promise<SyncResult | void>;
    /** The copy's address over there, for the back-office's link. */
    link?: (externalId: string) => string | null;
    /** The outside system's name, for the back-office: "Salesforce". */
    label?: string;
    /** Which saves are sent (default: every create and update); `false` sends only what the code queues. */
    track?: TrackOptions | false;
}
/**
 * A leaf's `sync` option: the project's send, the leaf deciding which saves
 * go out. Without it, the leaf sends nothing.
 */
export interface LeafSync<R = any> {
    send: SyncTarget<R>['send'];
    link?: SyncTarget<R>['link'];
    /** The outside system's name, for the back-office: "Salesforce". */
    label?: string;
}
export type SyncOutcome = {
    status: SyncStatus;
    externalId?: string | null;
    error?: string;
}
/** Another server is sending it, or it isn't due. */
 | {
    status: 'skipped';
} | {
    status: 'paused';
};
/** The waits after each failed try; one more failure than there are waits blocks it. */
export declare const SYNC_RETRY_DELAYS_MS: number[];
/**
 * Declares a target. Called before the database runs (a leaf's beforeRun):
 * the first one hands it the sync tables.
 */
export declare function registerSync<R = any>(target: string, config: SyncTarget<R>): void;
/** Whether `target` is registered: a leaf without its `sync` option sends nothing. */
export declare function hasSyncTarget(target: string): boolean;
export declare function syncTargets(): {
    target: string;
    label: string;
}[];
/**
 * Runs `fn` without sending what it saves: the changes that came from the
 * outside system itself (Salesforce's own edits), which must not echo back.
 */
export declare function withoutSync<T>(fn: () => T): T;
/**
 * Sends `target`'s creates and updates once committed. `registerSync`'s
 * `track` does it for the leafs (`startSync`); a project calls it for a
 * target it registered with `track: false`. Saves passing `{ sync: false }`
 * and those inside `withoutSync` are not sent, nor bulk updates (no hooks).
 */
export declare function trackSync(target: string, options?: TrackOptions): void;
/**
 * Queues the record's current state, then tries it at once (unless
 * `attempt: false`). A record already queued keeps a single place: its
 * changes add up, its tries start over.
 */
export declare function enqueueSync(target: string, recordId: string | number, changes?: string[], options?: {
    attempt?: boolean;
}): Promise<void>;
/**
 * Sends the record if it is due and no one else is sending it. Resolves
 * with where it stands; never throws for the send itself.
 */
export declare function attemptSync(target: string, recordId: string | number): Promise<SyncOutcome>;
/**
 * Sends the record again now from its current state, whatever its status
 * (staff's "Resend"): a blocked one gets its tries back, a synced one is sent
 * whole. Queues it first if it never was.
 */
export declare function resendSync(target: string, recordId: string | number): Promise<SyncOutcome>;
/** Where each of these records stands with `target`, by record id. */
export declare function syncStatesOf(target: string, recordIds: (string | number)[]): Promise<Map<string, ExternalSync>>;
/** One row per target, for the back-office's pause switches. */
export declare function ensureSyncTargets(): Promise<void>;
/**
 * Lifecycle: run — hooks each registered target's saves and starts the
 * minute timer for retries. Any leaf may call it; it does it once.
 */
export declare function startSync(): void;
