// ──────────────────────────────────────────────────────────────────────────
// Google Play, with a service account invited in Play Console: the reports
// Play Console writes every day to the developer's Cloud Storage bucket —
// one CSV per month and per report (installs, ratings, crashes, store
// listing, reviews) — and the app's name and version from the Play
// Developer Reporting API, when it is turned on.
// ──────────────────────────────────────────────────────────────────────────

import jwt from 'jsonwebtoken'

import type { StoreAppInfo } from '../models/StoreStatus.js'
import { DayMetrics, DayRow, ReviewRow, SourceKey, StoreError, addTo, cell, dayOf, numberOf, parseTable, request, textOf } from './common.js'
import { GoogleServiceAccount, GoogleStoreConfig, pem } from './options.js'

const TOKEN_URI = 'https://oauth2.googleapis.com/token'
const SCOPES = ['https://www.googleapis.com/auth/devstorage.read_only', 'https://www.googleapis.com/auth/playdeveloperreporting'].join(' ')
const REPORTING = 'https://playdeveloperreporting.googleapis.com/v1beta1'

let cached: { email: string; token: string; until: number } | null = null

/** The service account from the config: the object, its JSON, or that JSON in base64. */
export function serviceAccountOf(c: GoogleStoreConfig): GoogleServiceAccount {
    let account: any = c.serviceAccount
    if (typeof account === 'string') {
        const text = account.trim()
        try {
            account = JSON.parse(text.startsWith('{') ? text : Buffer.from(text, 'base64').toString('utf8'))
        } catch {
            throw new StoreError('The Google service account is not a JSON key (the file downloaded from Google Cloud)')
        }
    }
    if (!account?.client_email || !account?.private_key) throw new StoreError('The Google service account has no client_email or private_key')
    return account
}

async function googleToken(account: GoogleServiceAccount): Promise<string> {
    if (cached && cached.email === account.client_email && cached.until > Date.now()) return cached.token
    const now = Math.floor(Date.now() / 1000)
    let assertion: string
    try {
        assertion = jwt.sign({ iss: account.client_email, scope: SCOPES, aud: TOKEN_URI, iat: now, exp: now + 3600 }, pem(account.private_key), {
            algorithm: 'RS256',
        })
    } catch (err: any) {
        throw new StoreError(`The Google service account's key could not sign: ${err?.message || err}`)
    }
    const res = await request(account.token_uri || TOKEN_URI, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    })
    const body: any = await res.json().catch(() => ({}))
    if (!res.ok || !body.access_token) {
        throw new StoreError(`Google refused the service account (${res.status}): ${body.error_description || body.error || 'no token'}`)
    }
    cached = { email: account.client_email, token: body.access_token, until: Date.now() + (Number(body.expires_in) || 3600) * 1000 - 60 * 1000 }
    return cached.token
}

/** `gs://pubsite_prod_rev_0123/stats` → `pubsite_prod_rev_0123`. */
export function bucketOf(c: GoogleStoreConfig): string {
    return (c.bucket ?? '').trim().replace(/^gs:\/\//, '').split('/')[0]
}

/** Play Console writes its reports in UTF-16 with a byte-order mark; older ones in UTF-8. */
export function decode(buffer: Buffer): string {
    if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString('utf16le')
    if (buffer[0] === 0xfe && buffer[1] === 0xff) {
        const swapped = Buffer.from(buffer.subarray(2, buffer.length - (buffer.length % 2)))
        return swapped.swap16().toString('utf16le')
    }
    return buffer.toString('utf8').replace(/^﻿/, '')
}

/** One file of the bucket, or null when it is not there: a month not started yet. */
async function readObject(c: GoogleStoreConfig, name: string): Promise<string | null> {
    const token = await googleToken(serviceAccountOf(c))
    const bucket = bucketOf(c)
    const res = await request(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(name)}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 404) return null
    if (res.status === 401 || res.status === 403) {
        throw new StoreError(
            `The service account may not read ${bucket}: invite it in Play Console › Users and permissions with "View app information and download bulk reports" (it can take a day to apply)`
        )
    }
    if (!res.ok) throw new StoreError(`Google Cloud Storage answered ${res.status} for ${name}`)
    return decode(Buffer.from(await res.arrayBuffer()))
}

/**
 * A row of the installs report as the leaf counts it. Downloads are the
 * people installing it for the first time; re-downloads the other installs
 * (again, or on one more device); uninstalls the people who removed it
 * from all their devices.
 */
export function installsRow(row: Record<string, string>, country: string): DayRow {
    const users = cell(row, 'Daily User Installs') ?? 0
    const installs = cell(row, 'Daily Device Installs', 'Install events')
    return {
        country,
        downloads: users,
        redownloads: installs == null ? null : Math.max(installs - users, 0),
        updates: cell(row, 'Daily Device Upgrades', 'Update events'),
        uninstalls: cell(row, 'Daily User Uninstalls', 'Daily Device Uninstalls'),
        active_devices: cell(row, 'Installs on active devices', 'Active Device Installs'),
    }
}

/** The days of the two installs files of a month, every country together first. */
export function parseInstalls(overview: string, byCountry: string | null): Map<string, DayRow[]> {
    const days = new Map<string, DayRow[]>()
    const add = (row: Record<string, string>, country: string) => {
        const day = dayOf(row['Date'])
        if (!day) return
        if (!days.has(day)) days.set(day, [])
        days.get(day)!.push(installsRow(row, country))
    }
    for (const row of parseTable(overview)) add(row, '')
    for (const row of parseTable(byCountry ?? '')) {
        const country = (row['Country'] ?? '').trim().toUpperCase()
        if (/^[A-Z]{2}$/.test(country)) add(row, country)
    }
    return days
}

/** The figures of a month's file, day by day: `pick` reads a row; the rows of one day add up. */
function byDay(csv: string, pick: (row: Record<string, string>, day: DayMetrics) => void, blank: () => DayMetrics): Map<string, DayMetrics> {
    const days = new Map<string, DayMetrics>()
    for (const row of parseTable(csv)) {
        const date = dayOf(row['Date'])
        if (!date) continue
        let day = days.get(date)
        if (!day) days.set(date, (day = blank()))
        pick(row, day)
    }
    return days
}

/** The ratings file: the average of every rating given up to that day. `NA` on a day nobody had rated yet. */
export function parseRatings(csv: string): Map<string, DayMetrics> {
    return byDay(
        csv,
        (row, day) => {
            day.rating_average = numberOf(row['Total Average Rating'])
        },
        () => ({ rating_average: null })
    )
}

export function parseCrashes(csv: string): Map<string, DayMetrics> {
    return byDay(
        csv,
        (row, day) => {
            day.crashes = (day.crashes ?? 0) + (cell(row, 'Daily Crashes') ?? 0)
            day.anrs = (day.anrs ?? 0) + (cell(row, 'Daily ANRs') ?? 0)
        },
        () => ({ crashes: 0, anrs: 0 })
    )
}

/** The store listing by country: its visitors and the first installs from it, every country together. */
export function parseListing(csv: string): Map<string, DayMetrics> {
    return byDay(
        csv,
        (row, day) => {
            day.page_views! += cell(row, 'Store listing visitors') ?? 0
            day.acquisitions! += cell(row, 'Store listing acquisitions') ?? 0
        },
        () => ({ page_views: 0, acquisitions: 0 })
    )
}

export function googleSource(type: string | undefined): SourceKey {
    const t = (type ?? '').trim().toLowerCase()
    if (t.includes('search')) return 'search'
    if (t.includes('explore') || t.includes('browse')) return 'browse'
    if (/\bads?\b/.test(t)) return 'ads'
    if (t.includes('referr') || t.includes('third')) return 'referral'
    return 'other'
}

/** The store listing by traffic source: the first installs, by where they came from. */
export function parseSources(csv: string): Map<string, DayMetrics> {
    return byDay(
        csv,
        (row, day) => {
            addTo(day.sources!, googleSource(row['Traffic source']), cell(row, 'Store listing acquisitions') ?? 0)
        },
        () => ({ sources: {} })
    )
}

function unescaped(id: string): string {
    try {
        return decodeURIComponent(id)
    } catch {
        return id
    }
}

const millis = (value: string | undefined): Date | null => {
    const n = numberOf(value)
    return n == null || n <= 0 ? null : new Date(n)
}

/** A month's reviews: those with words only (a star alone is a rating), the last version of each. */
export function parseReviews(csv: string): ReviewRow[] {
    const reviews = new Map<string, { row: ReviewRow; updated: number }>()
    for (const row of parseTable(csv)) {
        const title = textOf(row['Review Title'])
        const body = textOf(row['Review Text'])
        const rating = numberOf(row['Star Rating'])
        const written = millis(row['Review Submit Millis Since Epoch']) ?? (row['Review Submit Date and Time'] ? new Date(row['Review Submit Date and Time']) : null)
        if ((!title && !body) || !rating || rating < 1 || rating > 5 || !written || Number.isNaN(written.getTime())) continue
        const link = textOf(row['Review Link'])
        const language = textOf(row['Reviewer Language'])
        const device = textOf(row['Device'])
        const id = link?.match(/reviewid=([^&#\s]+)/i)?.[1] ?? `${written.getTime()}:${device ?? ''}:${language ?? ''}`
        const updated = millis(row['Review Last Update Millis Since Epoch'])?.getTime() ?? written.getTime()
        if ((reviews.get(id)?.updated ?? -1) > updated) continue
        const reply = textOf(row['Developer Reply Text'])
        reviews.set(id, {
            updated,
            row: {
                review_id: unescaped(id),
                rating: Math.round(rating),
                title,
                body,
                author: null,
                territory: null,
                language,
                version: textOf(row['App Version Name']),
                device,
                written_at: written,
                reply,
                replied_at: reply ? millis(row['Developer Reply Millis Since Epoch']) : null,
                url: link,
            },
        })
    }
    return [...reviews.values()].map((r) => r.row)
}

/** What Play Console wrote for one month (`202610`); null for a report not written yet. */
export interface GoogleMonth {
    installs: Map<string, DayRow[]> | null
    ratings: Map<string, DayMetrics> | null
    crashes: Map<string, DayMetrics> | null
    listing: Map<string, DayMetrics> | null
    sources: Map<string, DayMetrics> | null
    reviews: ReviewRow[] | null
}

export async function googleMonth(c: GoogleStoreConfig, month: string): Promise<GoogleMonth> {
    const pkg = c.packageName
    const read = (name: string) => readObject(c, name)
    const [installs, installsByCountry, ratings, crashes, listing, sources, reviews] = await Promise.all([
        read(`stats/installs/installs_${pkg}_${month}_overview.csv`),
        read(`stats/installs/installs_${pkg}_${month}_country.csv`),
        read(`stats/ratings/ratings_${pkg}_${month}_overview.csv`),
        read(`stats/crashes/crashes_${pkg}_${month}_overview.csv`),
        read(`stats/store_performance/store_performance_${pkg}_${month}_country.csv`),
        read(`stats/store_performance/store_performance_${pkg}_${month}_traffic_source.csv`),
        read(`reviews/reviews_${pkg}_${month}.csv`),
    ])
    return {
        installs: installs == null ? null : parseInstalls(installs, installsByCountry),
        ratings: ratings == null ? null : parseRatings(ratings),
        crashes: crashes == null ? null : parseCrashes(crashes),
        listing: listing == null ? null : parseListing(listing),
        sources: sources == null ? null : parseSources(sources),
        reviews: reviews == null ? null : parseReviews(reviews),
    }
}

async function reportingGet(c: GoogleStoreConfig, path: string): Promise<any> {
    const token = await googleToken(serviceAccountOf(c))
    const res = await request(`${REPORTING}/${path}`, { headers: { Authorization: `Bearer ${token}` } })
    const body: any = await res.json().catch(() => null)
    if (!res.ok) {
        const message: string = body?.error?.message || res.statusText
        if (res.status === 403 && /has not been used|is disabled/i.test(message)) {
            throw new StoreError('The app\'s name and version need the Google Play Developer Reporting API, turned on in the service account\'s Google Cloud project')
        }
        throw new StoreError(`The Play Developer Reporting API answered ${res.status}: ${message}`)
    }
    return body
}

/** The app's name (as set in Play Console) and the release now on the production track. */
export async function googleApp(c: GoogleStoreConfig): Promise<StoreAppInfo> {
    const pkg = c.packageName!
    let name: string | null = null
    let pageToken = ''
    for (let page = 0; page < 10; page++) {
        const body = await reportingGet(c, `apps:search?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`)
        const app = (body?.apps ?? []).find((a: any) => a.packageName === pkg)
        if (app) {
            name = app.displayName ?? null
            break
        }
        if (!(pageToken = body?.nextPageToken)) break
    }
    if (name == null) throw new StoreError(`The service account does not see ${pkg} in Play Console`)
    const options = await reportingGet(c, `apps/${encodeURIComponent(pkg)}:fetchReleaseFilterOptions`)
    const production = (options?.tracks ?? []).find((t: any) => /production/i.test(`${t.type} ${t.displayName}`))
    return {
        id: pkg,
        name,
        icon: null,
        url: `https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg)}`,
        version: production?.servingReleases?.[0]?.displayName ?? null,
    }
}
