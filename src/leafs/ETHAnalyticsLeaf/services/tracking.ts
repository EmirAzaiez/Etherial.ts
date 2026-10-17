// ──────────────────────────────────────────────────────────────────────────
// API tracking: every call a signed-in user's app makes becomes an `api`
// event named after the route it hit — `GET /users/me/tickets/:ticket_id` —
// with its parameters, status and duration.
//
// The middleware is mounted before every controller and only listens for the
// response to finish: by then the route that answered and the user it
// authenticated are both on the request. Nothing is awaited on the request's
// path, and nothing that goes wrong here reaches the caller.
//
// A public route (a catalogue the app also shows signed-out) never
// authenticates anyone: when the call still carries a token, the user it
// belongs to is looked up here, after the answer, with the auth middleware's
// own checks.
// ──────────────────────────────────────────────────────────────────────────

import etherial from 'etherial'
import type { Request, Response, NextFunction } from 'express'

import { Collector } from './collector.js'
import { AnalyticsContext, ETHAnalyticsLeafConfig, TrackApiConfig } from './options.js'

const IDENTIFY_TTL_MS = 10 * 60 * 1000
const MAX_PARAM_LENGTH = 64

function matches(rule: string | RegExp, path: string): boolean {
    if (rule instanceof RegExp) return rule.test(path)
    if (rule.endsWith('*')) return path.startsWith(rule.slice(0, -1))
    return path === rule
}

/** `/tickets/:id(\\d+)` → `/tickets/:id`: the pattern is how the route matches, not what it is. */
export function cleanRoute(path: string): string {
    return path.replace(/(:\w+)\((?:[^()]|\([^()]*\))*\)/g, '$1')
}

function idOf(user: any): number | null {
    const id = Number(typeof user?.get === 'function' ? user.get('id') : user?.id)
    return Number.isInteger(id) && id > 0 ? id : null
}

function header(req: Request, name: string): string | null {
    const value = req.headers[name]
    const first = Array.isArray(value) ? value[0] : value
    return first?.trim() || null
}

/** What the app says about itself in its request headers, when it does. */
export function contextFromHeaders(req: Request): AnalyticsContext {
    return {
        installation_id: header(req, 'x-installation-id'),
        platform: header(req, 'x-app-platform'),
        app_version: header(req, 'x-app-version'),
        os_version: header(req, 'x-os-version'),
        device_model: header(req, 'x-device-model'),
        locale: header(req, 'x-app-locale'),
    }
}

/** `identify()` answers, kept a few minutes per user so it is not asked on every call. */
export class IdentifyCache {
    private cache = new Map<number, { at: number; value: AnalyticsContext | null }>()

    constructor(private identify?: ETHAnalyticsLeafConfig['identify']) {}

    async get(userId: number, user: any, req: Request): Promise<AnalyticsContext | null> {
        if (!this.identify) return null
        const hit = this.cache.get(userId)
        if (hit && Date.now() - hit.at < IDENTIFY_TTL_MS) return hit.value
        let value: AnalyticsContext | null = null
        try {
            value = (await this.identify(user, req)) ?? null
        } catch (err: any) {
            console.error('[ETHAnalyticsLeaf] identify() failed:', err?.message || err)
        }
        if (this.cache.size > 5000) this.cache.clear()
        this.cache.set(userId, { at: Date.now(), value })
        return value
    }
}

export function apiTrackingMiddleware(
    options: TrackApiConfig,
    config: ETHAnalyticsLeafConfig,
    collector: Collector,
    identity: IdentifyCache,
    skipPrefixes: string[]
) {
    const methods = options.methods?.map((m) => m.toUpperCase())

    const record = async (req: Request & { user?: any }, res: Response, startedAt: bigint) => {
        const rawPath = (req as any).route?.path
        if (typeof rawPath !== 'string') return
        const routePath = cleanRoute(rawPath)
        if (skipPrefixes.some((prefix) => routePath === prefix || routePath.startsWith(prefix + '/'))) return
        if (options.exclude?.some((rule) => matches(rule, routePath))) return
        if (options.include && !options.include.some((rule) => matches(rule, routePath))) return

        const user = req.user ?? (await userFromBearer(req))
        const userId = idOf(user)
        const fromHeaders = contextFromHeaders(req)
        if (!userId && !(options.guests && fromHeaders.installation_id)) return
        if (user && config.excludeUser?.(user)) return

        const identified = userId ? await identity.get(userId, user, req) : null
        // The headers describe this very call; identify() only the user's latest device.
        const context: AnalyticsContext = { ...identified, ...dropEmpty(fromHeaders), user_id: userId }

        const params = Object.fromEntries(
            Object.entries(req.params ?? {}).map(([k, v]) => [k, String(v).slice(0, MAX_PARAM_LENGTH)])
        )
        await collector.track(
            [
                {
                    type: 'api',
                    name: `${req.method} ${routePath}`.slice(0, 160),
                    properties: Object.keys(params).length ? params : null,
                    duration_ms: Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6),
                    status: res.statusCode,
                    at: new Date(),
                },
            ],
            context,
            'api'
        )
    }

    return (req: Request, res: Response, next: NextFunction) => {
        if (req.method === 'OPTIONS' || req.method === 'HEAD' || (methods && !methods.includes(req.method))) return next()
        const startedAt = process.hrtime.bigint()
        res.once('finish', () => {
            record(req, res, startedAt).catch((err: any) =>
                console.error('[ETHAnalyticsLeaf] API tracking:', err?.message || err)
            )
        })
        next()
    }
}

/** The user behind a public route's bearer token, or null. */
async function userFromBearer(req: Request): Promise<any | null> {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) return null
    return (await (etherial as any).http_auth?.userFromToken(auth.slice(7)).catch(() => null)) ?? null
}

function dropEmpty(ctx: AnalyticsContext): AnalyticsContext {
    return Object.fromEntries(Object.entries(ctx).filter(([, v]) => v !== null && v !== undefined && v !== '')) as AnalyticsContext
}
