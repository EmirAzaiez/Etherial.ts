import etherial from 'etherial'
import type { Request, Response } from 'express'
import { Controller, Get } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'

import { FORMS_COLLECTION, RESPONSES_COLLECTION } from '../services/options.js'
import { adminInfoOf, allSurveys, eventOf } from '../services/forms.js'
import { ReportError, comments, ensurePostgres, overview, userResponses } from '../services/reports.js'

type AuthedRequest = Request & { user: any }

/** Whoever may list the answers may read the reports: one switch in a role's permissions. */
const readsAnswers = (adminLeaf: any, user: any) => adminLeaf.checkAccess(user, RESPONSES_COLLECTION, 'list')

/** Whoever may write a survey may see what it can be narrowed to. */
const writesSurveys = async (adminLeaf: any, user: any) =>
    (await adminLeaf.checkAccess(user, FORMS_COLLECTION, 'create')) || (await adminLeaf.checkAccess(user, FORMS_COLLECTION, 'update'))

async function guard(
    req: AuthedRequest,
    res: Response,
    run: () => Promise<unknown>,
    may: (adminLeaf: any, user: any) => Promise<boolean> = readsAnswers
): Promise<any> {
    const adminLeaf = (etherial as any).eth_admin_leaf
    const allowed = !!adminLeaf && (await adminLeaf.canAccessAdmin(req.user)) && (await may(adminLeaf, req.user))
    if (!allowed) return (res as any).error({ status: 403, errors: ['forbidden'] })
    try {
        ensurePostgres()
        return (res as any).success({ status: 200, data: await run() })
    } catch (err: any) {
        if (err instanceof ReportError) return (res as any).error({ status: err.status, errors: [err.code] })
        console.error('[ETHSurveyLeaf] Report failed:', err?.message || err)
        return (res as any).error({ status: 500, errors: ['report_failed'] })
    }
}

@Controller()
export default class ETHSurveyAdminController {
    /** GET /admin/surveys — the surveys, on or off, for the Surveys page. */
    @Get('/admin/surveys')
    @ShouldBeAuthenticated()
    async list(req: AuthedRequest, res: Response) {
        return guard(req, res, async () => ({ surveys: (await allSurveys()).map(adminInfoOf) }))
    }

    /** GET /admin/surveys/targets?event= — the values a survey of this event can be narrowed to. */
    @Get('/admin/surveys/targets')
    @ShouldBeAuthenticated()
    async targets(req: AuthedRequest, res: Response) {
        return guard(
            req,
            res,
            async () => {
                const event = eventOf(req.query?.event)
                if (!event) throw new ReportError(404, 'unknown_event')
                if (!event.target) return { label: null, options: [] }
                const options = (await event.target.options()) ?? []
                return {
                    label: event.target.label,
                    options: options
                        .filter((o) => o && o.value !== undefined && o.value !== null && o.value !== '')
                        .map((o) => ({ value: String(o.value), label: String(o.label ?? o.value), ...(o.hint ? { hint: String(o.hint) } : {}) })),
                }
            },
            writesSurveys
        )
    }

    /** GET /admin/surveys/overview?survey=&from=YYYY-MM-DD&to=YYYY-MM-DD */
    @Get('/admin/surveys/overview')
    @ShouldBeAuthenticated()
    async overview(req: AuthedRequest, res: Response) {
        return guard(req, res, () => overview(req.query))
    }

    /** GET /admin/surveys/comments?survey=&from=&to=&group=high|mid|low&all=1&limit=&before= */
    @Get('/admin/surveys/comments')
    @ShouldBeAuthenticated()
    async comments(req: AuthedRequest, res: Response) {
        return guard(req, res, () => comments(req.query))
    }

    /** GET /admin/surveys/users/:id — everything one person was asked. */
    @Get('/admin/surveys/users/:id')
    @ShouldBeAuthenticated()
    async user(req: AuthedRequest, res: Response) {
        const id = Number(req.params.id)
        if (!Number.isInteger(id)) return (res as any).error({ status: 404, errors: ['not_found'] })
        return guard(req, res, () => userResponses(id))
    }
}
