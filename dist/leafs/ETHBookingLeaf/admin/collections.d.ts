/** Registers what the project hasn't, each passed through `admin.extend`. */
export declare function registerBookingCollections(adminLeaf: any): void;
/**
 * The accounts' collection is usually the project's own, registered by its
 * `app` module, which runs after every leaf: when the collections above were
 * built it did not exist yet, and a customer stayed a bare id (no email in the
 * list, an id to type in the form). Once every module has run, that id becomes
 * the account it points to.
 */
export declare function linkBookingCustomers(adminLeaf: any): void;
