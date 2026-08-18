// ──────────────────────────────────────────────────────────────────────────
// When a schedule is due.
//
// Two ways to say it, because two kinds of people configure these. Most pick
// "every day at 09:00" from a dropdown; a few want `*/10 * * * *`. Both end up
// here, evaluated against a minute in the flow's timezone — an office that opens
// at 09:00 means 09:00 there, not 09:00 UTC.
// ──────────────────────────────────────────────────────────────────────────

import { formatDate } from '../engine/template.js'

export interface ZonedMinute {
    minute: number
    hour: number
    day: number
    month: number
    /** 0 = Sunday, matching cron. */
    weekday: number
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function zonedMinute(date: Date, timezone?: string): ZonedMinute {
    return {
        minute: Number(formatDate(date, 'mm', timezone)),
        hour: Number(formatDate(date, 'HH', timezone)),
        day: Number(formatDate(date, 'DD', timezone)),
        month: Number(formatDate(date, 'MM', timezone)),
        weekday: Math.max(0, WEEKDAYS.indexOf(formatDate(date, 'dddd', timezone))),
    }
}

// Matches one cron field: `*`, `5`, `1,15`, `1-5`, `*/10`, and combinations.
function matchesField(field: string, value: number, min: number, max: number): boolean {
    for (const part of field.split(',')) {
        const trimmed = part.trim()
        if (!trimmed) continue

        const [range, stepText] = trimmed.split('/')
        const step = stepText ? parseInt(stepText, 10) : 1
        if (!Number.isFinite(step) || step < 1) continue

        let from = min
        let to = max

        if (range !== '*' && range !== '') {
            if (range.includes('-')) {
                const [a, b] = range.split('-').map((n) => parseInt(n, 10))
                if (!Number.isFinite(a) || !Number.isFinite(b)) continue
                from = a
                to = b
            } else {
                const exact = parseInt(range, 10)
                if (!Number.isFinite(exact)) continue
                from = exact
                to = exact
            }
        }

        if (value < from || value > to) continue
        if ((value - from) % step === 0) return true
    }

    return false
}

export function matchesCron(expression: string, at: ZonedMinute): boolean {
    const fields = expression.trim().split(/\s+/)
    if (fields.length !== 5) return false

    const [minute, hour, day, month, weekday] = fields

    return (
        matchesField(minute, at.minute, 0, 59) &&
        matchesField(hour, at.hour, 0, 23) &&
        matchesField(day, at.day, 1, 31) &&
        matchesField(month, at.month, 1, 12) &&
        // Cron accepts 7 for Sunday; normalising here keeps the field matcher
        // free of the exception.
        (matchesField(weekday, at.weekday, 0, 6) ||
            (at.weekday === 0 && matchesField(weekday, 7, 0, 7)))
    )
}

export function isValidCron(expression: string): boolean {
    const fields = expression.trim().split(/\s+/)
    if (fields.length !== 5) return false
    return fields.every((field) => /^[\d*,\-/]+$/.test(field))
}

/**
 * Builds the cron expression the dropdown modes stand for.
 *
 * Going through cron rather than keeping a second scheduler means there is one
 * thing to get right, and the advanced mode is the same code path as the easy
 * one — not a rarely-exercised branch beside it.
 */
export function cronFromConfig(config: Record<string, any>): string | null {
    const mode = config?.mode || 'every_minutes'

    switch (mode) {
        case 'every_minutes': {
            const every = Math.min(59, Math.max(1, Number(config.every_minutes) || 10))
            return `*/${every} * * * *`
        }
        case 'hourly': {
            const minute = clamp(Number(config.minute) || 0, 0, 59)
            return `${minute} * * * *`
        }
        case 'daily': {
            const { hour, minute } = clockOf(config.time, 9, 0)
            return `${minute} ${hour} * * *`
        }
        case 'weekly': {
            const { hour, minute } = clockOf(config.time, 9, 0)
            const weekday = clamp(Number(config.weekday) ?? 1, 0, 6)
            return `${minute} ${hour} * * ${weekday}`
        }
        case 'monthly': {
            const { hour, minute } = clockOf(config.time, 9, 0)
            const day = clamp(Number(config.day_of_month) || 1, 1, 28)
            return `${minute} ${hour} ${day} * *`
        }
        case 'cron':
            return isValidCron(String(config.cron || '')) ? String(config.cron).trim() : null
        default:
            return null
    }
}

function clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min
    return Math.min(max, Math.max(min, Math.trunc(value)))
}

/** `"09:30"` → `{ hour: 9, minute: 30 }`. */
function clockOf(value: any, defaultHour: number, defaultMinute: number): { hour: number; minute: number } {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(value ?? ''))
    if (!match) return { hour: defaultHour, minute: defaultMinute }
    return { hour: clamp(Number(match[1]), 0, 23), minute: clamp(Number(match[2]), 0, 59) }
}
