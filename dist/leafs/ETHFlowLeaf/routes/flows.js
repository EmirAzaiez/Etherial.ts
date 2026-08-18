// ──────────────────────────────────────────────────────────────────────────
// The builder's API.
//
// Everything here sits behind the admin access checker, and nothing here trusts
// the graph it is given: it is validated on save, and a flow with errors can be
// saved but not enabled. Building an automation is iterative, and refusing to
// store an unfinished one would mean losing an afternoon's work to a missing
// field.
// ──────────────────────────────────────────────────────────────────────────
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import etherial from 'etherial';
import { randomBytes } from 'crypto';
import { Op } from 'sequelize';
import { Controller, Get, Post, Put, Delete } from 'etherial/components/http/provider';
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
import { Flow } from '../models/Flow.js';
import { FlowRun } from '../models/FlowRun.js';
import { registry } from '../registry/Registry.js';
import { validateFlow, hasErrors } from '../engine/validate.js';
import { runFlow } from '../engine/fire.js';
import { invalidateListeners } from '../engine/listeners.js';
import { forgetFlow } from '../engine/dedup.js';
import { generateFlow } from '../ai/generator.js';
import { WEBHOOK_PREFIX } from '../config.js';
import { hasAI } from '../ai/provider.js';
const getAdminLeaf = () => etherial.eth_admin_leaf;
function canManage(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const adminLeaf = getAdminLeaf();
        if (!adminLeaf) {
            (_a = res.error) === null || _a === void 0 ? void 0 : _a.call(res, { status: 500, errors: ['admin_leaf_not_configured'] });
            return false;
        }
        const allowed = yield adminLeaf.canAccessAdmin(req.user);
        if (!allowed) {
            (_b = res.error) === null || _b === void 0 ? void 0 : _b.call(res, { status: 403, errors: ['forbidden'] });
            return false;
        }
        return true;
    });
}
function serializeFlow(flow, issues = true) {
    var _a, _b, _c, _d;
    const trigger = registry.getTrigger(flow.trigger_id);
    return {
        id: flow.id,
        name: flow.name,
        description: flow.description,
        enabled: flow.enabled,
        trigger_id: flow.trigger_id,
        trigger_label: (_a = trigger === null || trigger === void 0 ? void 0 : trigger.label) !== null && _a !== void 0 ? _a : flow.trigger_id,
        trigger_kind: (_b = trigger === null || trigger === void 0 ? void 0 : trigger.kind) !== null && _b !== void 0 ? _b : null,
        trigger_config: (_c = flow.trigger_config) !== null && _c !== void 0 ? _c : {},
        graph: (_d = flow.graph) !== null && _d !== void 0 ? _d : { nodes: [], edges: [] },
        webhook_url: flow.webhook_token ? `${WEBHOOK_PREFIX}/${flow.webhook_token}` : null,
        last_run_at: flow.last_run_at,
        last_error: flow.last_error,
        run_count: flow.run_count,
        error_count: flow.error_count,
        created_at: flow.created_at,
        updated_at: flow.updated_at,
        issues: issues ? validateFlow(flow.trigger_id, flow.graph) : undefined,
    };
}
let FlowsController = class FlowsController {
    /** The palette: every trigger and every step this workspace can offer. */
    getSchema(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (!(yield canManage(req, res)))
                return;
            return (_b = (_a = res).success) === null || _b === void 0 ? void 0 : _b.call(_a, {
                status: 200,
                data: Object.assign(Object.assign({}, registry.serialize()), { ai: hasAI() }),
            });
        });
    }
    /**
     * The same, for one entry, with the configuration the user has filled in so
     * far. Field lists and outputs depend on it — the date picker of a scheduled
     * query cannot be built before the collection is chosen.
     */
    resolveSchema(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            if (!(yield canManage(req, res)))
                return;
            const { kind, type, config } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
            if (kind === 'trigger') {
                const trigger = registry.getTrigger(type);
                if (!trigger)
                    return (_c = (_b = res).error) === null || _c === void 0 ? void 0 : _c.call(_b, { status: 404, errors: ['trigger_not_found'] });
                return (_e = (_d = res).success) === null || _e === void 0 ? void 0 : _e.call(_d, {
                    status: 200,
                    data: registry.serializeTrigger(trigger, config !== null && config !== void 0 ? config : {}),
                });
            }
            const node = registry.getNode(type);
            if (!node)
                return (_g = (_f = res).error) === null || _g === void 0 ? void 0 : _g.call(_f, { status: 404, errors: ['node_not_found'] });
            return (_j = (_h = res).success) === null || _j === void 0 ? void 0 : _j.call(_h, { status: 200, data: registry.serializeNode(node, config !== null && config !== void 0 ? config : {}) });
        });
    }
    list(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (!(yield canManage(req, res)))
                return;
            const where = { deleted_at: null };
            if (req.query.search)
                where.name = { [Op.like]: `%${req.query.search}%` };
            if (req.query.enabled === 'true')
                where.enabled = true;
            if (req.query.enabled === 'false')
                where.enabled = false;
            const flows = yield Flow.findAll({ where, order: [['updated_at', 'DESC']] });
            return (_b = (_a = res).success) === null || _b === void 0 ? void 0 : _b.call(_a, {
                status: 200,
                data: flows.map((flow) => serializeFlow(flow, false)),
            });
        });
    }
    show(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            if (!(yield canManage(req, res)))
                return;
            const flow = yield Flow.findByPk(req.params.id);
            if (!flow || flow.deleted_at)
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 404, errors: ['flow_not_found'] });
            return (_d = (_c = res).success) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 200, data: serializeFlow(flow) });
        });
    }
    create(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            if (!(yield canManage(req, res)))
                return;
            const body = (_a = req.body) !== null && _a !== void 0 ? _a : {};
            if (!body.name || !body.trigger_id) {
                return (_c = (_b = res).error) === null || _c === void 0 ? void 0 : _c.call(_b, { status: 400, errors: ['name_and_trigger_required'] });
            }
            const flow = yield Flow.create({
                name: String(body.name),
                description: (_d = body.description) !== null && _d !== void 0 ? _d : null,
                // Never enabled on creation, whatever was sent: an automation starts
                // affecting the world only after someone has looked at it.
                enabled: false,
                trigger_id: String(body.trigger_id),
                trigger_config: (_e = body.trigger_config) !== null && _e !== void 0 ? _e : {},
                graph: (_f = body.graph) !== null && _f !== void 0 ? _f : { nodes: [], edges: [] },
                webhook_token: String(body.trigger_id).startsWith('webhook.') ? randomBytes(24).toString('hex') : null,
                created_by_user_id: (_h = (_g = req.user) === null || _g === void 0 ? void 0 : _g.id) !== null && _h !== void 0 ? _h : null,
            });
            invalidateListeners();
            return (_k = (_j = res).success) === null || _k === void 0 ? void 0 : _k.call(_j, { status: 201, data: serializeFlow(flow) });
        });
    }
    update(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
            if (!(yield canManage(req, res)))
                return;
            const flow = yield Flow.findByPk(req.params.id);
            if (!flow || flow.deleted_at)
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 404, errors: ['flow_not_found'] });
            const body = (_c = req.body) !== null && _c !== void 0 ? _c : {};
            const triggerId = (_d = body.trigger_id) !== null && _d !== void 0 ? _d : flow.trigger_id;
            const graph = (_e = body.graph) !== null && _e !== void 0 ? _e : flow.graph;
            const issues = validateFlow(triggerId, graph);
            if (body.enabled === true && hasErrors(issues)) {
                return (_g = (_f = res).error) === null || _g === void 0 ? void 0 : _g.call(_f, {
                    status: 400,
                    errors: ['flow_has_errors'],
                    data: { issues },
                });
            }
            const changingTrigger = body.trigger_id && body.trigger_id !== flow.trigger_id;
            yield flow.update({
                name: (_h = body.name) !== null && _h !== void 0 ? _h : flow.name,
                description: (_j = body.description) !== null && _j !== void 0 ? _j : flow.description,
                enabled: (_k = body.enabled) !== null && _k !== void 0 ? _k : flow.enabled,
                trigger_id: triggerId,
                trigger_config: (_l = body.trigger_config) !== null && _l !== void 0 ? _l : flow.trigger_config,
                graph,
                webhook_token: String(triggerId).startsWith('webhook.') && !flow.webhook_token
                    ? randomBytes(24).toString('hex')
                    : flow.webhook_token,
                // A flow rewired to a different trigger has to forget what it has
                // already handled, or its old keys would suppress the new events.
                last_tick_at: changingTrigger ? null : flow.last_tick_at,
            });
            if (changingTrigger)
                yield forgetFlow(flow.id);
            invalidateListeners();
            return (_o = (_m = res).success) === null || _o === void 0 ? void 0 : _o.call(_m, { status: 200, data: serializeFlow(flow) });
        });
    }
    remove(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            if (!(yield canManage(req, res)))
                return;
            const flow = yield Flow.findByPk(req.params.id);
            if (!flow)
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 404, errors: ['flow_not_found'] });
            // Soft, and disabled in the same breath: the runs stay readable, and a
            // deletion undone by a support ticket does not come back live.
            yield flow.update({ deleted_at: new Date(), enabled: false });
            invalidateListeners();
            return (_d = (_c = res).success) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 200, data: { id: flow.id } });
        });
    }
    /** Runs it once, now, on a record the user picks. The Test button. */
    run(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
            if (!(yield canManage(req, res)))
                return;
            const flow = yield Flow.findByPk(req.params.id);
            if (!flow || flow.deleted_at)
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 404, errors: ['flow_not_found'] });
            const issues = validateFlow(flow.trigger_id, flow.graph);
            if (hasErrors(issues)) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 400, errors: ['flow_has_errors'], data: { issues } });
            }
            try {
                const outcome = yield runFlow(flow, {
                    triggerId: flow.trigger_id,
                    recordId: (_e = req.body) === null || _e === void 0 ? void 0 : _e.record_id,
                    payload: (_g = (_f = req.body) === null || _f === void 0 ? void 0 : _f.payload) !== null && _g !== void 0 ? _g : {},
                    actor: { type: 'user', id: (_h = req.user) === null || _h === void 0 ? void 0 : _h.id },
                    // A manual run always runs. Whoever pressed Test wants to see
                    // what happens, not be told it already happened this morning —
                    // so it claims a key nothing else will ever produce, unless they
                    // explicitly asked to rehearse the deduplication too.
                    dedupKey: ((_j = req.body) === null || _j === void 0 ? void 0 : _j.respect_dedup)
                        ? undefined
                        : `manual:${flow.id}:${(_l = (_k = req.user) === null || _k === void 0 ? void 0 : _k.id) !== null && _l !== void 0 ? _l : 0}:${process.hrtime.bigint()}`,
                });
                return (_o = (_m = res).success) === null || _o === void 0 ? void 0 : _o.call(_m, {
                    status: 200,
                    data: outcome.run ? serializeRun(outcome.run) : { skipped: (_p = outcome.skipped) !== null && _p !== void 0 ? _p : 'nothing_to_do' },
                });
            }
            catch (error) {
                return (_r = (_q = res).error) === null || _r === void 0 ? void 0 : _r.call(_q, { status: 400, errors: [(_s = error === null || error === void 0 ? void 0 : error.message) !== null && _s !== void 0 ? _s : 'run_failed'] });
            }
        });
    }
    runs(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (!(yield canManage(req, res)))
                return;
            const where = { flow_id: req.params.id };
            if (req.query.status)
                where.status = req.query.status;
            const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
            const offset = Math.max(0, Number(req.query.offset) || 0);
            const { rows, count } = yield FlowRun.findAndCountAll({
                where,
                order: [['id', 'DESC']],
                limit,
                offset,
            });
            return (_b = (_a = res).success) === null || _b === void 0 ? void 0 : _b.call(_a, {
                status: 200,
                data: { runs: rows.map((run) => serializeRun(run, false)), total: count },
            });
        });
    }
    showRun(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            if (!(yield canManage(req, res)))
                return;
            const run = yield FlowRun.findByPk(req.params.runId);
            if (!run)
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 404, errors: ['run_not_found'] });
            return (_d = (_c = res).success) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 200, data: serializeRun(run) });
        });
    }
    /** Issues a new inbound URL and retires the old one. */
    rotateToken(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            if (!(yield canManage(req, res)))
                return;
            const flow = yield Flow.findByPk(req.params.id);
            if (!flow || flow.deleted_at)
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 404, errors: ['flow_not_found'] });
            yield flow.update({ webhook_token: randomBytes(24).toString('hex') });
            return (_d = (_c = res).success) === null || _d === void 0 ? void 0 : _d.call(_c, {
                status: 200,
                data: { webhook_url: `${WEBHOOK_PREFIX}/${flow.webhook_token}` },
            });
        });
    }
    /** Describe the automation in a sentence; get a graph back to edit. */
    generate(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            if (!(yield canManage(req, res)))
                return;
            const prompt = String((_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.prompt) !== null && _b !== void 0 ? _b : '').trim();
            if (!prompt)
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 400, errors: ['prompt_required'] });
            try {
                const draft = yield generateFlow(prompt, (_e = req.body) === null || _e === void 0 ? void 0 : _e.existing);
                return (_g = (_f = res).success) === null || _g === void 0 ? void 0 : _g.call(_f, { status: 200, data: draft });
            }
            catch (error) {
                return (_j = (_h = res).error) === null || _j === void 0 ? void 0 : _j.call(_h, { status: 400, errors: [(_k = error === null || error === void 0 ? void 0 : error.message) !== null && _k !== void 0 ? _k : 'generation_failed'] });
            }
        });
    }
};
__decorate([
    Get('/admin/flows/schema'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FlowsController.prototype, "getSchema", null);
__decorate([
    Post('/admin/flows/schema/resolve'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FlowsController.prototype, "resolveSchema", null);
__decorate([
    Get('/admin/flows'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FlowsController.prototype, "list", null);
__decorate([
    Get('/admin/flows/:id(\\d+)'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FlowsController.prototype, "show", null);
__decorate([
    Post('/admin/flows'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FlowsController.prototype, "create", null);
__decorate([
    Put('/admin/flows/:id(\\d+)'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FlowsController.prototype, "update", null);
__decorate([
    Delete('/admin/flows/:id(\\d+)'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FlowsController.prototype, "remove", null);
__decorate([
    Post('/admin/flows/:id(\\d+)/run'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FlowsController.prototype, "run", null);
__decorate([
    Get('/admin/flows/:id(\\d+)/runs'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FlowsController.prototype, "runs", null);
__decorate([
    Get('/admin/flows/runs/:runId(\\d+)'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FlowsController.prototype, "showRun", null);
__decorate([
    Post('/admin/flows/:id(\\d+)/token'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FlowsController.prototype, "rotateToken", null);
__decorate([
    Post('/admin/flows/generate'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FlowsController.prototype, "generate", null);
FlowsController = __decorate([
    Controller()
], FlowsController);
export default FlowsController;
function serializeRun(run, withLogs = true) {
    var _a, _b;
    return {
        id: run.id,
        flow_id: run.flow_id,
        status: run.status,
        trigger_id: run.trigger_id,
        collection: run.collection,
        record_id: run.record_id,
        record: withLogs ? run.record : undefined,
        trigger_payload: withLogs ? run.trigger_payload : undefined,
        step_logs: withLogs ? ((_a = run.step_logs) !== null && _a !== void 0 ? _a : []) : undefined,
        steps: ((_b = run.step_logs) !== null && _b !== void 0 ? _b : []).length,
        resume_at: run.resume_at,
        error: run.error,
        actor_type: run.actor_type,
        started_at: run.started_at,
        ended_at: run.ended_at,
        duration_ms: run.duration_ms,
        created_at: run.created_at,
    };
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
];
