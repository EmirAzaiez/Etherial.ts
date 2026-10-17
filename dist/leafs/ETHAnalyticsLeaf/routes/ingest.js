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
import { Controller, Post } from 'etherial/components/http/provider';
import { state } from '../services/state.js';
import { EVENT_TYPES, clip, ingestOptions } from '../services/options.js';
/** Route names, event keys: letters of any script, digits, and a little punctuation. */
const NAME = /^[\p{L}\p{N} _.:\-/()&]{1,128}$/u;
/** Keys that should never be sent, and are dropped if they are. */
const SECRET_KEY = /pass|token|secret|otp|code|pin|card|cvv|iban/i;
const MAX_PROPERTIES_BYTES = 2048;
/** Clocks drift and phones queue events offline: older than 2 days or ahead of us is set to now. */
const MAX_PAST_MS = 2 * 24 * 3600 * 1000;
const MAX_FUTURE_MS = 5 * 60 * 1000;
/** A burst of batches from one address is slowed down: a broken loop in an app, or worse. */
const WINDOW_MS = 60 * 1000;
const MAX_BATCHES_PER_WINDOW = 120;
const recent = new Map();
function allowed(key) {
    const now = Date.now();
    const entry = recent.get(key);
    if (!entry || now - entry.since > WINDOW_MS) {
        if (recent.size > 10000)
            recent.clear();
        recent.set(key, { since: now, count: 1 });
        return true;
    }
    entry.count++;
    return entry.count <= MAX_BATCHES_PER_WINDOW;
}
function properties(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return null;
    const kept = {};
    for (const [key, v] of Object.entries(value).slice(0, 20)) {
        if (SECRET_KEY.test(key))
            continue;
        if (typeof v === 'string')
            kept[key.slice(0, 64)] = v.slice(0, 256);
        else if (typeof v === 'number' || typeof v === 'boolean' || v === null)
            kept[key.slice(0, 64)] = v;
    }
    if (Object.keys(kept).length === 0)
        return null;
    return JSON.stringify(kept).length <= MAX_PROPERTIES_BYTES ? kept : null;
}
function dateOf(value, now) {
    const t = typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : NaN;
    if (!Number.isFinite(t) || t < now - MAX_PAST_MS || t > now + MAX_FUTURE_MS)
        return new Date(now);
    return new Date(Math.min(t, now));
}
function eventOf(raw, now) {
    var _a;
    if (!raw || typeof raw !== 'object')
        return null;
    const type = String((_a = raw.type) !== null && _a !== void 0 ? _a : '');
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!EVENT_TYPES.includes(type) || type === 'api' || !NAME.test(name))
        return null;
    const screen = typeof raw.screen === 'string' && NAME.test(raw.screen.trim()) ? raw.screen.trim() : null;
    const duration = Number(raw.duration_ms);
    return {
        type,
        name,
        screen,
        properties: properties(raw.properties),
        // Time on a screen: more than a day is a phone left open.
        duration_ms: Number.isFinite(duration) && duration >= 0 ? Math.min(Math.round(duration), 24 * 3600 * 1000) : null,
        at: dateOf(raw.at, now),
    };
}
let ETHAnalyticsIngestController = class ETHAnalyticsIngestController {
    /**
     * POST /analytics/events
     *
     * { installation_id, platform, app_version, os_version, device_model, locale,
     *   events: [{ type: 'screen' | 'action' | 'app', name, screen?, properties?, duration_ms?, at? }] }
     *
     * Signed in or not: a valid token names the user, anything else is a guest.
     * Always answers 202 with what it kept, so a phone never retries a batch
     * because one event in it was wrong.
     */
    ingest(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            const options = ingestOptions(state.config);
            const collector = state.collector;
            if (!options || !collector)
                return res.error({ status: 404, errors: ['not_found'] });
            const body = ((_a = req.body) !== null && _a !== void 0 ? _a : {});
            const installation = clip(body.installation_id, 64);
            const ip = String((_c = (_b = req.headers['x-forwarded-for']) !== null && _b !== void 0 ? _b : req.ip) !== null && _c !== void 0 ? _c : '').split(',')[0].trim();
            if (!allowed(installation !== null && installation !== void 0 ? installation : ip))
                return res.error({ status: 429, errors: ['too_many_requests'] });
            const list = Array.isArray(body.events) ? body.events.slice(0, options.maxBatch) : [];
            const now = Date.now();
            const events = list.map((raw) => eventOf(raw, now)).filter((e) => !!e);
            let user = null;
            const auth = req.headers.authorization;
            if (auth === null || auth === void 0 ? void 0 : auth.startsWith('Bearer ')) {
                user = yield ((_d = etherial.http_auth) === null || _d === void 0 ? void 0 : _d.userFromToken(auth.slice(7)).catch(() => null));
            }
            if (user && ((_f = (_e = state.config).excludeUser) === null || _f === void 0 ? void 0 : _f.call(_e, user))) {
                return res.success({ status: 202, data: { accepted: 0 } });
            }
            const userId = Number(typeof (user === null || user === void 0 ? void 0 : user.get) === 'function' ? user.get('id') : user === null || user === void 0 ? void 0 : user.id);
            const accepted = events.length
                ? yield collector.track(events, {
                    user_id: Number.isInteger(userId) ? userId : null,
                    installation_id: installation,
                    platform: body.platform,
                    app_version: body.app_version,
                    os_version: body.os_version,
                    device_model: body.device_model,
                    locale: body.locale,
                }, 'app')
                : 0;
            return res.success({ status: 202, data: { accepted } });
        });
    }
};
__decorate([
    Post('/analytics/events'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAnalyticsIngestController.prototype, "ingest", null);
ETHAnalyticsIngestController = __decorate([
    Controller()
], ETHAnalyticsIngestController);
export default ETHAnalyticsIngestController;
