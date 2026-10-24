export declare const SYNCS_COLLECTION = "external-syncs";
export declare const SYNC_TARGETS_COLLECTION = "external-sync-targets";
/**
 * Lifecycle: afterRun — shows the records sent and the targets in the
 * back-office, with "Resend" and the pause switches. Any leaf may call it; it
 * does it once, and nothing without a target.
 */
export declare function registerSyncAdmin(adminLeaf?: any): void;
