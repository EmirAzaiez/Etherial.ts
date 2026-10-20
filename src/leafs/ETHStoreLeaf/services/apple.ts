// ──────────────────────────────────────────────────────────────────────────
// The App Store, through App Store Connect's API and its key: the app (name,
// version on sale, icon), the daily sales reports (downloads, re-downloads,
// updates, by country), and the written reviews. The analytics reports are
// in appleAnalytics.ts. The rating alone comes from the public lookup: the
// API does not give it.
// ──────────────────────────────────────────────────────────────────────────

import jwt from 'jsonwebtoken'

import type { StoreAppInfo } from '../models/StoreStatus.js'
import { DayRow, ReviewRow, StoreError, gunzipped, parseTable, request, textOf } from './common.js'
import { AppleStoreConfig, pem } from './options.js'

export const API = 'https://api.appstoreconnect.apple.com/v1'

// Product Type Identifier: iPhone, universal, iPad, Mac.
const DOWNLOAD_TYPES = new Set(['1', '1F', '1T', 'F1'])
const REDOWNLOAD_TYPES = new Set(['3', '3F', '3T', 'F3'])
const UPDATE_TYPES = new Set(['7', '7F', '7T', 'F7'])

/** Pages of reviews read the first time: 200 a page. */
const FIRST_REVIEW_PAGES = 10

/** A bearer for App Store Connect: ES256, valid 20 minutes at most — this one 15. */
export function appleToken(c: AppleStoreConfig): string {
    const now = Math.floor(Date.now() / 1000)
    try {
        return jwt.sign({ iss: c.issuerId, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' }, pem(c.privateKey!), {
            algorithm: 'ES256',
            keyid: c.keyId,
        })
    } catch (err: any) {
        throw new StoreError(`The App Store Connect key could not sign: ${err?.message || err} (is it the .p8 file?)`)
    }
}

/** A bearer that renews itself: a long sync outlives one token. */
export function appleBearer(c: AppleStoreConfig): () => string {
    let token = { value: appleToken(c), at: Date.now() }
    return () => {
        if (Date.now() - token.at > 10 * 60 * 1000) token = { value: appleToken(c), at: Date.now() }
        return token.value
    }
}

export async function appleError(res: Response): Promise<string> {
    const body: any = await res.json().catch(() => null)
    const first = body?.errors?.[0]
    // Apple's titles end with a full stop: "…are missing or invalid.: Provide…" otherwise.
    return first ? [first.title?.replace(/\.$/, ''), first.detail].filter(Boolean).join(': ') : res.statusText
}

/** What Apple's refusal means, for the admins. `what` names what was asked: "the reviews". */
export async function appleRefusal(res: Response, what: string): Promise<StoreError> {
    const detail = await appleError(res)
    if (res.status === 401) return new StoreError(`App Store Connect refused the key: ${detail}`)
    if (res.status === 403) return new StoreError(`The App Store Connect key may not read ${what}: give it the Admin role (${detail})`)
    return new StoreError(`App Store Connect answered ${res.status} for ${what}: ${detail}`)
}

/** A GET on App Store Connect: a path (`/apps/…`) or a `links.next` it gave. */
export async function appleGet(url: string, bearer: () => string, what: string): Promise<any> {
    const res = await request(url.startsWith('https://') ? url : `${API}${url}`, { headers: { Authorization: `Bearer ${bearer()}` } })
    if (!res.ok) throw await appleRefusal(res, what)
    return res.json()
}

/** Every page of a list, `maxPages` at most. */
export async function appleList(path: string, bearer: () => string, what: string, maxPages = 20): Promise<{ data: any[]; included: any[] }> {
    const data: any[] = []
    const included: any[] = []
    let url: string | null = path
    for (let page = 0; url && page < maxPages; page++) {
        const body = await appleGet(url, bearer, what)
        data.push(...(body.data ?? []))
        included.push(...(body.included ?? []))
        url = body.links?.next ?? null
    }
    return { data, included }
}

/**
 * The public rating on the storefronts listed, weighted by how many rated in
 * each: Apple counts them per country. Null when none of them has the app.
 */
export async function applePublicRating(c: AppleStoreConfig): Promise<{ rating: number | null; ratings_count: number } | null> {
    const countries = c.countries?.length ? c.countries : ['us']
    const which = c.appId ? `id=${encodeURIComponent(c.appId)}` : `bundleId=${encodeURIComponent(c.bundleId!)}`
    const pages = await Promise.all(
        countries.map(async (country) => {
            const res = await request(`https://itunes.apple.com/lookup?${which}&country=${encodeURIComponent(country.toLowerCase())}`)
            if (!res.ok) throw new StoreError(`The App Store lookup answered ${res.status}`)
            const body: any = await res.json().catch(() => null)
            return body?.results?.[0] ?? null
        })
    )
    const found = pages.filter(Boolean)
    if (!found.length) return null
    const count = found.reduce((sum, p) => sum + (Number(p.userRatingCount) || 0), 0)
    const weighted = found.reduce((sum, p) => sum + (Number(p.averageUserRating) || 0) * (Number(p.userRatingCount) || 0), 0)
    return { rating: count ? weighted / count : null, ratings_count: count }
}

/**
 * The app as App Store Connect has it: its id (found from the bundle id when
 * not given), its name, and the version on sale with its build's icon.
 */
export async function appleApp(c: AppleStoreConfig, bearer: () => string): Promise<StoreAppInfo> {
    let app: any
    if (c.appId) {
        app = (await appleGet(`/apps/${encodeURIComponent(c.appId)}?fields[apps]=name,bundleId`, bearer, 'the app')).data
    } else {
        // The filter also matches longer ids (an extension's): keep the exact one.
        const { data } = await appleGet(`/apps?filter[bundleId]=${encodeURIComponent(c.bundleId!)}&fields[apps]=name,bundleId&limit=50`, bearer, 'the apps')
        app = data?.find((a: any) => a.attributes?.bundleId === c.bundleId)
        if (!app) throw new StoreError(`No app has the bundle id ${c.bundleId} on this App Store Connect account`)
    }

    // One version at most is on sale per platform.
    const versions = await appleGet(
        `/apps/${app.id}/appStoreVersions?filter[platform]=IOS&filter[appVersionState]=READY_FOR_DISTRIBUTION&include=build&fields[builds]=iconAssetToken,version&limit=1`,
        bearer,
        'the app versions'
    )
    const version = versions.data?.[0]
    const build = versions.included?.find((i: any) => i.type === 'builds')
    const template: string | undefined = build?.attributes?.iconAssetToken?.templateUrl
    return {
        id: String(app.id),
        name: app.attributes?.name ?? null,
        icon: template ? template.replace('{w}', '512').replace('{h}', '512').replace('{f}', 'png') : null,
        url: `https://apps.apple.com/app/id${app.id}`,
        version: version?.attributes?.versionString ?? null,
    }
}

/**
 * The written reviews, newest first, down to `since` (a few days before the
 * newest one kept, to see edits and replies), or `FIRST_REVIEW_PAGES` pages
 * the first time. A rating with no text is not a review: Apple lists none.
 */
export async function appleReviews(appId: string, bearer: () => string, since: Date | null): Promise<ReviewRow[]> {
    const reviews: ReviewRow[] = []
    let url: string | null = `/apps/${encodeURIComponent(appId)}/customerReviews?sort=-createdDate&limit=200&include=response`
    for (let page = 0; url && page < (since ? 50 : FIRST_REVIEW_PAGES); page++) {
        const body = await appleGet(url, bearer, 'the reviews')
        const responses = new Map<string, any>(
            (body.included ?? []).filter((i: any) => i.type === 'customerReviewResponses').map((i: any) => [i.id, i.attributes])
        )
        let older = false
        for (const review of body.data ?? []) {
            const row = appleReviewRow(review, responses)
            if (!row) continue
            if (since && row.written_at < since) older = true
            else reviews.push(row)
        }
        url = older ? null : body.links?.next ?? null
    }
    return reviews
}

/** ISO 3166 country codes, three letters then two (`SAUSA`): Apple names a review's storefront in three. */
const ALPHA3 =
    'ABWAWAFGAFAGOAOAIAAIALAAXALBALANDADAREAEARGARARMAMASMASATAAQATFTFATGAGAUSAUAUTATAZEAZBDIBIBELBEBENBJBESBQBFABF' +
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
    'VNMVNVUTVUWLFWFWSMWSYEMYEZAFZAZMBZMZWEZW'
const TWO_LETTERS = new Map((ALPHA3.match(/.{5}/g) ?? []).map((pair): [string, string] => [pair.slice(0, 3), pair.slice(3)]))

/** `SAU` → `SA`, as the sales reports name countries. */
export function territoryOf(code: string | undefined): string | null {
    const t = textOf(code)?.toUpperCase()
    if (!t) return null
    return t.length === 2 ? t : TWO_LETTERS.get(t) ?? t
}

export function appleReviewRow(review: any, responses: Map<string, any>): ReviewRow | null {
    const a = review?.attributes ?? {}
    const written = Date.parse(a.createdDate)
    const rating = Number(a.rating)
    if (!review?.id || Number.isNaN(written) || !(rating >= 1 && rating <= 5)) return null
    const response = responses.get(review.relationships?.response?.data?.id)
    const replied = response?.lastModifiedDate ? Date.parse(response.lastModifiedDate) : NaN
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
        reply: textOf(response?.responseBody),
        replied_at: Number.isNaN(replied) ? null : new Date(replied),
        url: null,
    }
}

/**
 * One day of the vendor's sales summary, kept to the app: its rows by
 * country, and every country together. Null when Apple has not put the day
 * out yet (the day after, in the morning, Pacific time).
 */
export async function appleSalesDay(c: AppleStoreConfig, appId: string, day: string, token: string): Promise<DayRow[] | null> {
    const params = new URLSearchParams({
        'filter[frequency]': 'DAILY',
        'filter[reportType]': 'SALES',
        'filter[reportSubType]': 'SUMMARY',
        'filter[version]': '1_0',
        'filter[vendorNumber]': c.vendorNumber!,
        'filter[reportDate]': day,
    })
    const res = await request(`${API}/salesReports?${params}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/a-gzip' } })
    if (res.status === 404) {
        // The same 404 for a day nobody downloaded anything and for a report not out yet.
        const detail = await appleError(res)
        return /not available yet/i.test(detail) ? null : parseSales('', appId)
    }
    if (!res.ok) throw await appleRefusal(res, 'the sales reports')
    return parseSales(gunzipped(Buffer.from(await res.arrayBuffer())).toString('utf8'), appId)
}

/** A sales summary's units for the app, by country and in all: first downloads, re-downloads, updates. */
export function parseSales(tsv: string, appId: string): DayRow[] {
    const blank = (country: string): DayRow => ({ country, downloads: 0, redownloads: 0, updates: 0 })
    const byCountry = new Map<string, DayRow>([['', blank('')]])
    for (const row of parseTable(tsv, '\t')) {
        if ((row['Apple Identifier'] ?? '').trim() !== appId) continue
        const type = (row['Product Type Identifier'] ?? '').trim()
        const field = DOWNLOAD_TYPES.has(type) ? 'downloads' : REDOWNLOAD_TYPES.has(type) ? 'redownloads' : UPDATE_TYPES.has(type) ? 'updates' : null
        if (!field) continue
        // Negative for a refund: they add up as they are.
        const units = Number(row['Units']) || 0
        const country = (row['Country Code'] ?? '').trim().toUpperCase()
        for (const key of /^[A-Z]{2}$/.test(country) ? [country, ''] : ['']) {
            const counts = byCountry.get(key) ?? blank(key)
            counts[field] = (counts[field] ?? 0) + units
            byCountry.set(key, counts)
        }
    }
    return [...byCountry.values()]
}
