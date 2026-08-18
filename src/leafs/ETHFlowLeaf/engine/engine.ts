// ──────────────────────────────────────────────────────────────────────────
// The machine.
//
// It walks the graph with an explicit stack of frames instead of recursing.
// That shape is not a style choice: `flow.wait` suspends a run for hours, and
// the run has to come back after a deploy, in a different process. A call stack
// cannot be written to a JSON column; a list of queues and visited ids can.
//
// So the whole of "where we are" lives in `MachineState` — the frames, what
// each step returned, the variables — and resuming is loading it back and
// entering the same loop.
// ──────────────────────────────────────────────────────────────────────────

import { registry } from '../registry/Registry.js'
import { leafConfig } from '../config.js'
import { Flow } from '../models/Flow.js'
import { FlowRun, FlowRunStatus } from '../models/FlowRun.js'
import { resolveConfig } from './template.js'
import { entryNode, nodeById, successors, loopTailOnly } from './graph.js'
import type {
    FlowGraph,
    Frame,
    MachineState,
    NodeResult,
    RunContext,
    StepLog,
} from '../types.js'

export function emptyState(): MachineState {
    return { frames: [], outputs: {}, vars: {} }
}

/**
 * Prepares the machine for a fresh run: the entry node's successors, queued.
 *
 * The trigger node itself is never executed — it already happened; it is on the
 * canvas so the customer can see and configure what started things.
 */
export function initialState(graph: FlowGraph): MachineState {
    const state = emptyState()
    const entry = entryNode(graph)
    const starts = entry ? successors(graph, entry.id) : []
    state.frames.push({ queue: starts, visited: entry ? [entry.id] : [] })
    return state
}

interface StepOutcome {
    status: 'success' | 'failed' | 'skipped'
    result: NodeResult
    log: StepLog
}

async function executeStep(
    graph: FlowGraph,
    nodeId: string,
    context: RunContext
): Promise<StepOutcome> {
    const node = nodeById(graph, nodeId)
    const startedAt = new Date().toISOString()
    const messages: { text: string; meta?: Record<string, any> }[] = []
    const log = (text: string, meta?: Record<string, any>) => {
        messages.push(meta ? { text, meta } : { text })
    }

    const base = {
        node_id: nodeId,
        node_type: node?.type ?? 'unknown',
        started_at: startedAt,
    }

    if (!node) {
        return {
            status: 'skipped',
            result: {},
            log: {
                ...base,
                status: 'skipped',
                ended_at: new Date().toISOString(),
                error: 'Node not found in the graph',
            },
        }
    }

    const definition = registry.getNode(node.type)
    if (!definition) {
        // A step whose leaf was removed, or a flow imported from a project that
        // had one. Skipping keeps the rest of the automation alive and says so
        // in the log, which beats failing the whole run over a missing plugin.
        return {
            status: 'skipped',
            result: {},
            log: {
                ...base,
                status: 'skipped',
                ended_at: new Date().toISOString(),
                error: `Unknown step type "${node.type}"`,
            },
        }
    }

    let config: Record<string, any>
    try {
        config = resolveConfig(node.config ?? {}, context)
    } catch (error: any) {
        config = { ...(node.config ?? {}) }
        log(`Could not resolve configuration: ${error?.message ?? error}`)
    }

    try {
        const result = await definition.execute({ config, context, log })
        return {
            status: 'success',
            result: result ?? {},
            log: {
                ...base,
                status: result?.waitUntil ? 'waiting' : 'success',
                ended_at: new Date().toISOString(),
                output: result?.output,
                branch: result?.branch,
                messages: messages.length > 0 ? messages : undefined,
            },
        }
    } catch (error: any) {
        return {
            status: 'failed',
            result: {},
            log: {
                ...base,
                status: 'failed',
                ended_at: new Date().toISOString(),
                messages: messages.length > 0 ? messages : undefined,
                error: error?.message ? String(error.message) : String(error),
            },
        }
    }
}

/**
 * Queues what comes after a step.
 *
 * `flow.for_each` is the one step that does not simply hand its successors to
 * the current frame: it opens a new one, and everything behind its `done` handle
 * waits at the bottom of the stack until the items run out.
 */
function advance(
    graph: FlowGraph,
    nodeId: string,
    definition: { branches?: any[]; branchesFromConfig?: string } | null,
    result: NodeResult,
    frame: Frame
): void {
    const branches = !!definition?.branches?.length || !!definition?.branchesFromConfig
    const next = successors(graph, nodeId, branches ? (result.branch ?? '__none__') : undefined)
    frame.queue.push(...next)
}

function pushLoopFrame(
    graph: FlowGraph,
    nodeId: string,
    items: any[],
    state: MachineState
): void {
    const bodyStarts = successors(graph, nodeId, 'item')
    const doneStarts = successors(graph, nodeId, 'done')
    const frame = state.frames[state.frames.length - 1]

    if (items.length === 0 || bodyStarts.length === 0) {
        frame.queue.push(...doneStarts)
        return
    }

    state.frames.push({
        queue: [...bodyStarts],
        visited: [],
        iterator: {
            items,
            index: 0,
            bodyStarts,
            doneOnly: loopTailOnly(graph, bodyStarts, doneStarts),
            nodeId,
        },
    })
}

/** The innermost loop, for `{{item.*}}` and `{{loop.*}}`. */
function currentIterator(state: MachineState): RunContext['iterator'] {
    for (let index = state.frames.length - 1; index >= 0; index -= 1) {
        const iterator = state.frames[index].iterator
        if (iterator) {
            return {
                item: iterator.items[iterator.index],
                index: iterator.index,
                total: iterator.items.length,
            }
        }
    }
    return undefined
}

export interface MachineOutcome {
    status: FlowRunStatus.SUCCESS | FlowRunStatus.FAILED | FlowRunStatus.WAITING
    resumeAt?: Date
    error?: string
}

/**
 * Runs until the graph is exhausted, a step asks to wait, or a step fails.
 *
 * `context.state` is mutated in place: the caller holds the same object, so
 * whatever happens it can write the current position to the row.
 */
export async function runMachine(graph: FlowGraph, context: RunContext): Promise<MachineOutcome> {
    const state = context.state
    const maxSteps = leafConfig().maxSteps ?? 500
    let steps = 0

    while (state.frames.length > 0) {
        const frame = state.frames[state.frames.length - 1]

        if (frame.queue.length === 0) {
            const iterator = frame.iterator

            if (!iterator) {
                state.frames.pop()
                continue
            }

            iterator.index += 1

            if (iterator.index < iterator.items.length) {
                // Next item, same body, clean slate — a step that ran for item 1
                // has to be allowed to run again for item 2.
                frame.queue = [...iterator.bodyStarts]
                frame.visited = []
                continue
            }

            state.frames.pop()
            const parent = state.frames[state.frames.length - 1]
            if (parent) parent.queue.push(...iterator.doneOnly)
            continue
        }

        const nodeId = frame.queue.shift() as string
        if (frame.visited.includes(nodeId)) continue

        // Inside a loop, the tail is off limits: it belongs to what happens once
        // the items are done, not to each of them. Checking every live frame
        // covers nested loops — the tail of an outer loop is fenced from the
        // inner one too, and stops being fenced when that frame is popped.
        if (state.frames.some((f) => f.iterator?.doneOnly.includes(nodeId))) continue

        frame.visited.push(nodeId)

        steps += 1
        if (steps > maxSteps) {
            return {
                status: FlowRunStatus.FAILED,
                error: `Stopped after ${maxSteps} steps — the automation is looping.`,
            }
        }

        context.iterator = currentIterator(state)

        const outcome = await executeStep(graph, nodeId, context)
        context.logs.push(outcome.log)

        const node = nodeById(graph, nodeId)
        const definition = node ? registry.getNode(node.type) : null

        if (outcome.status === 'failed') {
            const onError = node?.config?.on_error ?? 'stop'
            if (onError !== 'continue') {
                return { status: FlowRunStatus.FAILED, error: outcome.log.error }
            }
            // Carrying on means carrying on down the default path; a branching
            // step that failed never chose a branch, so there is nowhere to go.
            advance(graph, nodeId, definition, {}, frame)
            continue
        }

        if (outcome.status === 'skipped') {
            advance(graph, nodeId, definition, {}, frame)
            continue
        }

        const result = outcome.result

        if (result.output) state.outputs[nodeId] = result.output

        if (result.halt) {
            // A deliberate stop, not a failure: the guard said no, and that is
            // the automation working.
            return { status: FlowRunStatus.SUCCESS }
        }

        if (result.waitUntil) {
            // Queue what comes next *before* freezing, so waking up is just
            // re-entering this loop with the queue already pointing forward.
            advance(graph, nodeId, definition, result, frame)
            return { status: FlowRunStatus.WAITING, resumeAt: result.waitUntil }
        }

        if (definition?.id === 'flow.for_each') {
            const items = Array.isArray(result.output?.items) ? result.output.items : []
            pushLoopFrame(graph, nodeId, items, state)
            continue
        }

        advance(graph, nodeId, definition, result, frame)
    }

    return { status: FlowRunStatus.SUCCESS }
}

// ─── Persistence ──────────────────────────────────────────────────────────

/**
 * Runs a flow and keeps the row in step with it.
 *
 * The run row is written before the first step and updated after the last, so a
 * process killed mid-flow leaves a RUNNING row behind rather than nothing at
 * all — an operator can see that something started and did not finish.
 */
export async function executeRun(flow: Flow, run: FlowRun, context: RunContext): Promise<FlowRun> {
    const graph: FlowGraph = (flow.graph as FlowGraph) ?? { nodes: [], edges: [] }
    const startedAt = run.started_at ? new Date(run.started_at).getTime() : Date.now()

    let outcome: MachineOutcome
    try {
        outcome = await runMachine(graph, context)
    } catch (error: any) {
        outcome = { status: FlowRunStatus.FAILED, error: error?.message ?? String(error) }
    }

    const endedAt = new Date()
    const waiting = outcome.status === FlowRunStatus.WAITING

    await run.update({
        status: outcome.status,
        step_logs: context.logs,
        // The machine is kept only while it is still needed; a finished run
        // keeps its logs, which is what anyone actually reads.
        state: waiting ? context.state : null,
        resume_at: waiting ? outcome.resumeAt : null,
        error: outcome.error ?? null,
        ended_at: waiting ? null : endedAt,
        duration_ms: waiting ? null : endedAt.getTime() - startedAt,
    } as any)

    if (!waiting) {
        await flow.update({
            last_run_at: endedAt,
            last_error: outcome.status === FlowRunStatus.FAILED ? (outcome.error ?? 'Failed') : null,
            run_count: (flow.run_count ?? 0) + 1,
            error_count: (flow.error_count ?? 0) + (outcome.status === FlowRunStatus.FAILED ? 1 : 0),
        } as any)
    }

    return run
}
