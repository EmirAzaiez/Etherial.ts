import etherial from 'etherial'
import type { Request, Response } from 'express'
import { Controller, Get } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'

import { EVENTS_COLLECTION } from '../services/options.js'
import {
    ReportError,
    ensurePostgres,
    events,
    flows,
    funnel,
    live,
    overview,
    parseSteps,
    rangeOf,
    retention,
    session,
    userActivity,
} from '../services/reports.js'

type AuthedRequest = Request & { user: any }

/**
 * Whoever may list the analytics events may read every report: one switch in
 * a role's permissions opens the whole Analytics page.
 */
async function guard(req: AuthedRequest, res: Response, run: () => Promise<unknown>): Promise<any> {
    const adminLeaf = (etherial as any).eth_admin_leaf
    const allowed =
        !!adminLeaf &&
        (await adminLeaf.canAccessAdmin(req.user)) &&
        (await adminLeaf.checkAccess(req.user, EVENTS_COLLECTION, 'list'))
    if (!allowed) return (res as any).error({ status: 403, errors: ['forbidden'] })
    try {
        ensurePostgres()
        return (res as any).success({ status: 200, data: await run() })
    } catch (err: any) {
        if (err instanceof ReportError) return (res as any).error({ status: err.status, errors: [err.code] })
        console.error('[ETHAnalyticsLeaf] Report failed:', err?.message || err)
        return (res as any).error({ status: 500, errors: ['report_failed'] })
    }
}

const FLOW_TYPES = ['screen', 'action', 'api'] as const
const LIST_TYPES = ['screen', 'action', 'api', 'app'] as const

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
    return allowed.includes(value as T) ? (value as T) : fallback
}

// Under /admin/insights, not /admin/analytics: EasyPrivacy (uBlock, AdBlock) blocks
// any URL containing `/analytics/event`, so the reports would come back empty for
// every admin running an ad blocker.
@Controller()
export default class ETHAnalyticsAdminController {
    /** GET /admin/insights/overview?from=YYYY-MM-DD&to=YYYY-MM-DD */
    @Get('/admin/insights/overview')
    @ShouldBeAuthenticated()
    async overview(req: AuthedRequest, res: Response) {
        return guard(req, res, () => overview(rangeOf(req.query)))
    }

    /** GET /admin/insights/live — who is in the app in the last 5 minutes. */
    @Get('/admin/insights/live')
    @ShouldBeAuthenticated()
    async live(req: AuthedRequest, res: Response) {
        return guard(req, res, () => live())
    }

    /** GET /admin/insights/events?type=screen|action|api|app&from&to */
    @Get('/admin/insights/events')
    @ShouldBeAuthenticated()
    async events(req: AuthedRequest, res: Response) {
        return guard(req, res, () => events(oneOf(req.query.type, LIST_TYPES, 'screen'), rangeOf(req.query)))
    }

    /** GET /admin/insights/flows?type=screen&name=HomeScreen&from&to */
    @Get('/admin/insights/flows')
    @ShouldBeAuthenticated()
    async flows(req: AuthedRequest, res: Response) {
        const name = typeof req.query.name === 'string' && req.query.name ? req.query.name.slice(0, 160) : undefined
        return guard(req, res, () => flows(oneOf(req.query.type, FLOW_TYPES, 'screen'), rangeOf(req.query), name))
    }

    /** GET /admin/insights/funnel?steps=screen:A,api:POST /x&scope=session|person&from&to */
    @Get('/admin/insights/funnel')
    @ShouldBeAuthenticated()
    async funnel(req: AuthedRequest, res: Response) {
        const scope = oneOf(req.query.scope, ['session', 'person'] as const, 'session')
        return guard(req, res, () => funnel(parseSteps(req.query.steps), rangeOf(req.query), scope))
    }

    /** GET /admin/insights/retention?weeks=8&who=users|all */
    @Get('/admin/insights/retention')
    @ShouldBeAuthenticated()
    async retention(req: AuthedRequest, res: Response) {
        const weeks = Math.min(Math.max(Number(req.query.weeks) || 8, 2), 26)
        return guard(req, res, () => retention(weeks, oneOf(req.query.who, ['users', 'all'] as const, 'users')))
    }

    /** GET /admin/insights/users/:id?before=<ISO date> — one user's visits and habits. */
    @Get('/admin/insights/users/:id')
    @ShouldBeAuthenticated()
    async user(req: AuthedRequest, res: Response) {
        const id = Number(req.params.id)
        const before = typeof req.query.before === 'string' && !Number.isNaN(Date.parse(req.query.before)) ? new Date(req.query.before) : undefined
        if (!Number.isInteger(id) || id <= 0) return (res as any).error({ status: 400, errors: ['invalid_id'] })
        return guard(req, res, () => userActivity(id, before))
    }

    /** GET /admin/insights/sessions/:id — one visit, step by step. */
    @Get('/admin/insights/sessions/:id')
    @ShouldBeAuthenticated()
    async session(req: AuthedRequest, res: Response) {
        const id = String(req.params.id).slice(0, 36)
        return guard(req, res, () => session(id))
    }
}
