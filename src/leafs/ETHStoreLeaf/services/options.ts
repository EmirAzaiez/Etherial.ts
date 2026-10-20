// ──────────────────────────────────────────────────────────────────────────
// What a project tells the store leaf: where its app is on each store, and
// the keys that open the stores' reports. Every figure comes from those
// reports, but for one: Apple's rating, which only its public page gives
// (the API does not), read with the app's id alone. The back-office is told
// which keys are missing, never the keys.
// ──────────────────────────────────────────────────────────────────────────

export type StoreName = 'apple' | 'google'

export const STORES: StoreName[] = ['apple', 'google']

export const STORE_LABELS: Record<StoreName, string> = { apple: 'App Store', google: 'Google Play' }

/** The hidden collection of daily rows: exports, and the switch in a role's permissions. */
export const STATS_COLLECTION = 'store-stats'

export interface AppleStoreConfig {
    /** The app's bundle id: `com.example.app`. Its App Store id is found from it. */
    bundleId?: string
    /** The App Store id (`6477343500`), to skip that lookup. */
    appId?: string
    /** App Store Connect › Users and Access › Integrations › App Store Connect API: the issuer id above the keys. */
    issuerId?: string
    /**
     * The key's id, from the same page. The key needs the Admin role: Sales
     * reads the downloads, but only an Admin key may ask Apple for the
     * analytics reports (page views, sources, sessions, deletions, crashes).
     */
    keyId?: string
    /** The `.p8` file, as is, with `\n` for its line breaks, or only its base64 body. */
    privateKey?: string
    /** App Store Connect › Payments and Financial Reports, under the account's name: `8xxxxxxx`. */
    vendorNumber?: string
    /** The storefronts whose public rating is read and added up: `['sa', 'ae']`. Default `['us']`. */
    countries?: string[]
}

export interface GoogleServiceAccount {
    client_email: string
    private_key: string
    token_uri?: string
}

export interface GoogleStoreConfig {
    /** The app's package name: `com.example.app`. */
    packageName?: string
    /** Play Console › Download reports › Statistics › Copy Cloud Storage URI: `gs://pubsite_prod_rev_0123…`. */
    bucket?: string
    /**
     * The service account's JSON key: the object, the JSON text, or that text
     * in base64. Invited in Play Console › Users and permissions with "View
     * app information and download bulk reports". The app's name and version
     * also need the Google Play Developer Reporting API turned on in the
     * account's Google Cloud project.
     */
    serviceAccount?: string | GoogleServiceAccount
}

export interface ETHStoreLeafConfig {
    apple?: AppleStoreConfig
    google?: GoogleStoreConfig
    /** Where "today" is for the back-office's periods. Default `UTC`. */
    timezone?: string
    /** Hours between two syncs. Default 6. */
    syncEveryHours?: number
    /** Days read back the first time. Default 90; Apple keeps its daily sales reports a year. */
    backfillDays?: number
}

/** The stores the project lists, in a stable order. */
export function storesOf(config: ETHStoreLeafConfig): StoreName[] {
    return STORES.filter((s) => !!config[s])
}

/** Whether the store's public rating is read with no key: Apple's, once the app is known. Google's comes with its reports. */
export function readsPublicRating(config: ETHStoreLeafConfig, store: StoreName): boolean {
    return store === 'apple' && !!(config.apple?.bundleId || config.apple?.appId)
}

/** The keys still missing before the store's reports can be read, by their config name. */
export function missingKeys(config: ETHStoreLeafConfig, store: StoreName): string[] {
    if (store === 'apple') {
        const c = config.apple ?? {}
        return [
            !c.bundleId && !c.appId ? 'bundleId' : null,
            !c.issuerId ? 'issuerId' : null,
            !c.keyId ? 'keyId' : null,
            !c.privateKey ? 'privateKey' : null,
            !c.vendorNumber ? 'vendorNumber' : null,
        ].filter((k): k is string => !!k)
    }
    const c = config.google ?? {}
    return [!c.packageName ? 'packageName' : null, !c.bucket ? 'bucket' : null, !c.serviceAccount ? 'serviceAccount' : null].filter(
        (k): k is string => !!k
    )
}

export function syncEveryMs(config: ETHStoreLeafConfig): number {
    const hours = Number(config.syncEveryHours)
    return (Number.isFinite(hours) && hours > 0 ? hours : 6) * 3600 * 1000
}

export function backfillDays(config: ETHStoreLeafConfig): number {
    const days = Math.round(Number(config.backfillDays))
    return Number.isFinite(days) && days > 0 ? Math.min(days, 730) : 90
}

/** A PEM key from what an env var holds: the file, its `\n` escaped, or only the base64 body. */
export function pem(key: string): string {
    const text = key.replace(/\\n/g, '\n').trim()
    if (text.includes('-----BEGIN')) return text
    const body = text.replace(/\s+/g, '')
    return `-----BEGIN PRIVATE KEY-----\n${(body.match(/.{1,64}/g) ?? []).join('\n')}\n-----END PRIVATE KEY-----\n`
}
