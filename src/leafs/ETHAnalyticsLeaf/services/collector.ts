// ──────────────────────────────────────────────────────────────────────────
// Turns tracked events into rows, and events into visits.
//
// A visit is found by the app install first, then by the user: the app's own
// events carry the install, a call to the API often only the user. Both point
// at the same visit while it lasts, so what the app reports and what it asks
// the API land together. A visit ends after `sessionTimeoutMinutes` of silence,
// or when the install changes hands.
//
// Rows are written in batches every few seconds, never on the request's path:
// tracking can neither slow a request down nor make it fail. Visits live in
// memory while they last; after a restart the next event finds its visit
// again in the table.
// ──────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'crypto'
import { Op } from 'sequelize'

import { AnalyticsEvent } from '../models/AnalyticsEvent.js'
import { AnalyticsSession } from '../models/AnalyticsSession.js'
import { AnalyticsContext, EventType, clip, normalizePlatform } from './options.js'

export interface TrackedEvent {
    type: EventType
    name: string
    screen?: string | null
    properties?: Record<string, unknown> | null
    duration_ms?: number | null
    status?: number | null
    at?: Date
}

interface Visit {
    id: string
    user_id: number | null
    installation_id: string | null
    platform: string | null
    app_version: string | null
    os_version: string | null
    device_model: string | null
    locale: string | null
    source: 'app' | 'api'
    started_at: Date
    last_seen_at: Date
    screen_count: number
    event_count: number
    entry_screen: string | null
    exit_screen: string | null
    /** When `exit_screen` was opened: a late event cannot replace a newer screen. */
    exit_at: number
}

const FLUSH_EVERY_MS = 5000
const FLUSH_AT = 500
/** Kept in memory when a write fails, then dropped: analytics never eat the server's memory. */
const MAX_BUFFER = 20000

const SESSION_FIELDS = [
    'user_id',
    'installation_id',
    'platform',
    'app_version',
    'os_version',
    'device_model',
    'locale',
    'source',
    'started_at',
    'last_seen_at',
    'screen_count',
    'event_count',
    'entry_screen',
    'exit_screen',
] as const

export class Collector {
    private visits = new Map<string, Visit>()
    private pending = new Map<string, Promise<Visit | null>>()
    private events: any[] = []
    private dirty = new Map<string, Visit>()
    private flushing: Promise<void> | null = null
    private timer?: NodeJS.Timeout
    private sweeper?: NodeJS.Timeout

    constructor(private timeout: number) {}

    start() {
        this.timer ??= setInterval(() => void this.flush(), FLUSH_EVERY_MS)
        this.timer.unref?.()
        this.sweeper ??= setInterval(() => this.sweep(), 60 * 1000)
        this.sweeper.unref?.()
    }

    stop() {
        if (this.timer) clearInterval(this.timer)
        if (this.sweeper) clearInterval(this.sweeper)
        this.timer = this.sweeper = undefined
    }

    /**
     * Records events for one person. Never throws: a broken event is dropped.
     * `source` says who reported them — the app itself, or the API watching
     * the app's calls.
     */
    async track(events: TrackedEvent[], context: AnalyticsContext, source: 'app' | 'api'): Promise<number> {
        const ctx = cleanContext(context)
        if (!ctx.user_id && !ctx.installation_id) return 0

        let kept = 0
        // In time order, so a visit opens with its first event.
        const sorted = [...events].sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0))
        for (const event of sorted) {
            const at = event.at ?? new Date()
            try {
                const visit = await this.visitFor(ctx, at, source)
                if (!visit) continue
                this.apply(visit, event, at)
                this.events.push({
                    session_id: visit.id,
                    user_id: visit.user_id,
                    installation_id: visit.installation_id,
                    type: event.type,
                    name: event.name,
                    screen: event.screen ?? null,
                    properties: event.properties ?? null,
                    duration_ms: event.duration_ms ?? null,
                    status: event.status ?? null,
                    platform: ctx.platform ?? visit.platform,
                    app_version: ctx.app_version ?? visit.app_version,
                    created_at: at,
                })
                kept++
            } catch (err: any) {
                console.error('[ETHAnalyticsLeaf] Could not track an event:', err?.message || err)
            }
        }
        if (this.events.length >= FLUSH_AT) void this.flush()
        return kept
    }

    /** Writes what is waiting. Safe to call at any time; calls overlap into one. */
    flush(): Promise<void> {
        if (this.flushing) return this.flushing
        if (this.events.length === 0 && this.dirty.size === 0) return Promise.resolve()

        const events = this.events.splice(0)
        const visits = Array.from(this.dirty.values())
        this.dirty.clear()

        this.flushing = (async () => {
            try {
                if (visits.length) {
                    await AnalyticsSession.bulkCreate(visits.map(rowOf) as any, {
                        updateOnDuplicate: [...SESSION_FIELDS] as any,
                    })
                }
                if (events.length) {
                    await AnalyticsEvent.bulkCreate(events, { validate: false })
                }
            } catch (err: any) {
                console.error('[ETHAnalyticsLeaf] Could not save analytics:', err?.message || err)
                // Tried again with the next batch, as long as it stays small.
                if (this.events.length + events.length <= MAX_BUFFER) this.events.unshift(...events)
                for (const v of visits) if (!this.dirty.has(v.id)) this.dirty.set(v.id, v)
            } finally {
                this.flushing = null
            }
        })()
        return this.flushing
    }

    /** People in the app right now, from memory: the table lags by a few seconds. */
    liveVisits(withinMs: number): { id: string; user_id: number | null; exit_screen: string | null; last_seen_at: Date }[] {
        const since = Date.now() - withinMs
        const seen = new Set<string>()
        const live: { id: string; user_id: number | null; exit_screen: string | null; last_seen_at: Date }[] = []
        for (const visit of this.visits.values()) {
            if (seen.has(visit.id) || visit.last_seen_at.getTime() < since) continue
            seen.add(visit.id)
            live.push({ id: visit.id, user_id: visit.user_id, exit_screen: visit.exit_screen, last_seen_at: visit.last_seen_at })
        }
        return live
    }

    // ── Visits ───────────────────────────────────────────────────────────

    private keysOf(ctx: AnalyticsContext): string[] {
        const keys: string[] = []
        if (ctx.installation_id) keys.push(`i:${ctx.installation_id}`)
        if (ctx.user_id) keys.push(`u:${ctx.user_id}`)
        return keys
    }

    /** Is `at` inside this visit, or close enough to extend it? */
    private covers(visit: { started_at: Date; last_seen_at: Date }, at: Date): boolean {
        const t = at.getTime()
        return t <= visit.last_seen_at.getTime() + this.timeout && t >= visit.started_at.getTime() - this.timeout
    }

    /** The install is someone else's now, or the user is on another phone: a different visit. */
    private belongs(visit: { user_id: number | null; installation_id: string | null }, ctx: AnalyticsContext): boolean {
        if (visit.user_id && ctx.user_id && visit.user_id !== ctx.user_id) return false
        if (visit.installation_id && ctx.installation_id && visit.installation_id !== ctx.installation_id) return false
        return true
    }

    private async visitFor(ctx: AnalyticsContext, at: Date, source: 'app' | 'api'): Promise<Visit | null> {
        const keys = this.keysOf(ctx)
        for (const key of keys) {
            const visit = this.visits.get(key)
            if (visit && this.covers(visit, at) && this.belongs(visit, ctx)) return this.adopt(visit, ctx, source)
        }

        // One lookup at a time per person, or two parallel calls would open two visits.
        const lock = keys[0]
        const running = this.pending.get(lock)
        if (running) {
            const visit = await running.catch(() => null)
            if (visit && this.covers(visit, at) && this.belongs(visit, ctx)) return this.adopt(visit, ctx, source)
            if (this.pending.get(lock) === running) this.pending.delete(lock)
            return this.visitFor(ctx, at, source)
        }

        const opening = (async () => {
            const stored = await this.storedVisit(ctx, at)
            // The copy in memory is ahead of the table: keep using it.
            const live = stored && keys.map((k) => this.visits.get(k)).find((v) => v?.id === stored.id)
            const visit = live ?? stored ?? this.open(ctx, at, source)
            // A late event from an older visit must not push the current one out.
            for (const key of keys) {
                const current = this.visits.get(key)
                if (!current || current.last_seen_at <= visit.last_seen_at) this.visits.set(key, visit)
            }
            return visit
        })()
        this.pending.set(lock, opening)
        try {
            const visit = await opening
            return visit ? this.adopt(visit, ctx, source) : null
        } finally {
            this.pending.delete(lock)
        }
    }

    /** The visit this person was on before the server restarted, if it is still going. */
    private async storedVisit(ctx: AnalyticsContext, at: Date): Promise<Visit | null> {
        const or: any[] = []
        if (ctx.installation_id) or.push({ installation_id: ctx.installation_id })
        if (ctx.user_id) or.push({ user_id: ctx.user_id })
        const row = await AnalyticsSession.findOne({
            where: {
                [Op.or]: or,
                last_seen_at: { [Op.gte]: new Date(at.getTime() - this.timeout) },
                started_at: { [Op.lte]: new Date(at.getTime() + this.timeout) },
            } as any,
            order: [['last_seen_at', 'DESC']],
        })
        if (!row || !this.belongs(row, ctx)) return null
        const plain = row.get({ plain: true }) as any
        return {
            ...plain,
            source: plain.source === 'app' ? 'app' : 'api',
            started_at: new Date(plain.started_at),
            last_seen_at: new Date(plain.last_seen_at),
            exit_at: new Date(plain.last_seen_at).getTime(),
        }
    }

    private open(ctx: AnalyticsContext, at: Date, source: 'app' | 'api'): Visit {
        return {
            id: randomUUID(),
            user_id: ctx.user_id ?? null,
            installation_id: ctx.installation_id ?? null,
            platform: ctx.platform ?? null,
            app_version: ctx.app_version ?? null,
            os_version: ctx.os_version ?? null,
            device_model: ctx.device_model ?? null,
            locale: ctx.locale ?? null,
            source,
            started_at: at,
            last_seen_at: at,
            screen_count: 0,
            event_count: 0,
            entry_screen: null,
            exit_screen: null,
            exit_at: 0,
        }
    }

    /** Learns what this event says about the visit: who signed in, on which phone. */
    private adopt(visit: Visit, ctx: AnalyticsContext, source: 'app' | 'api'): Visit {
        if (!visit.user_id && ctx.user_id) {
            visit.user_id = ctx.user_id
            this.visits.set(`u:${ctx.user_id}`, visit)
        }
        if (!visit.installation_id && ctx.installation_id) {
            visit.installation_id = ctx.installation_id
            this.visits.set(`i:${ctx.installation_id}`, visit)
        }
        // What the app says about itself beats what the API guessed.
        const trusted = source === 'app'
        for (const field of ['platform', 'app_version', 'os_version', 'device_model', 'locale'] as const) {
            if (ctx[field] && (trusted || !visit[field])) visit[field] = ctx[field] as string
        }
        if (source === 'app') visit.source = 'app'
        return visit
    }

    private apply(visit: Visit, event: TrackedEvent, at: Date) {
        if (at < visit.started_at) visit.started_at = at
        if (at > visit.last_seen_at) visit.last_seen_at = at
        visit.event_count++
        if (event.type === 'screen') {
            visit.screen_count++
            if (!visit.entry_screen) visit.entry_screen = event.name.slice(0, 128)
            if (at.getTime() >= visit.exit_at) {
                visit.exit_screen = event.name.slice(0, 128)
                visit.exit_at = at.getTime()
            }
        }
        this.dirty.set(visit.id, visit)
    }

    /** Forgets visits that ended, once they are written. */
    private sweep() {
        const before = Date.now() - this.timeout * 2
        for (const [key, visit] of this.visits) {
            if (visit.last_seen_at.getTime() < before && !this.dirty.has(visit.id)) this.visits.delete(key)
        }
    }
}

function rowOf(visit: Visit) {
    const { exit_at: _exitAt, ...row } = visit
    return row
}

function cleanContext(ctx: AnalyticsContext): AnalyticsContext {
    const userId = Number(ctx.user_id)
    return {
        user_id: Number.isInteger(userId) && userId > 0 ? userId : null,
        installation_id: clip(ctx.installation_id, 64),
        platform: normalizePlatform(ctx.platform),
        app_version: clip(ctx.app_version, 32),
        os_version: clip(ctx.os_version, 32),
        device_model: clip(ctx.device_model, 64),
        locale: clip(ctx.locale, 16),
    }
}
