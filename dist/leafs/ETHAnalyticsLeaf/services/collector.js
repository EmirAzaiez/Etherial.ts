// ──────────────────────────────────────────────────────────────────────────
// Turns tracked events into rows, and events into visits.
//
// A visit is found by the app install first, then by the user: the app's own
// events carry the install, a call to the API often only the user. Both point
// at the same visit while it lasts, so what the app reports and what it asks
// the API land together. A visit ends after `sessionTimeoutMinutes` of silence,
// or when the install changes hands.
//
// Rows are written in batches every few seconds, never on the request's path:
// tracking can neither slow a request down nor make it fail. Visits live in
// memory while they last; after a restart the next event finds its visit
// again in the table.
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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import { randomUUID } from 'crypto';
import { Op } from 'sequelize';
import { AnalyticsEvent } from '../models/AnalyticsEvent.js';
import { AnalyticsSession } from '../models/AnalyticsSession.js';
import { clip, normalizePlatform } from './options.js';
const FLUSH_EVERY_MS = 5000;
const FLUSH_AT = 500;
/** Kept in memory when a write fails, then dropped: analytics never eat the server's memory. */
const MAX_BUFFER = 20000;
const SESSION_FIELDS = [
    'user_id',
    'installation_id',
    'platform',
    'app_version',
    'os_version',
    'device_model',
    'locale',
    'source',
    'started_at',
    'last_seen_at',
    'screen_count',
    'event_count',
    'entry_screen',
    'exit_screen',
];
export class Collector {
    constructor(timeout) {
        this.timeout = timeout;
        this.visits = new Map();
        this.pending = new Map();
        this.events = [];
        this.dirty = new Map();
        this.flushing = null;
    }
    start() {
        var _a, _b, _c, _d, _e, _f;
        (_a = this.timer) !== null && _a !== void 0 ? _a : (this.timer = setInterval(() => void this.flush(), FLUSH_EVERY_MS));
        (_c = (_b = this.timer).unref) === null || _c === void 0 ? void 0 : _c.call(_b);
        (_d = this.sweeper) !== null && _d !== void 0 ? _d : (this.sweeper = setInterval(() => this.sweep(), 60 * 1000));
        (_f = (_e = this.sweeper).unref) === null || _f === void 0 ? void 0 : _f.call(_e);
    }
    stop() {
        if (this.timer)
            clearInterval(this.timer);
        if (this.sweeper)
            clearInterval(this.sweeper);
        this.timer = this.sweeper = undefined;
    }
    /**
     * Records events for one person. Never throws: a broken event is dropped.
     * `source` says who reported them — the app itself, or the API watching
     * the app's calls.
     */
    track(events, context, source) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g;
            const ctx = cleanContext(context);
            if (!ctx.user_id && !ctx.installation_id)
                return 0;
            let kept = 0;
            // In time order, so a visit opens with its first event.
            const sorted = [...events].sort((a, b) => { var _a, _b, _c, _d; return ((_b = (_a = a.at) === null || _a === void 0 ? void 0 : _a.getTime()) !== null && _b !== void 0 ? _b : 0) - ((_d = (_c = b.at) === null || _c === void 0 ? void 0 : _c.getTime()) !== null && _d !== void 0 ? _d : 0); });
            for (const event of sorted) {
                const at = (_a = event.at) !== null && _a !== void 0 ? _a : new Date();
                try {
                    const visit = yield this.visitFor(ctx, at, source);
                    if (!visit)
                        continue;
                    this.apply(visit, event, at);
                    this.events.push({
                        session_id: visit.id,
                        user_id: visit.user_id,
                        installation_id: visit.installation_id,
                        type: event.type,
                        name: event.name,
                        screen: (_b = event.screen) !== null && _b !== void 0 ? _b : null,
                        properties: (_c = event.properties) !== null && _c !== void 0 ? _c : null,
                        duration_ms: (_d = event.duration_ms) !== null && _d !== void 0 ? _d : null,
                        status: (_e = event.status) !== null && _e !== void 0 ? _e : null,
                        platform: (_f = ctx.platform) !== null && _f !== void 0 ? _f : visit.platform,
                        app_version: (_g = ctx.app_version) !== null && _g !== void 0 ? _g : visit.app_version,
                        created_at: at,
                    });
                    kept++;
                }
                catch (err) {
                    console.error('[ETHAnalyticsLeaf] Could not track an event:', (err === null || err === void 0 ? void 0 : err.message) || err);
                }
            }
            if (this.events.length >= FLUSH_AT)
                void this.flush();
            return kept;
        });
    }
    /** Writes what is waiting. Safe to call at any time; calls overlap into one. */
    flush() {
        if (this.flushing)
            return this.flushing;
        if (this.events.length === 0 && this.dirty.size === 0)
            return Promise.resolve();
        const events = this.events.splice(0);
        const visits = Array.from(this.dirty.values());
        this.dirty.clear();
        this.flushing = (() => __awaiter(this, void 0, void 0, function* () {
            try {
                if (visits.length) {
                    yield AnalyticsSession.bulkCreate(visits.map(rowOf), {
                        updateOnDuplicate: [...SESSION_FIELDS],
                    });
                }
                if (events.length) {
                    yield AnalyticsEvent.bulkCreate(events, { validate: false });
                }
            }
            catch (err) {
                console.error('[ETHAnalyticsLeaf] Could not save analytics:', (err === null || err === void 0 ? void 0 : err.message) || err);
                // Tried again with the next batch, as long as it stays small.
                if (this.events.length + events.length <= MAX_BUFFER)
                    this.events.unshift(...events);
                for (const v of visits)
                    if (!this.dirty.has(v.id))
                        this.dirty.set(v.id, v);
            }
            finally {
                this.flushing = null;
            }
        }))();
        return this.flushing;
    }
    /** People in the app right now, from memory: the table lags by a few seconds. */
    liveVisits(withinMs) {
        const since = Date.now() - withinMs;
        const seen = new Set();
        const live = [];
        for (const visit of this.visits.values()) {
            if (seen.has(visit.id) || visit.last_seen_at.getTime() < since)
                continue;
            seen.add(visit.id);
            live.push({ id: visit.id, user_id: visit.user_id, exit_screen: visit.exit_screen, last_seen_at: visit.last_seen_at });
        }
        return live;
    }
    // ── Visits ───────────────────────────────────────────────────────────
    keysOf(ctx) {
        const keys = [];
        if (ctx.installation_id)
            keys.push(`i:${ctx.installation_id}`);
        if (ctx.user_id)
            keys.push(`u:${ctx.user_id}`);
        return keys;
    }
    /** Is `at` inside this visit, or close enough to extend it? */
    covers(visit, at) {
        const t = at.getTime();
        return t <= visit.last_seen_at.getTime() + this.timeout && t >= visit.started_at.getTime() - this.timeout;
    }
    /** The install is someone else's now, or the user is on another phone: a different visit. */
    belongs(visit, ctx) {
        if (visit.user_id && ctx.user_id && visit.user_id !== ctx.user_id)
            return false;
        if (visit.installation_id && ctx.installation_id && visit.installation_id !== ctx.installation_id)
            return false;
        return true;
    }
    visitFor(ctx, at, source) {
        return __awaiter(this, void 0, void 0, function* () {
            const keys = this.keysOf(ctx);
            for (const key of keys) {
                const visit = this.visits.get(key);
                if (visit && this.covers(visit, at) && this.belongs(visit, ctx))
                    return this.adopt(visit, ctx, source);
            }
            // One lookup at a time per person, or two parallel calls would open two visits.
            const lock = keys[0];
            const running = this.pending.get(lock);
            if (running) {
                const visit = yield running.catch(() => null);
                if (visit && this.covers(visit, at) && this.belongs(visit, ctx))
                    return this.adopt(visit, ctx, source);
                if (this.pending.get(lock) === running)
                    this.pending.delete(lock);
                return this.visitFor(ctx, at, source);
            }
            const opening = (() => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const stored = yield this.storedVisit(ctx, at);
                // The copy in memory is ahead of the table: keep using it.
                const live = stored && keys.map((k) => this.visits.get(k)).find((v) => (v === null || v === void 0 ? void 0 : v.id) === stored.id);
                const visit = (_a = live !== null && live !== void 0 ? live : stored) !== null && _a !== void 0 ? _a : this.open(ctx, at, source);
                // A late event from an older visit must not push the current one out.
                for (const key of keys) {
                    const current = this.visits.get(key);
                    if (!current || current.last_seen_at <= visit.last_seen_at)
                        this.visits.set(key, visit);
                }
                return visit;
            }))();
            this.pending.set(lock, opening);
            try {
                const visit = yield opening;
                return visit ? this.adopt(visit, ctx, source) : null;
            }
            finally {
                this.pending.delete(lock);
            }
        });
    }
    /** The visit this person was on before the server restarted, if it is still going. */
    storedVisit(ctx, at) {
        return __awaiter(this, void 0, void 0, function* () {
            const or = [];
            if (ctx.installation_id)
                or.push({ installation_id: ctx.installation_id });
            if (ctx.user_id)
                or.push({ user_id: ctx.user_id });
            const row = yield AnalyticsSession.findOne({
                where: {
                    [Op.or]: or,
                    last_seen_at: { [Op.gte]: new Date(at.getTime() - this.timeout) },
                    started_at: { [Op.lte]: new Date(at.getTime() + this.timeout) },
                },
                order: [['last_seen_at', 'DESC']],
            });
            if (!row || !this.belongs(row, ctx))
                return null;
            const plain = row.get({ plain: true });
            return Object.assign(Object.assign({}, plain), { source: plain.source === 'app' ? 'app' : 'api', started_at: new Date(plain.started_at), last_seen_at: new Date(plain.last_seen_at), exit_at: new Date(plain.last_seen_at).getTime() });
        });
    }
    open(ctx, at, source) {
        var _a, _b, _c, _d, _e, _f, _g;
        return {
            id: randomUUID(),
            user_id: (_a = ctx.user_id) !== null && _a !== void 0 ? _a : null,
            installation_id: (_b = ctx.installation_id) !== null && _b !== void 0 ? _b : null,
            platform: (_c = ctx.platform) !== null && _c !== void 0 ? _c : null,
            app_version: (_d = ctx.app_version) !== null && _d !== void 0 ? _d : null,
            os_version: (_e = ctx.os_version) !== null && _e !== void 0 ? _e : null,
            device_model: (_f = ctx.device_model) !== null && _f !== void 0 ? _f : null,
            locale: (_g = ctx.locale) !== null && _g !== void 0 ? _g : null,
            source,
            started_at: at,
            last_seen_at: at,
            screen_count: 0,
            event_count: 0,
            entry_screen: null,
            exit_screen: null,
            exit_at: 0,
        };
    }
    /** Learns what this event says about the visit: who signed in, on which phone. */
    adopt(visit, ctx, source) {
        if (!visit.user_id && ctx.user_id) {
            visit.user_id = ctx.user_id;
            this.visits.set(`u:${ctx.user_id}`, visit);
        }
        if (!visit.installation_id && ctx.installation_id) {
            visit.installation_id = ctx.installation_id;
            this.visits.set(`i:${ctx.installation_id}`, visit);
        }
        // What the app says about itself beats what the API guessed.
        const trusted = source === 'app';
        for (const field of ['platform', 'app_version', 'os_version', 'device_model', 'locale']) {
            if (ctx[field] && (trusted || !visit[field]))
                visit[field] = ctx[field];
        }
        if (source === 'app')
            visit.source = 'app';
        return visit;
    }
    apply(visit, event, at) {
        if (at < visit.started_at)
            visit.started_at = at;
        if (at > visit.last_seen_at)
            visit.last_seen_at = at;
        visit.event_count++;
        if (event.type === 'screen') {
            visit.screen_count++;
            if (!visit.entry_screen)
                visit.entry_screen = event.name.slice(0, 128);
            if (at.getTime() >= visit.exit_at) {
                visit.exit_screen = event.name.slice(0, 128);
                visit.exit_at = at.getTime();
            }
        }
        this.dirty.set(visit.id, visit);
    }
    /** Forgets visits that ended, once they are written. */
    sweep() {
        const before = Date.now() - this.timeout * 2;
        for (const [key, visit] of this.visits) {
            if (visit.last_seen_at.getTime() < before && !this.dirty.has(visit.id))
                this.visits.delete(key);
        }
    }
}
function rowOf(visit) {
    const { exit_at: _exitAt } = visit, row = __rest(visit, ["exit_at"]);
    return row;
}
function cleanContext(ctx) {
    const userId = Number(ctx.user_id);
    return {
        user_id: Number.isInteger(userId) && userId > 0 ? userId : null,
        installation_id: clip(ctx.installation_id, 64),
        platform: normalizePlatform(ctx.platform),
        app_version: clip(ctx.app_version, 32),
        os_version: clip(ctx.os_version, 32),
        device_model: clip(ctx.device_model, 64),
        locale: clip(ctx.locale, 16),
    };
}
