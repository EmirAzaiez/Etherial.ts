// ──────────────────────────────────────────────────────────────────────────
// From "something happened" to runs.
//
// One event can match several flows — a customer may well want a notification
// *and* a Slack message *and* a row in a log — so firing is a fan-out, and each
// flow gets its own run, its own dedup key and its own failure. One flow
// throwing must not cost the others their run.
// ──────────────────────────────────────────────────────────────────────────

import { Op } from 'sequelize'

import { Flow } from '../models/Flow.js'
import { FlowRun, FlowRunStatus } from '../models/FlowRun.js'
import { registry } from '../registry/Registry.js'
import { leafConfig } from '../config.js'
import { getModel, hydrateRecord } from '../registry/admin.js'
import { claim, planDedup, attachRun, release } from './dedup.js'
import { executeRun, initialState } from './engine.js'
import { renderString } from './template.js'
import type { FireInput, FlowGraph, RunContext, TriggerDefinition } from '../types.js'

/** Flows listening to a trigger, in a stable order. */
export async function flowsFor(triggerId: string): Promise<Flow[]> {
    return Flow.findAll({
        where: { trigger_id: triggerId, enabled: true, deleted_at: null as any },
        order: [['id', 'ASC']],
    })
}

/**
 * Whether this particular flow cares about this particular change.
 *
 * Only `model.*.updated` filters: a flow watching the `status` field should not
 * wake up because someone fixed a typo in the notes. Every other trigger runs
 * on everything it receives — the filtering is drawn as condition steps, where
 * the customer can see it.
 */
function passesTriggerFilter(flow: Flow, payload: Record<string, any>): boolean {
    const watched: string[] = flow.trigger_config?.watch_fields ?? []
    if (!Array.isArray(watched) || watched.length === 0) return true

    const changed: string[] = Array.isArray(payload?.changed) ? payload.changed : []
    if (changed.length === 0) return true

    return watched.some((field) => changed.includes(field))
}

async function loadRecord(
    trigger: TriggerDefinition | null,
    input: FireInput
): Promise<{ record: Record<string, any>; recordId: string | null }> {
    if (input.record) {
        const record = await hydrateRecord(trigger?.collection, input.record)
        const id = record.id ?? input.recordId
        return { record, recordId: id === undefined || id === null ? null : String(id) }
    }

    if (input.recordId !== undefined && input.recordId !== null && trigger?.collection) {
        const model = getModel(trigger.collection)
        if (model) {
            const instance = await model.findByPk(input.recordId)
            if (instance) {
                return {
                    record: await hydrateRecord(trigger.collection, instance),
                    recordId: String(input.recordId),
                }
            }
        }
        return { record: {}, recordId: String(input.recordId) }
    }

    return { record: {}, recordId: null }
}

export interface FireOutcome {
    flow: Flow
    /** Null when the flow was skipped — filtered out, or already done. */
    run: FlowRun | null
    skipped?: 'filtered' | 'deduplicated' | 'invalid'
}

/**
 * Runs one flow for one event, dedup included.
 *
 * The key is claimed *before* the run row exists. If the process dies between
 * the claim and the run, the key is released on the way out; if it dies harder
 * than that, the key expires. Both outcomes are recoverable, whereas sending
 * the notification twice is not.
 */
export async function runFlow(flow: Flow, input: FireInput): Promise<FireOutcome> {
    const trigger = registry.getTrigger(flow.trigger_id)
    const graph: FlowGraph = (flow.graph as FlowGraph) ?? { nodes: [], edges: [] }

    if (!graph.nodes || graph.nodes.length === 0) {
        return { flow, run: null, skipped: 'invalid' }
    }

    const payload = input.payload ?? {}
    if (!passesTriggerFilter(flow, payload)) {
        return { flow, run: null, skipped: 'filtered' }
    }

    const { record, recordId } = await loadRecord(trigger, input)
    const timezone = leafConfig().timezone

    // A context with no run id yet: dedup templates only read the record and the
    // trigger, and the number would be a lie until the row exists.
    const draft: RunContext = {
        flowId: flow.id,
        flowName: flow.name,
        runId: 0,
        timezone,
        trigger: {
            id: flow.trigger_id,
            kind: trigger?.kind ?? 'event',
            collection: trigger?.collection,
            payload,
        },
        record,
        actor: input.actor ?? { type: 'system' },
        state: initialState(graph),
        logs: [],
    }

    const plan = input.dedupKey
        ? { key: input.dedupKey, expiresAt: null }
        : planDedup(flow.trigger_config ?? {}, {
              triggerId: flow.trigger_id,
              recordId,
              render: (template) => renderString(template, draft),
              timezone,
          })

    if (plan) {
        const taken = await claim(flow.id, plan)
        if (!taken) return { flow, run: null, skipped: 'deduplicated' }
    }

    let run: FlowRun
    try {
        run = await FlowRun.create({
            flow_id: flow.id,
            status: FlowRunStatus.RUNNING,
            trigger_id: flow.trigger_id,
            collection: trigger?.collection ?? null,
            record_id: recordId,
            trigger_payload: payload,
            record,
            step_logs: [],
            actor_type: draft.actor.type,
            actor_id: draft.actor.id ?? null,
            started_at: new Date(),
        } as any)
    } catch (error) {
        if (plan) await release(flow.id, plan.key)
        throw error
    }

    if (plan) await attachRun(flow.id, plan.key, run.id)

    draft.runId = run.id
    return { flow, run: await executeRun(flow, run, draft) }
}

/**
 * The entry point everything else calls: model hooks, the ticker, webhooks,
 * and application code raising its own domain events.
 */
export async function fire(input: FireInput): Promise<FireOutcome[]> {
    const flows = await flowsFor(input.triggerId)
    if (flows.length === 0) return []

    const outcomes: FireOutcome[] = []

    for (const flow of flows) {
        try {
            outcomes.push(await runFlow(flow, input))
        } catch (error: any) {
            console.error(`[ETHFlowLeaf] Flow "${flow.name}" (#${flow.id}) crashed:`, error)
            await flow
                .update({
                    last_error: error?.message ?? String(error),
                    error_count: (flow.error_count ?? 0) + 1,
                } as any)
                .catch(() => undefined)
            outcomes.push({ flow, run: null })
        }
    }

    return outcomes
}

/**
 * Fire without making the caller wait or care.
 *
 * Model hooks use this: saving a record must not get slower, and must not fail,
 * because an automation attached to it does.
 */
export function fireAndForget(input: FireInput): void {
    fire(input).catch((error) => {
        console.error(`[ETHFlowLeaf] Failed to fire "${input.triggerId}":`, error)
    })
}

/** Picks up runs frozen on a `flow.wait` whose time has come. */
export async function resumeDueRuns(limit = 25): Promise<number> {
    const due = await FlowRun.findAll({
        where: {
            status: FlowRunStatus.WAITING,
            resume_at: { [Op.ne]: null, [Op.lte]: new Date() } as any,
        },
        order: [['resume_at', 'ASC']],
        limit,
    })

    let resumed = 0

    for (const run of due) {
        // Claiming the row before doing anything: two tickers overlapping would
        // otherwise both resume it, and the rest of the flow would run twice.
        const [taken] = await FlowRun.update(
            { status: FlowRunStatus.RUNNING } as any,
            { where: { id: run.id, status: FlowRunStatus.WAITING } }
        )
        if (taken === 0) continue

        const flow = await Flow.findByPk(run.flow_id)
        if (!flow) {
            await run.update({
                status: FlowRunStatus.FAILED,
                error: 'The automation was deleted while this run was waiting.',
                ended_at: new Date(),
            } as any)
            continue
        }

        const trigger = registry.getTrigger(flow.trigger_id)
        const context: RunContext = {
            flowId: flow.id,
            flowName: flow.name,
            runId: run.id,
            timezone: leafConfig().timezone,
            trigger: {
                id: flow.trigger_id,
                kind: trigger?.kind ?? 'event',
                collection: trigger?.collection,
                payload: run.trigger_payload ?? {},
            },
            // The snapshot, not a fresh read: the run continues with the record
            // as it was when it started, so a message written before the wait and
            // one written after cannot disagree about what happened.
            record: run.record ?? {},
            actor: { type: (run.actor_type as any) ?? 'system', id: run.actor_id ?? undefined },
            state: run.state ?? initialState((flow.graph as FlowGraph) ?? { nodes: [], edges: [] }),
            logs: run.step_logs ?? [],
        }

        try {
            await executeRun(flow, run, context)
            resumed += 1
        } catch (error: any) {
            console.error(`[ETHFlowLeaf] Failed to resume run #${run.id}:`, error)
            await run
                .update({
                    status: FlowRunStatus.FAILED,
                    error: error?.message ?? String(error),
                    ended_at: new Date(),
                } as any)
                .catch(() => undefined)
        }
    }

    return resumed
}
