import { createHash } from 'node:crypto'

import { state } from './state.js'

// ──────────────────────────────────────────────────────────────────────────
// An event's "Add to calendar": one link, through the API, that answers what
// the phone it is opened on can take. An iPhone gets the event as a file
// (`.ics`): Safari shows it and offers to add it. An Android phone has no
// such sheet, it goes to Google Calendar's "new event" page. A computer gets
// the file (Calendar, Outlook open it); the web page offers Google Calendar
// and Outlook beside it, for those who keep their calendar in a browser.
// Without the API's address (`publicUrl`) the link is Google Calendar's, as
// before.
// ──────────────────────────────────────────────────────────────────────────

/** An event as a calendar gets it: `date` / `until`: `YYYY-MM-DD`; `start` / `end`: `HH:MM`, in the project's timezone. */
export interface CalendarEvent {
    title: string
    date: string
    until?: string
    start?: string
    end?: string
    place?: string
}

export type CalendarTarget = 'google' | 'outlook' | 'file'

const ROUTE = '/page-calendar/event.ics'
const DAY = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** The API's address the calendar links go through; null when it is not set. */
function base(): string | null {
    const url = state.config.publicUrl
    return url && /^https?:\/\//i.test(url) ? url.replace(/\/+$/, '') : null
}

/** One line, at most `max` characters: what a calendar shows. */
function line(value: unknown, max: number): string {
    return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function validDay(value: unknown): value is string {
    if (typeof value !== 'string' || !DAY.test(value)) return false
    const [y, m, d] = value.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))
    return date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/** The event a link carries, checked: null when it is not one. */
export function eventOf(query: Record<string, unknown>): CalendarEvent | null {
    if (!validDay(query.date)) return null
    const event: CalendarEvent = { title: line(query.title, 200), date: query.date }
    if (validDay(query.until) && query.until > query.date) event.until = query.until
    if (typeof query.start === 'string' && TIME.test(query.start)) {
        event.start = query.start
        if (typeof query.end === 'string' && TIME.test(query.end)) event.end = query.end
    }
    const place = line(query.place, 200)
    if (place) event.place = place
    return event
}

/** The link the page shows: through the API when its address is known, else Google Calendar's. */
export function calendarLinks(event: CalendarEvent, timezone?: string): { url: string; choices: Record<CalendarTarget, string> | null } {
    const api = base()
    if (!api) return { url: googleUrl(event, timezone), choices: null }
    const query = new URLSearchParams()
    for (const key of ['title', 'date', 'until', 'start', 'end', 'place'] as const) if (event[key]) query.set(key, event[key]!)
    const url = `${api}${ROUTE}?${query}`
    return { url, choices: { google: `${url}&as=google`, outlook: `${url}&as=outlook`, file: `${url}&as=file` } }
}

/** What a phone or a computer gets when nothing is asked: Android, Google Calendar; the others, the file. */
export function targetOf(asked: unknown, userAgent: string): CalendarTarget {
    if (asked === 'google' || asked === 'outlook' || asked === 'file') return asked
    return /android/i.test(userAgent) ? 'google' : 'file'
}

// ── When it is ──────────────────────────────────────────────────────────────

function dayOf(date: string): Date {
    const [y, m, d] = date.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d))
}

function plusDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 86400000)
}

/** Its first moment and the one after its last, as the clocks of the place read them (a whole day: the day after). */
function span(event: CalendarEvent): { start: Date; end: Date; allDay: boolean } {
    const first = dayOf(event.date)
    const last = event.until ? dayOf(event.until) : first
    if (!event.start) return { start: first, end: plusDays(last, 1), allDay: true }
    const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
    const start = new Date(first.getTime() + minutes(event.start) * 60000)
    if (!event.end) return { start, end: new Date(last.getTime() + (minutes(event.start) + 60) * 60000), allDay: false }
    // 22:00 → 02:00 on one day ends the next morning.
    const endDay = !event.until && event.end <= event.start ? plusDays(first, 1) : last
    return { start, end: new Date(endDay.getTime() + minutes(event.end) * 60000), allDay: false }
}

/** How far ahead of UTC the zone's clocks are at that moment, in ms; null for a zone Intl doesn't know. */
function offsetAt(zone: string, at: number): number | null {
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: zone,
            hourCycle: 'h23',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
        }).formatToParts(new Date(at))
        const n = (type: string) => Number(parts.find((p) => p.type === type)?.value)
        return Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second')) - at
    } catch {
        return null
    }
}

/** The clocks' time in the zone, as a real moment; null without a zone (the phone's own clock then). */
function inZone(wall: Date, zone?: string): Date | null {
    if (!zone) return null
    const first = offsetAt(zone, wall.getTime())
    if (first === null) return null
    // Again from the moment found: right across a change of time too.
    const offset = offsetAt(zone, wall.getTime() - first) ?? first
    return new Date(wall.getTime() - offset)
}

/** `20261114`, `20261114T190000`, or `20261114T150000Z`. */
function stamp(date: Date, kind: 'day' | 'wall' | 'utc'): string {
    const iso = date.toISOString().replace(/[-:]/g, '')
    if (kind === 'day') return iso.slice(0, 8)
    return kind === 'utc' ? `${iso.slice(0, 15)}Z` : iso.slice(0, 15)
}

// ── Google Calendar, Outlook ───────────────────────────────────────────────

/** Google Calendar's "new event" page, filled in. */
export function googleUrl(event: CalendarEvent, timezone?: string): string {
    const { start, end, allDay } = span(event)
    const dates = allDay ? `${stamp(start, 'day')}/${stamp(end, 'day')}` : `${stamp(start, 'wall')}/${stamp(end, 'wall')}`
    const params = [
        'action=TEMPLATE',
        event.title ? `text=${encodeURIComponent(event.title)}` : '',
        `dates=${dates}`,
        event.place ? `location=${encodeURIComponent(event.place)}` : '',
        timezone && !allDay ? `ctz=${encodeURIComponent(timezone).replace(/%2F/gi, '/')}` : '',
    ]
    return `https://calendar.google.com/calendar/render?${params.filter(Boolean).join('&')}`
}

/** Outlook's "new event" page (outlook.com), filled in. */
export function outlookUrl(event: CalendarEvent, timezone?: string): string {
    const { start, end, allDay } = span(event)
    const at = (wall: Date) => {
        if (allDay) return wall.toISOString().slice(0, 10)
        const real = inZone(wall, timezone)
        return real ? real.toISOString().replace(/\.\d{3}Z$/, 'Z') : wall.toISOString().slice(0, 19)
    }
    const query = new URLSearchParams({ path: '/calendar/action/compose', rru: 'addevent', subject: event.title, startdt: at(start), enddt: at(end), allday: String(allDay) })
    if (event.place) query.set('location', event.place)
    return `https://outlook.live.com/calendar/0/action/compose?${query}`
}

// ── The file ───────────────────────────────────────────────────────────────

function escapeText(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** A line of at most 75 bytes, the rest on the next ones, each after a space (RFC 5545 §3.1). */
function fold(text: string): string {
    const lines: string[] = []
    let current = ''
    let bytes = 0
    for (const char of text) {
        const size = Buffer.byteLength(char)
        if (bytes + size > (lines.length ? 74 : 75)) {
            lines.push(current)
            current = ''
            bytes = 0
        }
        current += char
        bytes += size
    }
    lines.push(current)
    return lines.join('\r\n ')
}

/** The event as a calendar file: its times in UTC when the zone is known, else as the phone's clock reads them. */
export function icsOf(event: CalendarEvent, timezone?: string): string {
    const { start, end, allDay } = span(event)
    const time = (name: string, wall: Date) => {
        if (allDay) return `${name};VALUE=DATE:${stamp(wall, 'day')}`
        const real = inZone(wall, timezone)
        return real ? `${name}:${stamp(real, 'utc')}` : `${name}:${stamp(wall, 'wall')}`
    }
    const uid = createHash('sha256').update(JSON.stringify(event)).digest('hex').slice(0, 32)
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Etherial//Pages//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${uid}@etherial-pages`,
        `DTSTAMP:${stamp(new Date(), 'utc')}`,
        time('DTSTART', start),
        time('DTEND', end),
        `SUMMARY:${escapeText(event.title || 'Event')}`,
        event.place ? `LOCATION:${escapeText(event.place)}` : '',
        'END:VEVENT',
        'END:VCALENDAR',
    ]
    return lines.filter(Boolean).map(fold).join('\r\n') + '\r\n'
}

/** The file's name: its title in plain letters. */
export function fileNameOf(event: CalendarEvent): string {
    const name = event.title
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase()
        .slice(0, 60)
    return `${name || 'event'}.ics`
}
