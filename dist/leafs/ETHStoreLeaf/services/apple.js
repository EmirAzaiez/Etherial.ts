// ──────────────────────────────────────────────────────────────────────────
// The App Store, through App Store Connect's API and its key: the app (name,
// version on sale, icon), the daily sales reports (downloads, re-downloads,
// updates, by country), and the written reviews. The analytics reports are
// in appleAnalytics.ts. The rating alone comes from the public lookup: the
// API does not give it.
// ──────────────────────────────────────────────────────────────────────────
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var _a;
import jwt from 'jsonwebtoken';
import { StoreError, gunzipped, parseTable, request, textOf } from './common.js';
import { pem } from './options.js';
export const API = 'https://api.appstoreconnect.apple.com/v1';
// Product Type Identifier: iPhone, universal, iPad, Mac.
const DOWNLOAD_TYPES = new Set(['1', '1F', '1T', 'F1']);
const REDOWNLOAD_TYPES = new Set(['3', '3F', '3T', 'F3']);
const UPDATE_TYPES = new Set(['7', '7F', '7T', 'F7']);
/** Pages of reviews read the first time: 200 a page. */
const FIRST_REVIEW_PAGES = 10;
/** A bearer for App Store Connect: ES256, valid 20 minutes at most — this one 15. */
export function appleToken(c) {
    const now = Math.floor(Date.now() / 1000);
    try {
        return jwt.sign({ iss: c.issuerId, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' }, pem(c.privateKey), {
            algorithm: 'ES256',
            keyid: c.keyId,
        });
    }
    catch (err) {
        throw new StoreError(`The App Store Connect key could not sign: ${(err === null || err === void 0 ? void 0 : err.message) || err} (is it the .p8 file?)`);
    }
}
/** A bearer that renews itself: a long sync outlives one token. */
export function appleBearer(c) {
    let token = { value: appleToken(c), at: Date.now() };
    return () => {
        if (Date.now() - token.at > 10 * 60 * 1000)
            token = { value: appleToken(c), at: Date.now() };
        return token.value;
    };
}
export function appleError(res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const body = yield res.json().catch(() => null);
        const first = (_a = body === null || body === void 0 ? void 0 : body.errors) === null || _a === void 0 ? void 0 : _a[0];
        // Apple's titles end with a full stop: "…are missing or invalid.: Provide…" otherwise.
        return first ? [(_b = first.title) === null || _b === void 0 ? void 0 : _b.replace(/\.$/, ''), first.detail].filter(Boolean).join(': ') : res.statusText;
    });
}
/** What Apple's refusal means, for the admins. `what` names what was asked: "the reviews". */
export function appleRefusal(res, what) {
    return __awaiter(this, void 0, void 0, function* () {
        const detail = yield appleError(res);
        if (res.status === 401)
            return new StoreError(`App Store Connect refused the key: ${detail}`);
        if (res.status === 403)
            return new StoreError(`The App Store Connect key may not read ${what}: give it the Admin role (${detail})`);
        return new StoreError(`App Store Connect answered ${res.status} for ${what}: ${detail}`);
    });
}
/** A GET on App Store Connect: a path (`/apps/…`) or a `links.next` it gave. */
export function appleGet(url, bearer, what) {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield request(url.startsWith('https://') ? url : `${API}${url}`, { headers: { Authorization: `Bearer ${bearer()}` } });
        if (!res.ok)
            throw yield appleRefusal(res, what);
        return res.json();
    });
}
/** Every page of a list, `maxPages` at most. */
export function appleList(path_1, bearer_1, what_1) {
    return __awaiter(this, arguments, void 0, function* (path, bearer, what, maxPages = 20) {
        var _a, _b, _c, _d;
        const data = [];
        const included = [];
        let url = path;
        for (let page = 0; url && page < maxPages; page++) {
            const body = yield appleGet(url, bearer, what);
            data.push(...((_a = body.data) !== null && _a !== void 0 ? _a : []));
            included.push(...((_b = body.included) !== null && _b !== void 0 ? _b : []));
            url = (_d = (_c = body.links) === null || _c === void 0 ? void 0 : _c.next) !== null && _d !== void 0 ? _d : null;
        }
        return { data, included };
    });
}
/**
 * The public rating on the storefronts listed, weighted by how many rated in
 * each: Apple counts them per country. Null when none of them has the app.
 */
export function applePublicRating(c) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const countries = ((_a = c.countries) === null || _a === void 0 ? void 0 : _a.length) ? c.countries : ['us'];
        const which = c.appId ? `id=${encodeURIComponent(c.appId)}` : `bundleId=${encodeURIComponent(c.bundleId)}`;
        const pages = yield Promise.all(countries.map((country) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const res = yield request(`https://itunes.apple.com/lookup?${which}&country=${encodeURIComponent(country.toLowerCase())}`);
            if (!res.ok)
                throw new StoreError(`The App Store lookup answered ${res.status}`);
            const body = yield res.json().catch(() => null);
            return (_b = (_a = body === null || body === void 0 ? void 0 : body.results) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : null;
        })));
        const found = pages.filter(Boolean);
        if (!found.length)
            return null;
        const count = found.reduce((sum, p) => sum + (Number(p.userRatingCount) || 0), 0);
        const weighted = found.reduce((sum, p) => sum + (Number(p.averageUserRating) || 0) * (Number(p.userRatingCount) || 0), 0);
        return { rating: count ? weighted / count : null, ratings_count: count };
    });
}
/**
 * The app as App Store Connect has it: its id (found from the bundle id when
 * not given), its name, and the version on sale with its build's icon.
 */
export function appleApp(c, bearer) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        let app;
        if (c.appId) {
            app = (yield appleGet(`/apps/${encodeURIComponent(c.appId)}?fields[apps]=name,bundleId`, bearer, 'the app')).data;
        }
        else {
            // The filter also matches longer ids (an extension's): keep the exact one.
            const { data } = yield appleGet(`/apps?filter[bundleId]=${encodeURIComponent(c.bundleId)}&fields[apps]=name,bundleId&limit=50`, bearer, 'the apps');
            app = data === null || data === void 0 ? void 0 : data.find((a) => { var _a; return ((_a = a.attributes) === null || _a === void 0 ? void 0 : _a.bundleId) === c.bundleId; });
            if (!app)
                throw new StoreError(`No app has the bundle id ${c.bundleId} on this App Store Connect account`);
        }
        // One version at most is on sale per platform.
        const versions = yield appleGet(`/apps/${app.id}/appStoreVersions?filter[platform]=IOS&filter[appVersionState]=READY_FOR_DISTRIBUTION&include=build&fields[builds]=iconAssetToken,version&limit=1`, bearer, 'the app versions');
        const version = (_a = versions.data) === null || _a === void 0 ? void 0 : _a[0];
        const build = (_b = versions.included) === null || _b === void 0 ? void 0 : _b.find((i) => i.type === 'builds');
        const template = (_d = (_c = build === null || build === void 0 ? void 0 : build.attributes) === null || _c === void 0 ? void 0 : _c.iconAssetToken) === null || _d === void 0 ? void 0 : _d.templateUrl;
        return {
            id: String(app.id),
            name: (_f = (_e = app.attributes) === null || _e === void 0 ? void 0 : _e.name) !== null && _f !== void 0 ? _f : null,
            icon: template ? template.replace('{w}', '512').replace('{h}', '512').replace('{f}', 'png') : null,
            url: `https://apps.apple.com/app/id${app.id}`,
            version: (_h = (_g = version === null || version === void 0 ? void 0 : version.attributes) === null || _g === void 0 ? void 0 : _g.versionString) !== null && _h !== void 0 ? _h : null,
        };
    });
}
/**
 * The written reviews, newest first, down to `since` (a few days before the
 * newest one kept, to see edits and replies), or `FIRST_REVIEW_PAGES` pages
 * the first time. A rating with no text is not a review: Apple lists none.
 */
export function appleReviews(appId, bearer, since) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const reviews = [];
        let url = `/apps/${encodeURIComponent(appId)}/customerReviews?sort=-createdDate&limit=200&include=response`;
        for (let page = 0; url && page < (since ? 50 : FIRST_REVIEW_PAGES); page++) {
            const body = yield appleGet(url, bearer, 'the reviews');
            const responses = new Map(((_a = body.included) !== null && _a !== void 0 ? _a : []).filter((i) => i.type === 'customerReviewResponses').map((i) => [i.id, i.attributes]));
            let older = false;
            for (const review of (_b = body.data) !== null && _b !== void 0 ? _b : []) {
                const row = appleReviewRow(review, responses);
                if (!row)
                    continue;
                if (since && row.written_at < since)
                    older = true;
                else
                    reviews.push(row);
            }
            url = older ? null : (_d = (_c = body.links) === null || _c === void 0 ? void 0 : _c.next) !== null && _d !== void 0 ? _d : null;
        }
        return reviews;
    });
}
/** ISO 3166 country codes, three letters then two (`SAUSA`): Apple names a review's storefront in three. */
const ALPHA3 = 'ABWAWAFGAFAGOAOAIAAIALAAXALBALANDADAREAEARGARARMAMASMASATAAQATFTFATGAGAUSAUAUTATAZEAZBDIBIBELBEBENBJBESBQBFABF' +
    'BGDBDBGRBGBHRBHBHSBSBIHBABLMBLBLRBYBLZBZBMUBMBOLBOBRABRBRBBBBRNBNBTNBTBVTBVBWABWCAFCFCANCACCKCCCHECHCHLCLCHNCN' +
    'CIVCICMRCMCODCDCOGCGCOKCKCOLCOCOMKMCPVCVCRICRCUBCUCUWCWCXRCXCYMKYCYPCYCZECZDEUDEDJIDJDMADMDNKDKDOMDODZADZECUEC' +
    'EGYEGERIERESHEHESPESESTEEETHETFINFIFJIFJFLKFKFRAFRFROFOFSMFMGABGAGBRGBGEOGEGGYGGGHAGHGIBGIGINGNGLPGPGMBGMGNBGW' +
    'GNQGQGRCGRGRDGDGRLGLGTMGTGUFGFGUMGUGUYGYHKGHKHMDHMHNDHNHRVHRHTIHTHUNHUIDNIDIMNIMINDINIOTIOIRLIEIRNIRIRQIQISLIS' +
    'ISRILITAITJAMJMJEYJEJORJOJPNJPKAZKZKENKEKGZKGKHMKHKIRKIKNAKNKORKRKWTKWLAOLALBNLBLBRLRLBYLYLCALCLIELILKALKLSOLS' +
    'LTULTLUXLULVALVMACMOMAFMFMARMAMCOMCMDAMDMDGMGMDVMVMEXMXMHLMHMKDMKMLIMLMLTMTMMRMMMNEMEMNGMNMNPMPMOZMZMRTMRMSRMS' +
    'MTQMQMUSMUMWIMWMYSMYMYTYTNAMNANCLNCNERNENFKNFNGANGNICNINIUNUNLDNLNORNONPLNPNRUNRNZLNZOMNOMPAKPKPANPAPCNPNPERPE' +
    'PHLPHPLWPWPNGPGPOLPLPRIPRPRKKPPRTPTPRYPYPSEPSPYFPFQATQAREUREROURORUSRURWARWSAUSASDNSDSENSNSGPSGSGSGSSHNSHSJMSJ' +
    'SLBSBSLESLSLVSVSMRSMSOMSOSPMPMSRBRSSSDSSSTPSTSURSRSVKSKSVNSISWESESWZSZSXMSXSYCSCSYRSYTCATCTCDTDTGOTGTHATHTJKTJ' +
    'TKLTKTKMTMTLSTLTONTOTTOTTTUNTNTURTRTUVTVTWNTWTZATZUGAUGUKRUAUMIUMUNKXKURYUYUSAUSUZBUZVATVAVCTVCVENVEVGBVGVIRVI' +
    'VNMVNVUTVUWLFWFWSMWSYEMYEZAFZAZMBZMZWEZW';
const TWO_LETTERS = new Map(((_a = ALPHA3.match(/.{5}/g)) !== null && _a !== void 0 ? _a : []).map((pair) => [pair.slice(0, 3), pair.slice(3)]));
/** `SAU` → `SA`, as the sales reports name countries. */
export function territoryOf(code) {
    var _a, _b;
    const t = (_a = textOf(code)) === null || _a === void 0 ? void 0 : _a.toUpperCase();
    if (!t)
        return null;
    return t.length === 2 ? t : (_b = TWO_LETTERS.get(t)) !== null && _b !== void 0 ? _b : t;
}
export function appleReviewRow(review, responses) {
    var _a, _b, _c, _d;
    const a = (_a = review === null || review === void 0 ? void 0 : review.attributes) !== null && _a !== void 0 ? _a : {};
    const written = Date.parse(a.createdDate);
    const rating = Number(a.rating);
    if (!(review === null || review === void 0 ? void 0 : review.id) || Number.isNaN(written) || !(rating >= 1 && rating <= 5))
        return null;
    const response = responses.get((_d = (_c = (_b = review.relationships) === null || _b === void 0 ? void 0 : _b.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.id);
    const replied = (response === null || response === void 0 ? void 0 : response.lastModifiedDate) ? Date.parse(response.lastModifiedDate) : NaN;
    return {
        review_id: String(review.id),
        rating: Math.round(rating),
        title: textOf(a.title),
        body: textOf(a.body),
        author: textOf(a.reviewerNickname),
        territory: territoryOf(a.territory),
        language: null,
        version: null,
        device: null,
        written_at: new Date(written),
        reply: textOf(response === null || response === void 0 ? void 0 : response.responseBody),
        replied_at: Number.isNaN(replied) ? null : new Date(replied),
        url: null,
    };
}
/**
 * One day of the vendor's sales summary, kept to the app: its rows by
 * country, and every country together. Null when Apple has not put the day
 * out yet (the day after, in the morning, Pacific time).
 */
export function appleSalesDay(c, appId, day, token) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = new URLSearchParams({
            'filter[frequency]': 'DAILY',
            'filter[reportType]': 'SALES',
            'filter[reportSubType]': 'SUMMARY',
            'filter[version]': '1_0',
            'filter[vendorNumber]': c.vendorNumber,
            'filter[reportDate]': day,
        });
        const res = yield request(`${API}/salesReports?${params}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/a-gzip' } });
        if (res.status === 404) {
            // The same 404 for a day nobody downloaded anything and for a report not out yet.
            const detail = yield appleError(res);
            return /not available yet/i.test(detail) ? null : parseSales('', appId);
        }
        if (!res.ok)
            throw yield appleRefusal(res, 'the sales reports');
        return parseSales(gunzipped(Buffer.from(yield res.arrayBuffer())).toString('utf8'), appId);
    });
}
/** A sales summary's units for the app, by country and in all: first downloads, re-downloads, updates. */
export function parseSales(tsv, appId) {
    var _a, _b, _c, _d, _e;
    const blank = (country) => ({ country, downloads: 0, redownloads: 0, updates: 0 });
    const byCountry = new Map([['', blank('')]]);
    for (const row of parseTable(tsv, '\t')) {
        if (((_a = row['Apple Identifier']) !== null && _a !== void 0 ? _a : '').trim() !== appId)
            continue;
        const type = ((_b = row['Product Type Identifier']) !== null && _b !== void 0 ? _b : '').trim();
        const field = DOWNLOAD_TYPES.has(type) ? 'downloads' : REDOWNLOAD_TYPES.has(type) ? 'redownloads' : UPDATE_TYPES.has(type) ? 'updates' : null;
        if (!field)
            continue;
        // Negative for a refund: they add up as they are.
        const units = Number(row['Units']) || 0;
        const country = ((_c = row['Country Code']) !== null && _c !== void 0 ? _c : '').trim().toUpperCase();
        for (const key of /^[A-Z]{2}$/.test(country) ? [country, ''] : ['']) {
            const counts = (_d = byCountry.get(key)) !== null && _d !== void 0 ? _d : blank(key);
            counts[field] = ((_e = counts[field]) !== null && _e !== void 0 ? _e : 0) + units;
            byCountry.set(key, counts);
        }
    }
    return [...byCountry.values()];
}
