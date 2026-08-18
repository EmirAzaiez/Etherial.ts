// ──────────────────────────────────────────────────────────────────────────
// From "something happened" to runs.
//
// One event can match several flows — a customer may well want a notification
// *and* a Slack message *and* a row in a log — so firing is a fan-out, and each
// flow gets its own run, its own dedup key and its own failure. One flow
// throwing must not cost the others their run.
// ──────────────────────────────────────────────────────────────────────────
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Op } from 'sequelize';
import { Flow } from '../models/Flow.js';
import { FlowRun, FlowRunStatus } from '../models/FlowRun.js';
import { registry } from '../registry/Registry.js';
import { leafConfig } from '../config.js';
import { getModel, hydrateRecord } from '../registry/admin.js';
import { claim, planDedup, attachRun, release } from './dedup.js';
import { executeRun, initialState } from './engine.js';
import { renderString } from './template.js';
/** Flows listening to a trigger, in a stable order. */
export function flowsFor(triggerId) {
    return __awaiter(this, void 0, void 0, function* () {
        return Flow.findAll({
            where: { trigger_id: triggerId, enabled: true, deleted_at: null },
            order: [['id', 'ASC']],
        });
    });
}
/**
 * Whether this particular flow cares about this particular change.
 *
 * Only `model.*.updated` filters: a flow watching the `status` field should not
 * wake up because someone fixed a typo in the notes. Every other trigger runs
 * on everything it receives — the filtering is drawn as condition steps, where
 * the customer can see it.
 */
function passesTriggerFilter(flow, payload) {
    var _a, _b;
    const watched = (_b = (_a = flow.trigger_config) === null || _a === void 0 ? void 0 : _a.watch_fields) !== null && _b !== void 0 ? _b : [];
    if (!Array.isArray(watched) || watched.length === 0)
        return true;
    const changed = Array.isArray(payload === null || payload === void 0 ? void 0 : payload.changed) ? payload.changed : [];
    if (changed.length === 0)
        return true;
    return watched.some((field) => changed.includes(field));
}
function loadRecord(trigger, input) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (input.record) {
            const record = yield hydrateRecord(trigger === null || trigger === void 0 ? void 0 : trigger.collection, input.record);
            const id = (_a = record.id) !== null && _a !== void 0 ? _a : input.recordId;
            return { record, recordId: id === undefined || id === null ? null : String(id) };
        }
        if (input.recordId !== undefined && input.recordId !== null && (trigger === null || trigger === void 0 ? void 0 : trigger.collection)) {
            const model = getModel(trigger.collection);
            if (model) {
                const instance = yield model.findByPk(input.recordId);
                if (instance) {
                    return {
                        record: yield hydrateRecord(trigger.collection, instance),
                        recordId: String(input.recordId),
                    };
                }
            }
            return { record: {}, recordId: String(input.recordId) };
        }
        return { record: {}, recordId: null };
    });
}
/**
 * Runs one flow for one event, dedup included.
 *
 * The key is claimed *before* the run row exists. If the process dies between
 * the claim and the run, the key is released on the way out; if it dies harder
 * than that, the key expires. Both outcomes are recoverable, whereas sending
 * the notification twice is not.
 */
export function runFlow(flow, input) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        const trigger = registry.getTrigger(flow.trigger_id);
        const graph = (_a = flow.graph) !== null && _a !== void 0 ? _a : { nodes: [], edges: [] };
        if (!graph.nodes || graph.nodes.length === 0) {
            return { flow, run: null, skipped: 'invalid' };
        }
        const payload = (_b = input.payload) !== null && _b !== void 0 ? _b : {};
        if (!passesTriggerFilter(flow, payload)) {
            return { flow, run: null, skipped: 'filtered' };
        }
        const { record, recordId } = yield loadRecord(trigger, input);
        const timezone = leafConfig().timezone;
        // A context with no run id yet: dedup templates only read the record and the
        // trigger, and the number would be a lie until the row exists.
        const draft = {
            flowId: flow.id,
            flowName: flow.name,
            runId: 0,
            timezone,
            trigger: {
                id: flow.trigger_id,
                kind: (_c = trigger === null || trigger === void 0 ? void 0 : trigger.kind) !== null && _c !== void 0 ? _c : 'event',
                collection: trigger === null || trigger === void 0 ? void 0 : trigger.collection,
                payload,
            },
            record,
            actor: (_d = input.actor) !== null && _d !== void 0 ? _d : { type: 'system' },
            state: initialState(graph),
            logs: [],
        };
        const plan = input.dedupKey
            ? { key: input.dedupKey, expiresAt: null }
            : planDedup((_e = flow.trigger_config) !== null && _e !== void 0 ? _e : {}, {
                triggerId: flow.trigger_id,
                recordId,
                render: (template) => renderString(template, draft),
                timezone,
            });
        if (plan) {
            const taken = yield claim(flow.id, plan);
            if (!taken)
                return { flow, run: null, skipped: 'deduplicated' };
        }
        let run;
        try {
            run = yield FlowRun.create({
                flow_id: flow.id,
                status: FlowRunStatus.RUNNING,
                trigger_id: flow.trigger_id,
                collection: (_f = trigger === null || trigger === void 0 ? void 0 : trigger.collection) !== null && _f !== void 0 ? _f : null,
                record_id: recordId,
                trigger_payload: payload,
                record,
                step_logs: [],
                actor_type: draft.actor.type,
                actor_id: (_g = draft.actor.id) !== null && _g !== void 0 ? _g : null,
                started_at: new Date(),
            });
        }
        catch (error) {
            if (plan)
                yield release(flow.id, plan.key);
            throw error;
        }
        if (plan)
            yield attachRun(flow.id, plan.key, run.id);
        draft.runId = run.id;
        return { flow, run: yield executeRun(flow, run, draft) };
    });
}
/**
 * The entry point everything else calls: model hooks, the ticker, webhooks,
 * and application code raising its own domain events.
 */
export function fire(input) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const flows = yield flowsFor(input.triggerId);
        if (flows.length === 0)
            return [];
        const outcomes = [];
        for (const flow of flows) {
            try {
                outcomes.push(yield runFlow(flow, input));
            }
            catch (error) {
                console.error(`[ETHFlowLeaf] Flow "${flow.name}" (#${flow.id}) crashed:`, error);
                yield flow
                    .update({
                    last_error: (_a = error === null || error === void 0 ? void 0 : error.message) !== null && _a !== void 0 ? _a : String(error),
                    error_count: ((_b = flow.error_count) !== null && _b !== void 0 ? _b : 0) + 1,
                })
                    .catch(() => undefined);
                outcomes.push({ flow, run: null });
            }
        }
        return outcomes;
    });
}
/**
 * Fire without making the caller wait or care.
 *
 * Model hooks use this: saving a record must not get slower, and must not fail,
 * because an automation attached to it does.
 */
export function fireAndForget(input) {
    fire(input).catch((error) => {
        console.error(`[ETHFlowLeaf] Failed to fire "${input.triggerId}":`, error);
    });
}
/** Picks up runs frozen on a `flow.wait` whose time has come. */
export function resumeDueRuns() {
    return __awaiter(this, arguments, void 0, function* (limit = 25) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const due = yield FlowRun.findAll({
            where: {
                status: FlowRunStatus.WAITING,
                resume_at: { [Op.ne]: null, [Op.lte]: new Date() },
            },
            order: [['resume_at', 'ASC']],
            limit,
        });
        let resumed = 0;
        for (const run of due) {
            // Claiming the row before doing anything: two tickers overlapping would
            // otherwise both resume it, and the rest of the flow would run twice.
            const [taken] = yield FlowRun.update({ status: FlowRunStatus.RUNNING }, { where: { id: run.id, status: FlowRunStatus.WAITING } });
            if (taken === 0)
                continue;
            const flow = yield Flow.findByPk(run.flow_id);
            if (!flow) {
                yield run.update({
                    status: FlowRunStatus.FAILED,
                    error: 'The automation was deleted while this run was waiting.',
                    ended_at: new Date(),
                });
                continue;
            }
            const trigger = registry.getTrigger(flow.trigger_id);
            const context = {
                flowId: flow.id,
                flowName: flow.name,
                runId: run.id,
                timezone: leafConfig().timezone,
                trigger: {
                    id: flow.trigger_id,
                    kind: (_a = trigger === null || trigger === void 0 ? void 0 : trigger.kind) !== null && _a !== void 0 ? _a : 'event',
                    collection: trigger === null || trigger === void 0 ? void 0 : trigger.collection,
                    payload: (_b = run.trigger_payload) !== null && _b !== void 0 ? _b : {},
                },
                // The snapshot, not a fresh read: the run continues with the record
                // as it was when it started, so a message written before the wait and
                // one written after cannot disagree about what happened.
                record: (_c = run.record) !== null && _c !== void 0 ? _c : {},
                actor: { type: (_d = run.actor_type) !== null && _d !== void 0 ? _d : 'system', id: (_e = run.actor_id) !== null && _e !== void 0 ? _e : undefined },
                state: (_f = run.state) !== null && _f !== void 0 ? _f : initialState((_g = flow.graph) !== null && _g !== void 0 ? _g : { nodes: [], edges: [] }),
                logs: (_h = run.step_logs) !== null && _h !== void 0 ? _h : [],
            };
            try {
                yield executeRun(flow, run, context);
                resumed += 1;
            }
            catch (error) {
                console.error(`[ETHFlowLeaf] Failed to resume run #${run.id}:`, error);
                yield run
                    .update({
                    status: FlowRunStatus.FAILED,
                    error: (_j = error === null || error === void 0 ? void 0 : error.message) !== null && _j !== void 0 ? _j : String(error),
                    ended_at: new Date(),
                })
                    .catch(() => undefined);
            }
        }
        return resumed;
    });
}
