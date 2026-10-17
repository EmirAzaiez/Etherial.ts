// ──────────────────────────────────────────────────────────────────────────
// API tracking: every call a signed-in user's app makes becomes an `api`
// event named after the route it hit — `GET /users/me/tickets/:ticket_id` —
// with its parameters, status and duration.
//
// The middleware is mounted before every controller and only listens for the
// response to finish: by then the route that answered and the user it
// authenticated are both on the request. Nothing is awaited on the request's
// path, and nothing that goes wrong here reaches the caller.
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
const IDENTIFY_TTL_MS = 10 * 60 * 1000;
const MAX_PARAM_LENGTH = 64;
function matches(rule, path) {
    if (rule instanceof RegExp)
        return rule.test(path);
    if (rule.endsWith('*'))
        return path.startsWith(rule.slice(0, -1));
    return path === rule;
}
/** `/tickets/:id(\\d+)` → `/tickets/:id`: the pattern is how the route matches, not what it is. */
export function cleanRoute(path) {
    return path.replace(/(:\w+)\((?:[^()]|\([^()]*\))*\)/g, '$1');
}
function idOf(user) {
    const id = Number(typeof (user === null || user === void 0 ? void 0 : user.get) === 'function' ? user.get('id') : user === null || user === void 0 ? void 0 : user.id);
    return Number.isInteger(id) && id > 0 ? id : null;
}
function header(req, name) {
    const value = req.headers[name];
    const first = Array.isArray(value) ? value[0] : value;
    return (first === null || first === void 0 ? void 0 : first.trim()) || null;
}
/** What the app says about itself in its request headers, when it does. */
export function contextFromHeaders(req) {
    return {
        installation_id: header(req, 'x-installation-id'),
        platform: header(req, 'x-app-platform'),
        app_version: header(req, 'x-app-version'),
        os_version: header(req, 'x-os-version'),
        device_model: header(req, 'x-device-model'),
        locale: header(req, 'x-app-locale'),
    };
}
/** `identify()` answers, kept a few minutes per user so it is not asked on every call. */
export class IdentifyCache {
    constructor(identify) {
        this.identify = identify;
        this.cache = new Map();
    }
    get(userId, user, req) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!this.identify)
                return null;
            const hit = this.cache.get(userId);
            if (hit && Date.now() - hit.at < IDENTIFY_TTL_MS)
                return hit.value;
            let value = null;
            try {
                value = (_a = (yield this.identify(user, req))) !== null && _a !== void 0 ? _a : null;
            }
            catch (err) {
                console.error('[ETHAnalyticsLeaf] identify() failed:', (err === null || err === void 0 ? void 0 : err.message) || err);
            }
            if (this.cache.size > 5000)
                this.cache.clear();
            this.cache.set(userId, { at: Date.now(), value });
            return value;
        });
    }
}
export function apiTrackingMiddleware(options, config, collector, identity, skipPrefixes) {
    var _a;
    const methods = (_a = options.methods) === null || _a === void 0 ? void 0 : _a.map((m) => m.toUpperCase());
    const record = (req, res, startedAt) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const rawPath = (_a = req.route) === null || _a === void 0 ? void 0 : _a.path;
        if (typeof rawPath !== 'string')
            return;
        const routePath = cleanRoute(rawPath);
        if (skipPrefixes.some((prefix) => routePath === prefix || routePath.startsWith(prefix + '/')))
            return;
        if ((_b = options.exclude) === null || _b === void 0 ? void 0 : _b.some((rule) => matches(rule, routePath)))
            return;
        if (options.include && !options.include.some((rule) => matches(rule, routePath)))
            return;
        const user = req.user;
        const userId = idOf(user);
        const fromHeaders = contextFromHeaders(req);
        if (!userId && !(options.guests && fromHeaders.installation_id))
            return;
        if (user && ((_c = config.excludeUser) === null || _c === void 0 ? void 0 : _c.call(config, user)))
            return;
        const identified = userId ? yield identity.get(userId, user, req) : null;
        // The headers describe this very call; identify() only the user's latest device.
        const context = Object.assign(Object.assign(Object.assign({}, identified), dropEmpty(fromHeaders)), { user_id: userId });
        const params = Object.fromEntries(Object.entries((_d = req.params) !== null && _d !== void 0 ? _d : {}).map(([k, v]) => [k, String(v).slice(0, MAX_PARAM_LENGTH)]));
        yield collector.track([
            {
                type: 'api',
                name: `${req.method} ${routePath}`.slice(0, 160),
                properties: Object.keys(params).length ? params : null,
                duration_ms: Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6),
                status: res.statusCode,
                at: new Date(),
            },
        ], context, 'api');
    });
    return (req, res, next) => {
        if (req.method === 'OPTIONS' || req.method === 'HEAD' || (methods && !methods.includes(req.method)))
            return next();
        const startedAt = process.hrtime.bigint();
        res.once('finish', () => {
            record(req, res, startedAt).catch((err) => console.error('[ETHAnalyticsLeaf] API tracking:', (err === null || err === void 0 ? void 0 : err.message) || err));
        });
        next();
    };
}
function dropEmpty(ctx) {
    return Object.fromEntries(Object.entries(ctx).filter(([, v]) => v !== null && v !== undefined && v !== ''));
}
