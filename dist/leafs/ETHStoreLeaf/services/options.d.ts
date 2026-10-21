export type StoreName = 'apple' | 'google';
export declare const STORES: StoreName[];
export declare const STORE_LABELS: Record<StoreName, string>;
/** The hidden collection of daily rows: exports, and the switch in a role's permissions. */
export declare const STATS_COLLECTION = "store-stats";
export interface AppleStoreConfig {
    /** The app's bundle id: `com.example.app`. Its App Store id is found from it. */
    bundleId?: string;
    /** The App Store id (`6477343500`), to skip that lookup. */
    appId?: string;
    /** App Store Connect › Users and Access › Integrations › App Store Connect API: the issuer id above the keys. */
    issuerId?: string;
    /**
     * The key's id, from the same page. The key needs the Admin role: Sales
     * reads the downloads, but only an Admin key may ask Apple for the
     * analytics reports (page views, sources, sessions, deletions, crashes).
     */
    keyId?: string;
    /** The `.p8` file, as is, with `\n` for its line breaks, or only its base64 body. */
    privateKey?: string;
    /** App Store Connect › Payments and Financial Reports, under the account's name: `8xxxxxxx`. */
    vendorNumber?: string;
    /** The storefronts whose public rating is read and added up: `['sa', 'ae']`. Default `['us']`. */
    countries?: string[];
}
export interface GoogleServiceAccount {
    client_email: string;
    private_key: string;
    token_uri?: string;
}
/** A person's Google account, signed in once: what `gcloud auth application-default login` saves. */
export interface GoogleUserAccount {
    client_id: string;
    client_secret: string;
    refresh_token: string;
}
export interface GoogleStoreConfig {
    /** The app's package name: `com.example.app`. */
    packageName?: string;
    /** Play Console › Download reports › Statistics › Copy Cloud Storage URI: `gs://pubsite_prod_rev_0123…`. */
    bucket?: string;
    /**
     * The service account's JSON key: the object, the JSON text, or that text
     * in base64. Invited in Play Console › Users and permissions with "View
     * app information and download bulk reports". The app's name and version
     * also need the Google Play Developer Reporting API turned on in the
     * account's Google Cloud project.
     */
    serviceAccount?: string | GoogleServiceAccount;
    /**
     * A person's Google account that reads the bucket in place of the service
     * account, for when Play Console never opens it to the service account:
     * the file `gcloud auth application-default login` writes (`authorized_user`),
     * as the object, the JSON text or that text in base64. Invited in Play
     * Console with the same permission. The service account still reads the
     * app's name and version.
     */
    reportsAccount?: string | GoogleUserAccount;
}
export interface ETHStoreLeafConfig {
    apple?: AppleStoreConfig;
    google?: GoogleStoreConfig;
    /** Where "today" is for the back-office's periods. Default `UTC`. */
    timezone?: string;
    /** Hours between two syncs. Default 6. */
    syncEveryHours?: number;
    /** Days read back the first time. Default 90; Apple keeps its daily sales reports a year. */
    backfillDays?: number;
}
/** The stores the project lists, in a stable order. */
export declare function storesOf(config: ETHStoreLeafConfig): StoreName[];
/** Whether the store's public rating is read with no key: Apple's, once the app is known. Google's comes with its reports. */
export declare function readsPublicRating(config: ETHStoreLeafConfig, store: StoreName): boolean;
/** The keys still missing before the store's reports can be read, by their config name. */
export declare function missingKeys(config: ETHStoreLeafConfig, store: StoreName): string[];
export declare function syncEveryMs(config: ETHStoreLeafConfig): number;
export declare function backfillDays(config: ETHStoreLeafConfig): number;
/** A PEM key from what an env var holds: the file, its `\n` escaped, or only the base64 body. */
export declare function pem(key: string): string;
