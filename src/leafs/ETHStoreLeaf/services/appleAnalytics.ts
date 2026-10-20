// ──────────────────────────────────────────────────────────────────────────
// App Store Connect's analytics reports. They are asked for once, with an
// Admin key, and Apple then writes them every day: the leaf asks for the
// daily ones (ONGOING) and for the history (ONE_TIME_SNAPSHOT). A report
// comes in instances, one per day Apple processed it, each in gzipped TSV
// segments; a later instance replaces what an earlier one said of the same
// day. Read are the Standard reports: the Detailed ones add noise and leave
// out the small counts.
// ──────────────────────────────────────────────────────────────────────────

import type { StoreCursor } from '../models/StoreStatus.js'
import { API, appleGet, appleList, appleRefusal } from './apple.js'
import { DayMetrics, SourceKey, StoreError, addTo, cell, dayOf, gunzipped, parseTable, request, shiftDay } from './common.js'

export type ReportKind = 'engagement' | 'downloads' | 'installs' | 'sessions' | 'crashes'

/** The report of each kind, by its name: Apple has not always named them the same. */
const REPORT_NAMES: Record<ReportKind, (name: string) => boolean> = {
    engagement: (n) => n.includes('discovery and engagement'),
    downloads: (n) => n.startsWith('app store downloads') || n.startsWith('app downloads'),
    installs: (n) => n.includes('install') && n.includes('delet'),
    sessions: (n) => n.startsWith('app sessions'),
    crashes: (n) => n.startsWith('app crashes'),
}

export const REPORT_KINDS = Object.keys(REPORT_NAMES) as ReportKind[]

/** Instances read in one sync, per report: the history comes over several, under Apple's hourly limit. */
const INSTANCES_PER_SYNC = 120

/** The pages someone can download the app from: what the funnel counts. */
const DOWNLOAD_PAGES = /^(product page|store sheet|in-app event)$/i

/** The kind of a report from its name, or null. Standard first, then the plain one; never the Detailed. */
export function reportKind(name: string): { kind: ReportKind; rank: number } | null {
    const n = name.trim().toLowerCase()
    const kind = REPORT_KINDS.find((k) => REPORT_NAMES[k](n))
    if (!kind || n.includes('detailed')) return null
    return { kind, rank: n.includes('standard') ? 0 : n.includes('expanded') ? 2 : 1 }
}

export function appleSource(type: string | undefined): SourceKey {
    const t = (type ?? '').trim().toLowerCase()
    if (t.includes('search')) return 'search'
    if (t.includes('browse')) return 'browse'
    if (t.startsWith('app referr')) return 'app'
    if (t.startsWith('web referr')) return 'web'
    return 'other'
}

function blankOf(kind: ReportKind): DayMetrics {
    if (kind === 'engagement') return { impressions: 0, page_views: 0 }
    if (kind === 'downloads') return { acquisitions: 0, sources: {} }
    if (kind === 'installs') return { uninstalls: 0 }
    if (kind === 'sessions') return { sessions: 0, session_seconds: 0, session_devices: 0 }
    return { crashes: 0 }
}

function addRow(kind: ReportKind, day: DayMetrics, row: Record<string, string>) {
    const counts = cell(row, 'Counts') ?? 0
    const page = (row['Page Type'] ?? '').trim()
    if (kind === 'engagement') {
        const event = (row['Event'] ?? '').trim().toLowerCase()
        if (event === 'impression') day.impressions! += counts
        else if (event === 'page view' && DOWNLOAD_PAGES.test(page)) day.page_views! += counts
    } else if (kind === 'downloads') {
        if (!/^first/i.test((row['Download Type'] ?? '').trim())) return
        addTo(day.sources!, appleSource(row['Source Type']), counts)
        if (DOWNLOAD_PAGES.test(page)) day.acquisitions! += counts
    } else if (kind === 'installs') {
        if (/^delet/i.test((row['Event'] ?? '').trim())) day.uninstalls! += counts
    } else if (kind === 'sessions') {
        day.sessions! += cell(row, 'Sessions') ?? 0
        day.session_seconds! += cell(row, 'Total Session Duration') ?? 0
        // One row per device type, version, country…: their devices add up.
        day.session_devices! += cell(row, 'Unique Devices') ?? 0
    } else {
        day.crashes! += cell(row, 'Crashes') ?? 0
    }
}

/** A report's rows, day by day, kept to the app. */
export function analyticsDays(kind: ReportKind, rows: Record<string, string>[], appId: string): Map<string, DayMetrics> {
    const days = new Map<string, DayMetrics>()
    for (const row of rows) {
        const id = (row['App Apple Identifier'] ?? '').trim()
        if (id && id !== appId) continue
        const date = dayOf(row['Date'])
        if (!date) continue
        let day = days.get(date)
        if (!day) days.set(date, (day = blankOf(kind)))
        addRow(kind, day, row)
    }
    return days
}

async function askReports(appId: string, accessType: 'ONGOING' | 'ONE_TIME_SNAPSHOT', bearer: () => string): Promise<string | null> {
    const res = await request(`${API}/analyticsReportRequests`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${bearer()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            data: { type: 'analyticsReportRequests', attributes: { accessType }, relationships: { app: { data: { type: 'apps', id: appId } } } },
        }),
    })
    // Already asked: the list has it.
    if (res.status === 409) return null
    if (!res.ok) throw await appleRefusal(res, 'the analytics reports')
    const body: any = await res.json()
    return body?.data?.id ?? null
}

/**
 * The two requests the leaf reads, asked for when missing. Apple stops a
 * daily request nobody reads for a while: it is asked for again.
 */
async function requestsOf(appId: string, bearer: () => string): Promise<{ ongoing: string | null; snapshot: string | null; asked: boolean }> {
    const { data } = await appleList(`/apps/${encodeURIComponent(appId)}/analyticsReportRequests?limit=200`, bearer, 'the analytics reports', 5)
    let asked = false
    let ongoing = data.find((r) => r.attributes?.accessType === 'ONGOING' && !r.attributes?.stoppedDueToInactivity)?.id ?? null
    if (!ongoing) {
        for (const stopped of data.filter((r) => r.attributes?.accessType === 'ONGOING')) {
            const res = await request(`${API}/analyticsReportRequests/${stopped.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${bearer()}` } })
            if (!res.ok && res.status !== 404) throw await appleRefusal(res, 'the analytics reports')
        }
        ongoing = await askReports(appId, 'ONGOING', bearer)
        asked = true
    }
    let snapshot = data.find((r) => r.attributes?.accessType === 'ONE_TIME_SNAPSHOT')?.id ?? null
    if (!snapshot) {
        snapshot = await askReports(appId, 'ONE_TIME_SNAPSHOT', bearer)
        asked = true
    }
    return { ongoing, snapshot, asked }
}

/** A request's reports, the best one of each kind. */
async function reportsOf(requestId: string, bearer: () => string): Promise<Map<ReportKind, string>> {
    const { data } = await appleList(`/analyticsReportRequests/${requestId}/reports?limit=200`, bearer, 'the analytics reports', 5)
    const best = new Map<ReportKind, { id: string; rank: number }>()
    for (const report of data) {
        const found = reportKind(report.attributes?.name ?? '')
        if (!found) continue
        const kept = best.get(found.kind)
        if (!kept || found.rank < kept.rank) best.set(found.kind, { id: report.id, rank: found.rank })
    }
    return new Map([...best].map(([kind, { id }]) => [kind, id]))
}

/** Every row of an instance, its segments together. */
async function instanceRows(instanceId: string, bearer: () => string): Promise<Record<string, string>[]> {
    const { data } = await appleList(`/analyticsReportInstances/${instanceId}/segments?limit=200`, bearer, 'the analytics reports', 5)
    const files = await Promise.all(
        data.map(async (segment) => {
            // Signed for a while: no key.
            const res = await request(segment.attributes?.url, {}, 120 * 1000)
            if (!res.ok) throw new StoreError(`Apple's analytics file could not be downloaded (${res.status})`)
            return parseTable(gunzipped(Buffer.from(await res.arrayBuffer())).toString('utf8'), '\t')
        })
    )
    return files.flat()
}

export interface AnalyticsRun {
    appId: string
    bearer: () => string
    /** Updated as it reads: kept even when a report fails. */
    cursor: StoreCursor
    /** The first day kept. */
    since: string
    write: (day: string, metrics: DayMetrics) => Promise<void>
}

/**
 * Reads the instances not read yet, the history first: its days only up to
 * the first one the daily request gave. Returns what the admins should know
 * (reports still being prepared, history still coming), or null.
 */
export async function appleAnalytics(run: AnalyticsRun): Promise<string | null> {
    const { appId, bearer, cursor, since } = run
    const requests = await requestsOf(appId, bearer)
    cursor.ongoing = requests.ongoing ?? undefined
    cursor.snapshot = requests.snapshot ?? undefined
    cursor.read ??= {}
    cursor.covered ??= {}
    // Read further back than before: the history again, for the days it skipped.
    if (cursor.since && since < cursor.since) {
        for (const key of Object.keys(cursor.read)) if (key.startsWith('snapshot:')) delete cursor.read[key]
    }
    cursor.since = since

    let found = 0
    let more = false
    for (const [which, requestId] of [['snapshot', requests.snapshot], ['ongoing', requests.ongoing]] as const) {
        if (!requestId) continue
        const reports = await reportsOf(requestId, bearer)
        for (const [kind, reportId] of reports) {
            const key = `${which}:${kind}`
            const { data } = await appleList(`/analyticsReports/${reportId}/instances?filter[granularity]=DAILY&limit=200`, bearer, 'the analytics reports', 10)
            found += data.length
            // Instances processed long before the first day kept say nothing of it.
            const oldest = shiftDay(since, -7)
            const byDate = new Map<string, string[]>()
            for (const instance of data) {
                const date = instance.attributes?.processingDate
                if (!date || date < oldest || (cursor.read[key] && date <= cursor.read[key])) continue
                byDate.set(date, [...(byDate.get(date) ?? []), instance.id])
            }
            let budget = INSTANCES_PER_SYNC
            for (const date of [...byDate.keys()].sort()) {
                if (budget <= 0) {
                    more = true
                    break
                }
                const ids = byDate.get(date)!
                budget -= ids.length
                const rows = (await Promise.all(ids.map((id) => instanceRows(id, bearer)))).flat()
                for (const [day, metrics] of [...analyticsDays(kind, rows, appId)].sort(([a], [b]) => (a < b ? -1 : 1))) {
                    if (day < since) continue
                    if (which === 'snapshot') {
                        if (cursor.covered[kind] && day >= cursor.covered[kind]) continue
                    } else if (!cursor.covered[kind] || day < cursor.covered[kind]) {
                        cursor.covered[kind] = day
                    }
                    await run.write(day, metrics)
                }
                cursor.read[key] = date
            }
        }
    }

    if (requests.asked && !found) return 'Apple was asked for its analytics reports: the first ones come in a day or two.'
    if (!found) return 'Apple is preparing its analytics reports: the first ones come a day or two after they were asked for.'
    if (more) return 'Apple\'s history is still being read: the next syncs go on.'
    return null
}
