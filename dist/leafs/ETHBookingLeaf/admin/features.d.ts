/**
 * The booking's actions and hooks, on the collections of `collections.ts`.
 * Registered before them: a collection resolves its hooks when it is registered.
 */
export declare const CANCEL_ACTION = "booking:cancel";
export declare function registerBookingActions(adminLeaf: any): void;
export declare function registerBookingHooks(adminLeaf: any): void;
