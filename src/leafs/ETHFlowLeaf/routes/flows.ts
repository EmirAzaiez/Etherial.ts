// ──────────────────────────────────────────────────────────────────────────
// The builder's API.
//
// Everything here sits behind the admin access checker, and nothing here trusts
// the graph it is given: it is validated on save, and a flow with errors can be
// saved but not enabled. Building an automation is iterative, and refusing to
// store an unfinished one would mean losing an afternoon's work to a missing
// field.
// ──────────────────────────────────────────────────────────────────────────

import etherial from 'etherial'
import { randomBytes } from 'crypto'
import { Op } from 'sequelize'
// Request/Response are type-only — a runtime import of express fails under Node
// ESM, and the decorator metadata falls back to Object either way.
import type { Request, Response } from 'express'
import { Controller, Get, Post, Put, Delete } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'

import { Flow } from '../models/Flow.js'
import { FlowRun } from '../models/FlowRun.js'
import { registry } from '../registry/Registry.js'
import { validateFlow, hasErrors } from '../engine/validate.js'
import { runFlow } from '../engine/fire.js'
import { invalidateListeners } from '../engine/listeners.js'
import { forgetFlow } from '../engine/dedup.js'
import { generateFlow } from '../ai/generator.js'
import { WEBHOOK_PREFIX } from '../config.js'
import { hasAI } from '../ai/provider.js'
import type { FlowGraph } from '../types.js'

const getAdminLeaf = () => (etherial as any).eth_admin_leaf

async function canManage(req: any, res: any): Promise<boolean> {
    const adminLeaf = getAdminLeaf()
    if (!adminLeaf) {
        res.error?.({ status: 500, errors: ['admin_leaf_not_configured'] })
        return false
    }

    const allowed = await adminLeaf.canAccessAdmin(req.user)
    if (!allowed) {
        res.error?.({ status: 403, errors: ['forbidden'] })
        return false
    }

    return true
}

function serializeFlow(flow: Flow, issues = true) {
    const trigger = registry.getTrigger(flow.trigger_id)

    return {
        id: flow.id,
        name: flow.name,
        description: flow.description,
        enabled: flow.enabled,
        trigger_id: flow.trigger_id,
        trigger_label: trigger?.label ?? flow.trigger_id,
        trigger_kind: trigger?.kind ?? null,
        trigger_config: flow.trigger_config ?? {},
        graph: flow.graph ?? { nodes: [], edges: [] },
        webhook_url: flow.webhook_token ? `${WEBHOOK_PREFIX}/${flow.webhook_token}` : null,
        last_run_at: flow.last_run_at,
        last_error: flow.last_error,
        run_count: flow.run_count,
        error_count: flow.error_count,
        created_at: flow.created_at,
        updated_at: flow.updated_at,
        issues: issues ? validateFlow(flow.trigger_id, flow.graph as FlowGraph) : undefined,
    }
}

@Controller()
export default class FlowsController {
    /** The palette: every trigger and every step this workspace can offer. */
    @Get('/admin/flows/schema')
    @ShouldBeAuthenticated()
    async getSchema(req: Request & { user: any }, res: Response): Promise<any> {
        if (!(await canManage(req, res))) return

        return (res as any).success?.({
            status: 200,
            data: {
                ...registry.serialize(),
                ai: hasAI(),
            },
        })
    }

    /**
     * The same, for one entry, with the configuration the user has filled in so
     * far. Field lists and outputs depend on it — the date picker of a scheduled
     * query cannot be built before the collection is chosen.
     */
    @Post('/admin/flows/schema/resolve')
    @ShouldBeAuthenticated()
    async resolveSchema(
        req: Request & { user: any; body: { kind: 'trigger' | 'node'; type: string; config?: Record<string, any> } },
        res: Response
    ): Promise<any> {
        if (!(await canManage(req, res))) return

        const { kind, type, config } = req.body ?? ({} as any)

        if (kind === 'trigger') {
            const trigger = registry.getTrigger(type)
            if (!trigger) return (res as any).error?.({ status: 404, errors: ['trigger_not_found'] })
            return (res as any).success?.({
                status: 200,
                data: registry.serializeTrigger(trigger, config ?? {}),
            })
        }

        const node = registry.getNode(type)
        if (!node) return (res as any).error?.({ status: 404, errors: ['node_not_found'] })

        return (res as any).success?.({ status: 200, data: registry.serializeNode(node, config ?? {}) })
    }

    @Get('/admin/flows')
    @ShouldBeAuthenticated()
    async list(req: Request & { user: any; query: any }, res: Response): Promise<any> {
        if (!(await canManage(req, res))) return

        const where: any = { deleted_at: null }
        if (req.query.search) where.name = { [Op.like]: `%${req.query.search}%` }
        if (req.query.enabled === 'true') where.enabled = true
        if (req.query.enabled === 'false') where.enabled = false

        const flows = await Flow.findAll({ where, order: [['updated_at', 'DESC']] })

        return (res as any).success?.({
            status: 200,
            data: flows.map((flow) => serializeFlow(flow, false)),
        })
    }

    @Get('/admin/flows/:id(\\d+)')
    @ShouldBeAuthenticated()
    async show(req: Request & { user: any; params: { id: string } }, res: Response): Promise<any> {
        if (!(await canManage(req, res))) return

        const flow = await Flow.findByPk(req.params.id)
        if (!flow || flow.deleted_at) return (res as any).error?.({ status: 404, errors: ['flow_not_found'] })

        return (res as any).success?.({ status: 200, data: serializeFlow(flow) })
    }

    @Post('/admin/flows')
    @ShouldBeAuthenticated()
    async create(req: Request & { user: any; body: any }, res: Response): Promise<any> {
        if (!(await canManage(req, res))) return

        const body = req.body ?? {}
        if (!body.name || !body.trigger_id) {
            return (res as any).error?.({ status: 400, errors: ['name_and_trigger_required'] })
        }

        const flow = await Flow.create({
            name: String(body.name),
            description: body.description ?? null,
            // Never enabled on creation, whatever was sent: an automation starts
            // affecting the world only after someone has looked at it.
            enabled: false,
            trigger_id: String(body.trigger_id),
            trigger_config: body.trigger_config ?? {},
            graph: body.graph ?? { nodes: [], edges: [] },
            webhook_token: String(body.trigger_id).startsWith('webhook.') ? randomBytes(24).toString('hex') : null,
            created_by_user_id: req.user?.id ?? null,
        } as any)

        invalidateListeners()

        return (res as any).success?.({ status: 201, data: serializeFlow(flow) })
    }

    @Put('/admin/flows/:id(\\d+)')
    @ShouldBeAuthenticated()
    async update(
        req: Request & { user: any; params: { id: string }; body: any },
        res: Response
    ): Promise<any> {
        if (!(await canManage(req, res))) return

        const flow = await Flow.findByPk(req.params.id)
        if (!flow || flow.deleted_at) return (res as any).error?.({ status: 404, errors: ['flow_not_found'] })

        const body = req.body ?? {}
        const triggerId = body.trigger_id ?? flow.trigger_id
        const graph = body.graph ?? flow.graph
        const issues = validateFlow(triggerId, graph as FlowGraph)

        if (body.enabled === true && hasErrors(issues)) {
            return (res as any).error?.({
                status: 400,
                errors: ['flow_has_errors'],
                data: { issues },
            })
        }

        const changingTrigger = body.trigger_id && body.trigger_id !== flow.trigger_id

        await flow.update({
            name: body.name ?? flow.name,
            description: body.description ?? flow.description,
            enabled: body.enabled ?? flow.enabled,
            trigger_id: triggerId,
            trigger_config: body.trigger_config ?? flow.trigger_config,
            graph,
            webhook_token:
                String(triggerId).startsWith('webhook.') && !flow.webhook_token
                    ? randomBytes(24).toString('hex')
                    : flow.webhook_token,
            // A flow rewired to a different trigger has to forget what it has
            // already handled, or its old keys would suppress the new events.
            last_tick_at: changingTrigger ? null : flow.last_tick_at,
        } as any)

        if (changingTrigger) await forgetFlow(flow.id)
        invalidateListeners()

        return (res as any).success?.({ status: 200, data: serializeFlow(flow) })
    }

    @Delete('/admin/flows/:id(\\d+)')
    @ShouldBeAuthenticated()
    async remove(req: Request & { user: any; params: { id: string } }, res: Response): Promise<any> {
        if (!(await canManage(req, res))) return

        const flow = await Flow.findByPk(req.params.id)
        if (!flow) return (res as any).error?.({ status: 404, errors: ['flow_not_found'] })

        // Soft, and disabled in the same breath: the runs stay readable, and a
        // deletion undone by a support ticket does not come back live.
        await flow.update({ deleted_at: new Date(), enabled: false } as any)
        invalidateListeners()

        return (res as any).success?.({ status: 200, data: { id: flow.id } })
    }

    /** Runs it once, now, on a record the user picks. The Test button. */
    @Post('/admin/flows/:id(\\d+)/run')
    @ShouldBeAuthenticated()
    async run(
        req: Request & { user: any; params: { id: string }; body: any },
        res: Response
    ): Promise<any> {
        if (!(await canManage(req, res))) return

        const flow = await Flow.findByPk(req.params.id)
        if (!flow || flow.deleted_at) return (res as any).error?.({ status: 404, errors: ['flow_not_found'] })

        const issues = validateFlow(flow.trigger_id, flow.graph as FlowGraph)
        if (hasErrors(issues)) {
            return (res as any).error?.({ status: 400, errors: ['flow_has_errors'], data: { issues } })
        }

        try {
            const outcome = await runFlow(flow, {
                triggerId: flow.trigger_id,
                recordId: req.body?.record_id,
                payload: req.body?.payload ?? {},
                actor: { type: 'user', id: req.user?.id },
                // A manual run always runs. Whoever pressed Test wants to see
                // what happens, not be told it already happened this morning —
                // so it claims a key nothing else will ever produce, unless they
                // explicitly asked to rehearse the deduplication too.
                dedupKey: req.body?.respect_dedup
                    ? undefined
                    : `manual:${flow.id}:${req.user?.id ?? 0}:${process.hrtime.bigint()}`,
            })

            return (res as any).success?.({
                status: 200,
                data: outcome.run ? serializeRun(outcome.run) : { skipped: outcome.skipped ?? 'nothing_to_do' },
            })
        } catch (error: any) {
            return (res as any).error?.({ status: 400, errors: [error?.message ?? 'run_failed'] })
        }
    }

    @Get('/admin/flows/:id(\\d+)/runs')
    @ShouldBeAuthenticated()
    async runs(
        req: Request & { user: any; params: { id: string }; query: any },
        res: Response
    ): Promise<any> {
        if (!(await canManage(req, res))) return

        const where: any = { flow_id: req.params.id }
        if (req.query.status) where.status = req.query.status

        const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50))
        const offset = Math.max(0, Number(req.query.offset) || 0)

        const { rows, count } = await FlowRun.findAndCountAll({
            where,
            order: [['id', 'DESC']],
            limit,
            offset,
        })

        return (res as any).success?.({
            status: 200,
            data: { runs: rows.map((run) => serializeRun(run, false)), total: count },
        })
    }

    @Get('/admin/flows/runs/:runId(\\d+)')
    @ShouldBeAuthenticated()
    async showRun(req: Request & { user: any; params: { runId: string } }, res: Response): Promise<any> {
        if (!(await canManage(req, res))) return

        const run = await FlowRun.findByPk(req.params.runId)
        if (!run) return (res as any).error?.({ status: 404, errors: ['run_not_found'] })

        return (res as any).success?.({ status: 200, data: serializeRun(run) })
    }

    /** Issues a new inbound URL and retires the old one. */
    @Post('/admin/flows/:id(\\d+)/token')
    @ShouldBeAuthenticated()
    async rotateToken(req: Request & { user: any; params: { id: string } }, res: Response): Promise<any> {
        if (!(await canManage(req, res))) return

        const flow = await Flow.findByPk(req.params.id)
        if (!flow || flow.deleted_at) return (res as any).error?.({ status: 404, errors: ['flow_not_found'] })

        await flow.update({ webhook_token: randomBytes(24).toString('hex') } as any)

        return (res as any).success?.({
            status: 200,
            data: { webhook_url: `${WEBHOOK_PREFIX}/${flow.webhook_token}` },
        })
    }

    /** Describe the automation in a sentence; get a graph back to edit. */
    @Post('/admin/flows/generate')
    @ShouldBeAuthenticated()
    async generate(req: Request & { user: any; body: any }, res: Response): Promise<any> {
        if (!(await canManage(req, res))) return

        const prompt = String(req.body?.prompt ?? '').trim()
        if (!prompt) return (res as any).error?.({ status: 400, errors: ['prompt_required'] })

        try {
            const draft = await generateFlow(prompt, req.body?.existing)
            return (res as any).success?.({ status: 200, data: draft })
        } catch (error: any) {
            return (res as any).error?.({ status: 400, errors: [error?.message ?? 'generation_failed'] })
        }
    }
}

function serializeRun(run: FlowRun, withLogs = true) {
    return {
        id: run.id,
        flow_id: run.flow_id,
        status: run.status,
        trigger_id: run.trigger_id,
        collection: run.collection,
        record_id: run.record_id,
        record: withLogs ? run.record : undefined,
        trigger_payload: withLogs ? run.trigger_payload : undefined,
        step_logs: withLogs ? (run.step_logs ?? []) : undefined,
        steps: (run.step_logs ?? []).length,
        resume_at: run.resume_at,
        error: run.error,
        actor_type: run.actor_type,
        started_at: run.started_at,
        ended_at: run.ended_at,
        duration_ms: run.duration_ms,
        created_at: run.created_at,
    }
}

export const AvailableRouteMethods = [
    'getSchema',
    'resolveSchema',
    'list',
    'show',
    'create',
    'update',
    'remove',
    'run',
    'runs',
    'showRun',
    'rotateToken',
    'generate',
] as const
