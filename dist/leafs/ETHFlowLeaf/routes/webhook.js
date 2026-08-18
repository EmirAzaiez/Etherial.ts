// ──────────────────────────────────────────────────────────────────────────
// The inbound URL.
//
// Public by design: the callers are payment providers, form builders and
// Zapier-shaped things that cannot hold a session. The flow's token in the path
// is the credential, and an optional shared secret is checked on top of it for
// anything that costs money.
//
// The call is answered before the automation finishes. A provider that retries
// on a slow response would otherwise fire the flow twice for one event, and the
// caller has nothing to do with the result anyway — the run log is in the
// back-office.
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
import { timingSafeEqual } from 'crypto';
import { Controller, Get, Post } from 'etherial/components/http/provider';
import { Flow } from '../models/Flow.js';
import { runFlow } from '../engine/fire.js';
import { WEBHOOK_PREFIX } from '../config.js';
/** Constant-time, and false on any length mismatch rather than throwing. */
function secretMatches(expected, received) {
    if (!received)
        return false;
    const a = Buffer.from(String(expected));
    const b = Buffer.from(String(received));
    if (a.length !== b.length)
        return false;
    return timingSafeEqual(a, b);
}
function handle(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        const token = String((_b = (_a = req.params) === null || _a === void 0 ? void 0 : _a.token) !== null && _b !== void 0 ? _b : '');
        if (token.length < 16)
            return (_c = res.error) === null || _c === void 0 ? void 0 : _c.call(res, { status: 404, errors: ['not_found'] });
        const flow = yield Flow.findOne({ where: { webhook_token: token, deleted_at: null } });
        // A disabled flow answers exactly like a missing one: whoever is holding a
        // retired token learns nothing about whether it ever existed.
        if (!flow || !flow.enabled)
            return (_d = res.error) === null || _d === void 0 ? void 0 : _d.call(res, { status: 404, errors: ['not_found'] });
        const secret = (_e = flow.trigger_config) === null || _e === void 0 ? void 0 : _e.secret;
        if (secret && !secretMatches(secret, (_f = req.headers) === null || _f === void 0 ? void 0 : _f['x-flow-secret'])) {
            return (_g = res.error) === null || _g === void 0 ? void 0 : _g.call(res, { status: 401, errors: ['invalid_secret'] });
        }
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const payload = {
            body,
            query: (_h = req.query) !== null && _h !== void 0 ? _h : {},
            headers: safeHeaders((_j = req.headers) !== null && _j !== void 0 ? _j : {}),
            method: req.method,
            ip: (_k = req.ip) !== null && _k !== void 0 ? _k : null,
        };
        // Answer now, run after. Nothing downstream needs the caller's connection.
        (_l = res.success) === null || _l === void 0 ? void 0 : _l.call(res, { status: 202, data: { received: true } });
        runFlow(flow, {
            triggerId: flow.trigger_id,
            // The body *is* the record, so `{{record.email}}` works the way it does
            // under every other trigger.
            record: body,
            payload,
            actor: { type: 'guest' },
        }).catch((error) => {
            console.error(`[ETHFlowLeaf] Webhook flow "${flow.name}" (#${flow.id}) crashed:`, error);
        });
    });
}
/** Everything except the credentials the caller sent us. */
function safeHeaders(headers) {
    const out = {};
    for (const [key, value] of Object.entries(headers)) {
        const lower = key.toLowerCase();
        if (lower === 'authorization' || lower === 'cookie' || lower === 'x-flow-secret')
            continue;
        out[lower] = value;
    }
    return out;
}
let FlowWebhookController = class FlowWebhookController {
    receive(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return handle(req, res);
        });
    }
    /**
     * Several providers verify a URL with a GET before they will save it, so the
     * same handler answers both. A GET with no body simply starts the flow with
     * an empty record.
     */
    verify(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return handle(req, res);
        });
    }
};
__decorate([
    Post(`${WEBHOOK_PREFIX}/:token`),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FlowWebhookController.prototype, "receive", null);
__decorate([
    Get(`${WEBHOOK_PREFIX}/:token`),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FlowWebhookController.prototype, "verify", null);
FlowWebhookController = __decorate([
    Controller()
], FlowWebhookController);
export default FlowWebhookController;
export const AvailableRouteMethods = ['receive', 'verify'];
