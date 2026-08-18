// ──────────────────────────────────────────────────────────────────────────
// `{{ … }}` resolution.
//
// Roots, all of them readable in the builder's variable picker:
//   {{record.*}}   the triggering record, one relation deep
//   {{trigger.*}}  the event payload
//   {{steps.<id>.*}} what an earlier step returned
//   {{vars.*}}     values written by flow.set
//   {{item.*}} / {{loop.index|total}}   inside a for_each
//   {{now.*}}      iso, date, time, day, month, year, hour, minute, day_of_week
//   {{flow.*}} / {{run.*}}   ids and names, for logs and webhook payloads
//
// A pipe applies a filter: `{{record.starts_at | date:"DD/MM HH:mm"}}`. Filters
// exist because the alternative is a customer writing a notification that says
// "your appointment is at 2026-08-19T11:00:00.000Z".
// ──────────────────────────────────────────────────────────────────────────

import type { RunContext } from '../types.js'

const EXPRESSION = /\{\{\s*([^}]+?)\s*\}\}/g

function getPath(source: any, path: string[]): any {
    let current = source
    for (const key of path) {
        if (current === null || current === undefined) return undefined
        if (typeof current !== 'object') return undefined
        current = current[key]
    }
    return current
}

function nowParts(date: Date, timezone?: string): Record<string, any> {
    const iso = date.toISOString()
    return {
        iso,
        timestamp_ms: date.getTime(),
        date: formatDate(date, 'YYYY-MM-DD', timezone),
        time: formatDate(date, 'HH:mm:ss', timezone),
        year: Number(formatDate(date, 'YYYY', timezone)),
        month: Number(formatDate(date, 'MM', timezone)),
        day: Number(formatDate(date, 'DD', timezone)),
        hour: Number(formatDate(date, 'HH', timezone)),
        minute: Number(formatDate(date, 'mm', timezone)),
        day_of_week: formatDate(date, 'dddd', timezone),
    }
}

/**
 * Formats a date with a handful of tokens, in a given zone.
 *
 * Built on `Intl` rather than on arithmetic over the timestamp: an office in
 * Riyadh reading "your appointment is at 09:00" wants 09:00 there, and no
 * amount of adding hours to a UTC value survives a daylight saving change.
 */
export function formatDate(value: any, pattern: string, timezone?: string): string {
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return ''

    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        weekday: 'long',
        hour12: false,
    }
    if (timezone) options.timeZone = timezone

    const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(date)
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''

    // `hour12: false` still renders midnight as 24 in some environments.
    const hour = get('hour') === '24' ? '00' : get('hour')

    return pattern
        .replace(/YYYY/g, get('year'))
        .replace(/MM/g, get('month'))
        .replace(/DD/g, get('day'))
        .replace(/HH/g, hour)
        .replace(/mm/g, get('minute'))
        .replace(/ss/g, get('second'))
        .replace(/dddd/g, get('weekday'))
}

type Filter = (value: any, arg: string | undefined, context: RunContext) => any

const FILTERS: Record<string, Filter> = {
    upper: (v) => String(v ?? '').toUpperCase(),
    lower: (v) => String(v ?? '').toLowerCase(),
    trim: (v) => String(v ?? '').trim(),
    json: (v) => {
        try {
            return JSON.stringify(v)
        } catch {
            return ''
        }
    },
    // `{{record.notes | default:"—"}}` — an empty line in a message is worse
    // than a dash, and a customer cannot write a conditional in a text field.
    default: (v, arg) => (v === null || v === undefined || v === '' ? (arg ?? '') : v),
    date: (v, arg, context) => formatDate(v, arg || 'YYYY-MM-DD HH:mm', context.timezone),
    round: (v, arg) => {
        const n = Number(v)
        if (!Number.isFinite(n)) return ''
        const digits = arg ? parseInt(arg, 10) : 0
        return Number(n.toFixed(Number.isFinite(digits) ? digits : 0))
    },
    length: (v) => (Array.isArray(v) ? v.length : String(v ?? '').length),
    first: (v) => (Array.isArray(v) ? v[0] : v),
}

function splitPipeline(expression: string): { path: string; filters: { name: string; arg?: string }[] } {
    // Split on `|`, but not inside quotes — a separator is a legitimate
    // character in `default:"a | b"`.
    const segments: string[] = []
    let current = ''
    let quote: string | null = null

    for (const char of expression) {
        if (quote) {
            if (char === quote) quote = null
            current += char
            continue
        }
        if (char === '"' || char === "'") {
            quote = char
            current += char
            continue
        }
        if (char === '|') {
            segments.push(current)
            current = ''
            continue
        }
        current += char
    }
    segments.push(current)

    const [path, ...rest] = segments
    const filters = rest.map((segment) => {
        const trimmed = segment.trim()
        const colon = trimmed.indexOf(':')
        if (colon === -1) return { name: trimmed }
        const name = trimmed.slice(0, colon).trim()
        let arg = trimmed.slice(colon + 1).trim()
        if (
            (arg.startsWith('"') && arg.endsWith('"')) ||
            (arg.startsWith("'") && arg.endsWith("'"))
        ) {
            arg = arg.slice(1, -1)
        }
        return { name, arg }
    })

    return { path: path.trim(), filters }
}

function resolvePath(path: string, context: RunContext): any {
    const parts = path.split('.').map((s) => s.trim()).filter(Boolean)
    if (parts.length === 0) return undefined

    const [root, ...rest] = parts

    switch (root) {
        case 'record':
            return getPath(context.record, rest)
        case 'trigger':
            return getPath(context.trigger.payload, rest)
        case 'steps':
        case 'nodes': {
            const [stepId, ...tail] = rest
            if (!stepId) return undefined
            return getPath(context.state.outputs[stepId] ?? {}, tail)
        }
        case 'vars':
            return getPath(context.state.vars, rest)
        case 'item':
            return context.iterator ? getPath(context.iterator.item, rest) : undefined
        case 'loop':
            if (!context.iterator) return undefined
            if (rest[0] === 'index') return context.iterator.index
            if (rest[0] === 'number') return context.iterator.index + 1
            if (rest[0] === 'total') return context.iterator.total
            if (rest[0] === 'item') return getPath(context.iterator.item, rest.slice(1))
            return undefined
        case 'now':
            return getPath(nowParts(new Date(), context.timezone), rest)
        case 'flow':
            return getPath({ id: context.flowId, name: context.flowName }, rest)
        case 'run':
            return getPath({ id: context.runId }, rest)
        default:
            // Bare paths read from the record, so `{{full_name}}` works the way
            // someone who has never seen this syntax expects it to.
            return getPath(context.record, parts)
    }
}

function resolveExpression(expression: string, context: RunContext): any {
    const { path, filters } = splitPipeline(expression)
    let value = resolvePath(path, context)

    for (const filter of filters) {
        const fn = FILTERS[filter.name]
        if (!fn) continue
        value = fn(value, filter.arg, context)
    }

    return value
}

export function renderString(template: string, context: RunContext): string {
    return template.replace(EXPRESSION, (_match, expression) => {
        const value = resolveExpression(expression, context)
        if (value === null || value === undefined) return ''
        if (typeof value === 'string') return value
        if (typeof value === 'number' || typeof value === 'boolean') return String(value)
        if (value instanceof Date) return value.toISOString()
        try {
            return JSON.stringify(value)
        } catch {
            return ''
        }
    })
}

function resolveValue(value: any, context: RunContext): any {
    if (typeof value === 'string') {
        const trimmed = value.trim()
        // A string that is exactly one expression keeps its type: a number stays
        // a number, an array stays an array. Otherwise `for_each` over
        // `{{steps.find.records}}` would receive the string "[object Object],…".
        const single = /^\{\{\s*([^}]+?)\s*\}\}$/.exec(trimmed)
        if (single) return resolveExpression(single[1], context)
        return renderString(value, context)
    }
    if (Array.isArray(value)) return value.map((entry) => resolveValue(entry, context))
    if (value && typeof value === 'object' && !(value instanceof Date)) {
        const out: Record<string, any> = {}
        for (const [key, entry] of Object.entries(value)) {
            out[key] = resolveValue(entry, context)
        }
        return out
    }
    return value
}

export function resolveConfig(
    config: Record<string, any>,
    context: RunContext
): Record<string, any> {
    const out: Record<string, any> = {}
    for (const [key, value] of Object.entries(config || {})) {
        out[key] = resolveValue(value, context)
    }
    return out
}

export { nowParts }
