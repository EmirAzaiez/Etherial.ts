var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/** A store said no, or could not be reached: the message is shown to the admins as is. */
export class StoreError extends Error {
}
import { gunzipSync } from 'zlib';
/** The columns `DayMetrics` may write: the SQL is built from these names only. */
export const METRIC_COLUMNS = [
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
];
export function addTo(counts, key, n) {
    var _a;
    counts[key] = ((_a = counts[key]) !== null && _a !== void 0 ? _a : 0) + n;
}
export function errorMessage(err) {
    return String((err === null || err === void 0 ? void 0 : err.message) || err || 'Unknown error').slice(0, 500);
}
/** `fetch`, given up after a while, with a message that says which service did not answer. */
export function request(url_1) {
    return __awaiter(this, arguments, void 0, function* (url, init = {}, timeoutMs = 30 * 1000) {
        try {
            return yield fetch(url, Object.assign(Object.assign({}, init), { signal: AbortSignal.timeout(timeoutMs) }));
        }
        catch (err) {
            const why = (err === null || err === void 0 ? void 0 : err.name) === 'TimeoutError' ? 'no answer in time' : errorMessage(err);
            throw new StoreError(`Could not reach ${new URL(url).host}: ${why}`);
        }
    });
}
/** The rows of a CSV (or a TSV), keyed by its header line. Quoted fields may hold the separator. */
export function parseTable(text, separator = ',') {
    var _a;
    const lines = splitRecords(text.replace(/^﻿/, ''), separator);
    const header = (_a = lines.shift()) === null || _a === void 0 ? void 0 : _a.map((h) => h.trim());
    if (!header)
        return [];
    return lines
        .filter((cells) => cells.some((c) => c.trim() !== ''))
        .map((cells) => Object.fromEntries(header.map((h, i) => { var _a; return [h, (_a = cells[i]) !== null && _a !== void 0 ? _a : '']; })));
}
function splitRecords(text, separator) {
    const records = [];
    let cells = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') {
                cell += '"';
                i++;
            }
            else if (ch === '"')
                quoted = false;
            else
                cell += ch;
        }
        else if (ch === '"' && cell === '')
            quoted = true;
        else if (ch === separator) {
            cells.push(cell);
            cell = '';
        }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n')
                i++;
            cells.push(cell);
            records.push(cells);
            cells = [];
            cell = '';
        }
        else
            cell += ch;
    }
    if (cell !== '' || cells.length) {
        cells.push(cell);
        records.push(cells);
    }
    return records;
}
/** A number in a report's cell: `1234`, `1,234`, `4.31`. Null when empty, or `NA`. */
export function numberOf(value) {
    const text = (value !== null && value !== void 0 ? value : '').trim();
    if (!text)
        return null;
    const n = Number(text.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
}
/** A report as the store sends it, gzipped or not. */
export function gunzipped(buffer) {
    return buffer[0] === 0x1f && buffer[1] === 0x8b ? gunzipSync(buffer) : buffer;
}
/** The first of the columns that holds a number: reports rename theirs over the years. */
export function cell(row, ...names) {
    for (const name of names) {
        const n = numberOf(row[name]);
        if (n != null)
            return n;
    }
    return null;
}
/** `2026-10-18`, `Oct 18, 2026` or `10/18/2026` → `2026-10-18`. */
export function dayOf(value) {
    const text = (value !== null && value !== void 0 ? value : '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text))
        return text;
    const parsed = Date.parse(`${text} UTC`);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString().slice(0, 10);
}
/** Empty cells as null, the rest trimmed. */
export function textOf(value) {
    const text = (value !== null && value !== void 0 ? value : '').trim();
    return text || null;
}
const DAY_MS = 24 * 3600 * 1000;
export function shiftDay(day, by) {
    return new Date(Date.parse(`${day}T00:00:00Z`) + by * DAY_MS).toISOString().slice(0, 10);
}
export function todayIn(tz) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
