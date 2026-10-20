// ──────────────────────────────────────────────────────────────────────────
// What a project tells the store leaf: where its app is on each store, and
// the keys that open the stores' reports. Every figure comes from those
// reports, but for one: Apple's rating, which only its public page gives
// (the API does not), read with the app's id alone. The back-office is told
// which keys are missing, never the keys.
// ──────────────────────────────────────────────────────────────────────────
export const STORES = ['apple', 'google'];
export const STORE_LABELS = { apple: 'App Store', google: 'Google Play' };
/** The hidden collection of daily rows: exports, and the switch in a role's permissions. */
export const STATS_COLLECTION = 'store-stats';
/** The stores the project lists, in a stable order. */
export function storesOf(config) {
    return STORES.filter((s) => !!config[s]);
}
/** Whether the store's public rating is read with no key: Apple's, once the app is known. Google's comes with its reports. */
export function readsPublicRating(config, store) {
    var _a, _b;
    return store === 'apple' && !!(((_a = config.apple) === null || _a === void 0 ? void 0 : _a.bundleId) || ((_b = config.apple) === null || _b === void 0 ? void 0 : _b.appId));
}
/** The keys still missing before the store's reports can be read, by their config name. */
export function missingKeys(config, store) {
    var _a, _b;
    if (store === 'apple') {
        const c = (_a = config.apple) !== null && _a !== void 0 ? _a : {};
        return [
            !c.bundleId && !c.appId ? 'bundleId' : null,
            !c.issuerId ? 'issuerId' : null,
            !c.keyId ? 'keyId' : null,
            !c.privateKey ? 'privateKey' : null,
            !c.vendorNumber ? 'vendorNumber' : null,
        ].filter((k) => !!k);
    }
    const c = (_b = config.google) !== null && _b !== void 0 ? _b : {};
    return [!c.packageName ? 'packageName' : null, !c.bucket ? 'bucket' : null, !c.serviceAccount ? 'serviceAccount' : null].filter((k) => !!k);
}
export function syncEveryMs(config) {
    const hours = Number(config.syncEveryHours);
    return (Number.isFinite(hours) && hours > 0 ? hours : 6) * 3600 * 1000;
}
export function backfillDays(config) {
    const days = Math.round(Number(config.backfillDays));
    return Number.isFinite(days) && days > 0 ? Math.min(days, 730) : 90;
}
/** A PEM key from what an env var holds: the file, its `\n` escaped, or only the base64 body. */
export function pem(key) {
    var _a;
    const text = key.replace(/\\n/g, '\n').trim();
    if (text.includes('-----BEGIN'))
        return text;
    const body = text.replace(/\s+/g, '');
    return `-----BEGIN PRIVATE KEY-----\n${((_a = body.match(/.{1,64}/g)) !== null && _a !== void 0 ? _a : []).join('\n')}\n-----END PRIVATE KEY-----\n`;
}
