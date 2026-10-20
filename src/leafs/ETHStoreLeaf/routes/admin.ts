import etherial from 'etherial'
import type { Request, Response } from 'express'
import { Controller, Get, Post } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'

import { STATS_COLLECTION, STORES, StoreName } from '../services/options.js'
import { ReportError, ensurePostgres, overview, reviewsOf } from '../services/reports.js'
import { syncStores } from '../services/sync.js'

type AuthedRequest = Request & { user: any }

/** How long "Sync now" waits before it answers: a long backfill goes on, and the page asks again. */
const SYNC_WAIT_MS = 20 * 1000

/** Whoever may list the daily rows may read the page and sync it: one switch in a role's permissions. */
async function guard(req: AuthedRequest, res: Response, run: () => Promise<unknown>): Promise<any> {
    const adminLeaf = (etherial as any).eth_admin_leaf
    const allowed =
        !!adminLeaf &&
        (await adminLeaf.canAccessAdmin(req.user)) &&
        (await adminLeaf.checkAccess(req.user, STATS_COLLECTION, 'list'))
    if (!allowed) return (res as any).error({ status: 403, errors: ['forbidden'] })
    try {
        ensurePostgres()
        return (res as any).success({ status: 200, data: await run() })
    } catch (err: any) {
        if (err instanceof ReportError) return (res as any).error({ status: err.status, errors: [err.code] })
        console.error('[ETHStoreLeaf] Report failed:', err?.message || err)
        return (res as any).error({ status: 500, errors: ['report_failed'] })
    }
}

@Controller()
export default class ETHStoreAdminController {
    /** GET /admin/stores/overview?from=YYYY-MM-DD&to=YYYY-MM-DD */
    @Get('/admin/stores/overview')
    @ShouldBeAuthenticated()
    async overview(req: AuthedRequest, res: Response) {
        return guard(req, res, () => overview(req.query))
    }

    /** GET /admin/stores/reviews?from=&to=&store=&stars=&replied=yes|no&page= */
    @Get('/admin/stores/reviews')
    @ShouldBeAuthenticated()
    async reviews(req: AuthedRequest, res: Response) {
        return guard(req, res, () => reviewsOf(req.query))
    }

    /**
     * POST /admin/stores/sync { store? } — reads the stores now. `done` once
     * it is over, `running` when it goes on past the wait, `busy` when another
     * sync already runs.
     */
    @Post('/admin/stores/sync')
    @ShouldBeAuthenticated()
    async sync(req: AuthedRequest, res: Response) {
        return guard(req, res, async () => {
            const asked = req.body?.store
            const only = STORES.includes(asked) ? (asked as StoreName) : undefined
            const run = syncStores({ force: true, only })
            run.catch((err) => console.error('[ETHStoreLeaf] Sync failed:', err?.message || err))
            const outcome = await Promise.race([
                run.then((ran) => (ran ? 'done' : 'busy')),
                new Promise<'running'>((resolve) => setTimeout(() => resolve('running'), SYNC_WAIT_MS).unref?.()),
            ])
            return { outcome }
        })
    }
}
