import { Model } from '../database/provider.js';
/** Where a record stands with the outside system it is copied to. */
export declare enum SyncStatus {
    /** A change waits to be sent. */
    PENDING = "pending",
    /** A server is sending it now. */
    SENDING = "sending",
    /** The outside system has the last state. */
    SYNCED = "synced",
    /** The last try failed, another is planned (`next_attempt_at`). */
    FAILED = "failed",
    /** Every try failed: only a new change or "Resend" starts again. */
    BLOCKED = "blocked"
}
/**
 * One record of ours and its copy in an outside system (a Case in Salesforce…):
 * the copy's id, and whether it holds our last state. One row per record and
 * per target, kept after success: the next change reuses its `external_id`.
 */
export declare class ExternalSync extends Model<ExternalSync> {
    id: number;
    /** The registered target: 'cases', 'booking-appointments', 'survey-responses'… */
    target: string;
    /** Our record's primary key. */
    record_id: string;
    /** The copy's id over there, once the first send created it. */
    external_id: string | null;
    status: SyncStatus;
    /** Bumped by every change: a send that ends sees whether a newer one came in meanwhile. */
    version: number;
    /** The fields changed since the last successful send. */
    changes: string[] | null;
    /** Failed tries since the last success or the last change. */
    attempts: number;
    last_error: string | null;
    next_attempt_at: Date | null;
    /** While sending: past it, the server is presumed gone and another may take over. */
    locked_until: Date | null;
    synced_at: Date | null;
    /** The link to the copy (`link` of the target), for the back-office. */
    get external_url(): string | null;
    created_at: Date;
    updated_at: Date;
}
/** One target and whether its sending is on hold. */
export declare class ExternalSyncTarget extends Model<ExternalSyncTarget> {
    id: number;
    target: string;
    label: string | null;
    /** On hold: changes keep queuing, nothing is sent until it is turned off. */
    paused: boolean;
    created_at: Date;
    updated_at: Date;
}
/** Set by the registry: models can't import it without a cycle. */
declare let linker: (target: string, externalId: string) => string | null;
export declare function setExternalLinker(fn: typeof linker): void;
export {};
