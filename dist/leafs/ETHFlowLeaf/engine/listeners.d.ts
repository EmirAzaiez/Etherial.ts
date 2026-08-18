export declare function refreshListeners(): Promise<void>;
/** Called whenever a flow is created, changed or removed. */
export declare function invalidateListeners(): void;
/**
 * Before the first refresh every trigger is assumed live: a flow that misses its
 * first event because the cache was empty at boot is a bug nobody can reproduce.
 */
export declare function hasListener(triggerId: string): boolean;
/** True when any of a collection's three lifecycle triggers is in use. */
export declare function collectionHasListener(collection: string): boolean;
export declare function ensureListeners(): Promise<void>;
