import { createHash } from 'node:crypto';
import { state } from './state.js';
const ROUTE = '/page-calendar/event.ics';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
/** The API's address the calendar links go through; null when it is not set. */
function base() {
    const url = state.config.publicUrl;
    return url && /^https?:\/\//i.test(url) ? url.replace(/\/+$/, '') : null;
}
/** One line, at most `max` characters: what a calendar shows. */
function line(value, max) {
    return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}
function validDay(value) {
    if (typeof value !== 'string' || !DAY.test(value))
        return false;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
/** The event a link carries, checked: null when it is not one. */
export function eventOf(query) {
    if (!validDay(query.date))
        return null;
    const event = { title: line(query.title, 200), date: query.date };
    if (validDay(query.until) && query.until > query.date)
        event.until = query.until;
    if (typeof query.start === 'string' && TIME.test(query.start)) {
        event.start = query.start;
        if (typeof query.end === 'string' && TIME.test(query.end))
            event.end = query.end;
    }
    const place = line(query.place, 200);
    if (place)
        event.place = place;
    return event;
}
/** The link the page shows: through the API when its address is known, else Google Calendar's. */
export function calendarLinks(event, timezone) {
    const api = base();
    if (!api)
        return { url: googleUrl(event, timezone), choices: null };
    const query = new URLSearchParams();
    for (const key of ['title', 'date', 'until', 'start', 'end', 'place'])
        if (event[key])
            query.set(key, event[key]);
    const url = `${api}${ROUTE}?${query}`;
    return { url, choices: { google: `${url}&as=google`, outlook: `${url}&as=outlook`, file: `${url}&as=file` } };
}
/** What a phone or a computer gets when nothing is asked: Android, Google Calendar; the others, the file. */
export function targetOf(asked, userAgent) {
    if (asked === 'google' || asked === 'outlook' || asked === 'file')
        return asked;
    return /android/i.test(userAgent) ? 'google' : 'file';
}
// ── When it is ──────────────────────────────────────────────────────────────
function dayOf(date) {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}
function plusDays(date, days) {
    return new Date(date.getTime() + days * 86400000);
}
/** Its first moment and the one after its last, as the clocks of the place read them (a whole day: the day after). */
function span(event) {
    const first = dayOf(event.date);
    const last = event.until ? dayOf(event.until) : first;
    if (!event.start)
        return { start: first, end: plusDays(last, 1), allDay: true };
    const minutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
    const start = new Date(first.getTime() + minutes(event.start) * 60000);
    if (!event.end)
        return { start, end: new Date(last.getTime() + (minutes(event.start) + 60) * 60000), allDay: false };
    // 22:00 → 02:00 on one day ends the next morning.
    const endDay = !event.until && event.end <= event.start ? plusDays(first, 1) : last;
    return { start, end: new Date(endDay.getTime() + minutes(event.end) * 60000), allDay: false };
}
/** How far ahead of UTC the zone's clocks are at that moment, in ms; null for a zone Intl doesn't know. */
function offsetAt(zone, at) {
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
        }).formatToParts(new Date(at));
        const n = (type) => { var _a; return Number((_a = parts.find((p) => p.type === type)) === null || _a === void 0 ? void 0 : _a.value); };
        return Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second')) - at;
    }
    catch (_a) {
        return null;
    }
}
/** The clocks' time in the zone, as a real moment; null without a zone (the phone's own clock then). */
function inZone(wall, zone) {
    var _a;
    if (!zone)
        return null;
    const first = offsetAt(zone, wall.getTime());
    if (first === null)
        return null;
    // Again from the moment found: right across a change of time too.
    const offset = (_a = offsetAt(zone, wall.getTime() - first)) !== null && _a !== void 0 ? _a : first;
    return new Date(wall.getTime() - offset);
}
/** `20261114`, `20261114T190000`, or `20261114T150000Z`. */
function stamp(date, kind) {
    const iso = date.toISOString().replace(/[-:]/g, '');
    if (kind === 'day')
        return iso.slice(0, 8);
    return kind === 'utc' ? `${iso.slice(0, 15)}Z` : iso.slice(0, 15);
}
// ── Google Calendar, Outlook ───────────────────────────────────────────────
/** Google Calendar's "new event" page, filled in. */
export function googleUrl(event, timezone) {
    const { start, end, allDay } = span(event);
    const dates = allDay ? `${stamp(start, 'day')}/${stamp(end, 'day')}` : `${stamp(start, 'wall')}/${stamp(end, 'wall')}`;
    const params = [
        'action=TEMPLATE',
        event.title ? `text=${encodeURIComponent(event.title)}` : '',
        `dates=${dates}`,
        event.place ? `location=${encodeURIComponent(event.place)}` : '',
        timezone && !allDay ? `ctz=${encodeURIComponent(timezone).replace(/%2F/gi, '/')}` : '',
    ];
    return `https://calendar.google.com/calendar/render?${params.filter(Boolean).join('&')}`;
}
/** Outlook's "new event" page (outlook.com), filled in. */
export function outlookUrl(event, timezone) {
    const { start, end, allDay } = span(event);
    const at = (wall) => {
        if (allDay)
            return wall.toISOString().slice(0, 10);
        const real = inZone(wall, timezone);
        return real ? real.toISOString().replace(/\.\d{3}Z$/, 'Z') : wall.toISOString().slice(0, 19);
    };
    const query = new URLSearchParams({ path: '/calendar/action/compose', rru: 'addevent', subject: event.title, startdt: at(start), enddt: at(end), allday: String(allDay) });
    if (event.place)
        query.set('location', event.place);
    return `https://outlook.live.com/calendar/0/action/compose?${query}`;
}
// ── The file ───────────────────────────────────────────────────────────────
function escapeText(value) {
    return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
/** A line of at most 75 bytes, the rest on the next ones, each after a space (RFC 5545 §3.1). */
function fold(text) {
    const lines = [];
    let current = '';
    let bytes = 0;
    for (const char of text) {
        const size = Buffer.byteLength(char);
        if (bytes + size > (lines.length ? 74 : 75)) {
            lines.push(current);
            current = '';
            bytes = 0;
        }
        current += char;
        bytes += size;
    }
    lines.push(current);
    return lines.join('\r\n ');
}
/** The event as a calendar file: its times in UTC when the zone is known, else as the phone's clock reads them. */
export function icsOf(event, timezone) {
    const { start, end, allDay } = span(event);
    const time = (name, wall) => {
        if (allDay)
            return `${name};VALUE=DATE:${stamp(wall, 'day')}`;
        const real = inZone(wall, timezone);
        return real ? `${name}:${stamp(real, 'utc')}` : `${name}:${stamp(wall, 'wall')}`;
    };
    const uid = createHash('sha256').update(JSON.stringify(event)).digest('hex').slice(0, 32);
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
    ];
    return lines.filter(Boolean).map(fold).join('\r\n') + '\r\n';
}
/** The file's name: its title in plain letters. */
export function fileNameOf(event) {
    const name = event.title
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase()
        .slice(0, 60);
    return `${name || 'event'}.ics`;
}
