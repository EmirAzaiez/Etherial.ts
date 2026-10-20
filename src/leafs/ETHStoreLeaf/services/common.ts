/** A store said no, or could not be reached: the message is shown to the admins as is. */
export class StoreError extends Error {}

import { gunzipSync } from 'zlib'

/** One day's downloads in one country, or in all of them when `country` is empty. Left out: that report does not give it. */
export interface DayRow {
    country: string
    downloads: number | null
    redownloads: number | null
    updates: number | null
    uninstalls?: number | null
    active_devices?: number | null
}

/**
 * A day's figures from the other reports, on the all-countries row. Each
 * report replaces its own figures as a whole; what it leaves out stays.
 */
export interface DayMetrics {
    rating_average?: number | null
    ratings_count?: number | null
    uninstalls?: number | null
    impressions?: number | null
    page_views?: number | null
    acquisitions?: number | null
    sessions?: number | null
    session_seconds?: number | null
    session_devices?: number | null
    crashes?: number | null
    anrs?: number | null
    sources?: Record<string, number> | null
}

/** The columns `DayMetrics` may write: the SQL is built from these names only. */
export const METRIC_COLUMNS: (keyof DayMetrics)[] = [
    'rating_average',
    'ratings_count',
    'uninstalls',
    'impressions',
    'page_views',
    'acquisitions',
    'sessions',
    'session_seconds',
    'session_devices',
    'crashes',
    'anrs',
    'sources',
]

/** A written review, the same fields for both stores. */
export interface ReviewRow {
    review_id: string
    rating: number
    title: string | null
    body: string | null
    author: string | null
    territory: string | null
    language: string | null
    version: string | null
    device: string | null
    written_at: Date
    reply: string | null
    replied_at: Date | null
    url: string | null
}

/**
 * Where the first downloads came from, in the same words for both stores:
 * the store's search, browsing it, another app, a website (Apple tells them
 * apart; Google says "referral" for both), an ad, or anything else.
 */
export type SourceKey = 'search' | 'browse' | 'app' | 'web' | 'referral' | 'ads' | 'other'

export function addTo(counts: Record<string, number>, key: string, n: number) {
    counts[key] = (counts[key] ?? 0) + n
}

export function errorMessage(err: any): string {
    return String(err?.message || err || 'Unknown error').slice(0, 500)
}

/** `fetch`, given up after a while, with a message that says which service did not answer. */
export async function request(url: string, init: RequestInit = {}, timeoutMs = 30 * 1000): Promise<Response> {
    try {
        return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
    } catch (err: any) {
        const why = err?.name === 'TimeoutError' ? 'no answer in time' : errorMessage(err)
        throw new StoreError(`Could not reach ${new URL(url).host}: ${why}`)
    }
}

/** The rows of a CSV (or a TSV), keyed by its header line. Quoted fields may hold the separator. */
export function parseTable(text: string, separator = ','): Record<string, string>[] {
    const lines = splitRecords(text.replace(/^﻿/, ''), separator)
    const header = lines.shift()?.map((h) => h.trim())
    if (!header) return []
    return lines
        .filter((cells) => cells.some((c) => c.trim() !== ''))
        .map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ''])))
}

function splitRecords(text: string, separator: string): string[][] {
    const records: string[][] = []
    let cells: string[] = []
    let cell = ''
    let quoted = false
    for (let i = 0; i < text.length; i++) {
        const ch = text[i]
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') {
                cell += '"'
                i++
            } else if (ch === '"') quoted = false
            else cell += ch
        } else if (ch === '"' && cell === '') quoted = true
        else if (ch === separator) {
            cells.push(cell)
            cell = ''
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++
            cells.push(cell)
            records.push(cells)
            cells = []
            cell = ''
        } else cell += ch
    }
    if (cell !== '' || cells.length) {
        cells.push(cell)
        records.push(cells)
    }
    return records
}

/** A number in a report's cell: `1234`, `1,234`, `4.31`. Null when empty, or `NA`. */
export function numberOf(value: string | undefined): number | null {
    const text = (value ?? '').trim()
    if (!text) return null
    const n = Number(text.replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
}

/** A report as the store sends it, gzipped or not. */
export function gunzipped(buffer: Buffer): Buffer {
    return buffer[0] === 0x1f && buffer[1] === 0x8b ? gunzipSync(buffer) : buffer
}

/** The first of the columns that holds a number: reports rename theirs over the years. */
export function cell(row: Record<string, string>, ...names: string[]): number | null {
    for (const name of names) {
        const n = numberOf(row[name])
        if (n != null) return n
    }
    return null
}

/** `2026-10-18`, `Oct 18, 2026` or `10/18/2026` → `2026-10-18`. */
export function dayOf(value: string | undefined): string | null {
    const text = (value ?? '').trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
    const parsed = Date.parse(`${text} UTC`)
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString().slice(0, 10)
}

/** Empty cells as null, the rest trimmed. */
export function textOf(value: string | undefined): string | null {
    const text = (value ?? '').trim()
    return text || null
}

const DAY_MS = 24 * 3600 * 1000

export function shiftDay(day: string, by: number): string {
    return new Date(Date.parse(`${day}T00:00:00Z`) + by * DAY_MS).toISOString().slice(0, 10)
}

export function todayIn(tz: string): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
