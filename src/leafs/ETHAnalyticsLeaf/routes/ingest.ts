import etherial from 'etherial'
import type { Request, Response } from 'express'
import { Controller, Post } from 'etherial/components/http/provider'

import { state } from '../services/state.js'
import { TrackedEvent } from '../services/collector.js'
import { EVENT_TYPES, EventType, clip, ingestOptions } from '../services/options.js'

/** Route names, event keys: letters of any script, digits, and a little punctuation. */
const NAME = /^[\p{L}\p{N} _.:\-/()&]{1,128}$/u
/** Keys that should never be sent, and are dropped if they are. */
const SECRET_KEY = /pass|token|secret|otp|code|pin|card|cvv|iban/i
const MAX_PROPERTIES_BYTES = 2048
/** Clocks drift and phones queue events offline: older than 2 days or ahead of us is set to now. */
const MAX_PAST_MS = 2 * 24 * 3600 * 1000
const MAX_FUTURE_MS = 5 * 60 * 1000

/** A burst of batches from one address is slowed down: a broken loop in an app, or worse. */
const WINDOW_MS = 60 * 1000
const MAX_BATCHES_PER_WINDOW = 120
const recent = new Map<string, { since: number; count: number }>()

function allowed(key: string): boolean {
    const now = Date.now()
    const entry = recent.get(key)
    if (!entry || now - entry.since > WINDOW_MS) {
        if (recent.size > 10000) recent.clear()
        recent.set(key, { since: now, count: 1 })
        return true
    }
    entry.count++
    return entry.count <= MAX_BATCHES_PER_WINDOW
}

function properties(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const kept: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value as Record<string, unknown>).slice(0, 20)) {
        if (SECRET_KEY.test(key)) continue
        if (typeof v === 'string') kept[key.slice(0, 64)] = v.slice(0, 256)
        else if (typeof v === 'number' || typeof v === 'boolean' || v === null) kept[key.slice(0, 64)] = v
    }
    if (Object.keys(kept).length === 0) return null
    return JSON.stringify(kept).length <= MAX_PROPERTIES_BYTES ? kept : null
}

function dateOf(value: unknown, now: number): Date {
    const t = typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : NaN
    if (!Number.isFinite(t) || t < now - MAX_PAST_MS || t > now + MAX_FUTURE_MS) return new Date(now)
    return new Date(Math.min(t, now))
}

function eventOf(raw: any, now: number): TrackedEvent | null {
    if (!raw || typeof raw !== 'object') return null
    const type = String(raw.type ?? '') as EventType
    const name = typeof raw.name === 'string' ? raw.name.trim() : ''
    if (!EVENT_TYPES.includes(type) || type === 'api' || !NAME.test(name)) return null
    const screen = typeof raw.screen === 'string' && NAME.test(raw.screen.trim()) ? raw.screen.trim() : null
    const duration = Number(raw.duration_ms)
    return {
        type,
        name,
        screen,
        properties: properties(raw.properties),
        // Time on a screen: more than a day is a phone left open.
        duration_ms: Number.isFinite(duration) && duration >= 0 ? Math.min(Math.round(duration), 24 * 3600 * 1000) : null,
        at: dateOf(raw.at, now),
    }
}

@Controller()
export default class ETHAnalyticsIngestController {
    /**
     * POST /analytics/events
     *
     * { installation_id, platform, app_version, os_version, device_model, locale,
     *   events: [{ type: 'screen' | 'action' | 'app', name, screen?, properties?, duration_ms?, at? }] }
     *
     * Signed in or not: a valid token names the user, anything else is a guest.
     * Always answers 202 with what it kept, so a phone never retries a batch
     * because one event in it was wrong.
     */
    @Post('/analytics/events')
    async ingest(req: Request, res: Response): Promise<any> {
        const options = ingestOptions(state.config)
        const collector = state.collector
        if (!options || !collector) return (res as any).error({ status: 404, errors: ['not_found'] })

        const body = (req.body ?? {}) as any
        const installation = clip(body.installation_id, 64)
        const ip = String(req.headers['x-forwarded-for'] ?? req.ip ?? '').split(',')[0].trim()
        if (!allowed(installation ?? ip)) return (res as any).error({ status: 429, errors: ['too_many_requests'] })

        const list = Array.isArray(body.events) ? body.events.slice(0, options.maxBatch) : []
        const now = Date.now()
        const events = list.map((raw: any) => eventOf(raw, now)).filter((e: TrackedEvent | null): e is TrackedEvent => !!e)

        let user: any = null
        const auth = req.headers.authorization
        if (auth?.startsWith('Bearer ')) {
            user = await (etherial as any).http_auth?.userFromToken(auth.slice(7)).catch(() => null)
        }
        if (user && state.config.excludeUser?.(user)) {
            return (res as any).success({ status: 202, data: { accepted: 0 } })
        }
        const userId = Number(typeof user?.get === 'function' ? user.get('id') : user?.id)

        const accepted = events.length
            ? await collector.track(
                  events,
                  {
                      user_id: Number.isInteger(userId) ? userId : null,
                      installation_id: installation,
                      platform: body.platform,
                      app_version: body.app_version,
                      os_version: body.os_version,
                      device_model: body.device_model,
                      locale: body.locale,
                  },
                  'app'
              )
            : 0
        return (res as any).success({ status: 202, data: { accepted } })
    }
}
