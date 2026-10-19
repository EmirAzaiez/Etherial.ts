/**
 * Error reporting to Sentry, on when `SENTRY_DSN` is set.
 *
 * `@sentry/node` is not a dependency of the framework: a project that wants
 * the reports installs it (`npm install @sentry/node`) and sets the DSN. It is
 * imported by a name held in a variable, so neither tsc nor a bundler goes
 * looking for it in an app that does not use it.
 *
 * What goes out: the error, the route, and the user's id. Not the
 * Authorization header, the cookies, nor any field whose name looks like a
 * password, token or code, at any depth of the body or the query string.
 *
 * Environment: `SENTRY_DSN`, and optionally `SENTRY_ENVIRONMENT` (else
 * `NODE_ENV`) and `SENTRY_RELEASE` (a git hash, say).
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
let sentry = null;
let starting = null;
const SENSITIVE_HEADERS = new Set(['authorization', 'proxy-authorization', 'cookie', 'set-cookie', 'x-api-key', 'x-auth-token', 'x-access-token']);
// Whole words of a key, once camelCase is split: `newPassword`, `otp_code`,
// `accessToken`, `pin` — and not `shipping` or `opinion`.
const SENSITIVE_WORDS = new Set([
    'password',
    'passwd',
    'pwd',
    'pass',
    'secret',
    'token',
    'otp',
    'code',
    'pin',
    'cvv',
    'cvc',
    'iban',
    'apikey',
    'key',
    'signature',
    'authorization',
    'cookie',
    'session',
]);
const FILTERED = '[Filtered]';
function isSensitiveKey(key) {
    const words = key
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .toLowerCase()
        .split(/[^a-z0-9]+/);
    return words.some((word) => SENSITIVE_WORDS.has(word)) || /api_?key|password|secret|token/i.test(key);
}
function scrub(value, depth = 0) {
    if (value === null || typeof value !== 'object' || depth > 6) {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item) => scrub(item, depth + 1));
    }
    const out = {};
    for (const [key, item] of Object.entries(value)) {
        out[key] = isSensitiveKey(key) ? FILTERED : scrub(item, depth + 1);
    }
    return out;
}
function scrubHeaders(headers) {
    if (!headers) {
        return headers;
    }
    const out = {};
    for (const [name, value] of Object.entries(headers)) {
        out[name] = SENSITIVE_HEADERS.has(name.toLowerCase()) ? FILTERED : value;
    }
    return out;
}
function scrubUrl(url) {
    if (!url || !url.includes('?')) {
        return url;
    }
    const [path, query] = url.split('?', 2);
    const params = query
        .split('&')
        .map((pair) => {
        var _a;
        const name = decodeURIComponent((_a = pair.split('=')[0]) !== null && _a !== void 0 ? _a : '');
        return isSensitiveKey(name) ? `${pair.split('=')[0]}=${FILTERED}` : pair;
    })
        .join('&');
    return `${path}?${params}`;
}
function scrubQuery(query) {
    if (typeof query === 'string') {
        return scrubUrl(`?${query}`).slice(1);
    }
    return scrub(query);
}
/** The last pass over every event, including the ones Sentry builds itself. */
function scrubEvent(event) {
    if (event.request) {
        event.request.headers = scrubHeaders(event.request.headers);
        event.request.url = scrubUrl(event.request.url);
        event.request.query_string = scrubQuery(event.request.query_string);
        event.request.data = scrub(event.request.data);
        delete event.request.cookies;
    }
    if (event.user) {
        event.user = event.user.id !== undefined ? { id: event.user.id } : undefined;
    }
    if (Array.isArray(event.breadcrumbs)) {
        event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
    }
    return event;
}
function scrubBreadcrumb(breadcrumb) {
    var _a;
    if ((_a = breadcrumb === null || breadcrumb === void 0 ? void 0 : breadcrumb.data) === null || _a === void 0 ? void 0 : _a.url) {
        breadcrumb.data.url = scrubUrl(breadcrumb.data.url);
    }
    return breadcrumb;
}
/**
 * Loads and starts Sentry when `SENTRY_DSN` is set; does nothing otherwise.
 * Sentry's default integrations then also report uncaught exceptions and
 * unhandled rejections, without changing what the process does with them.
 */
export function startSentry() {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
        return Promise.resolve();
    }
    starting !== null && starting !== void 0 ? starting : (starting = (() => __awaiter(this, void 0, void 0, function* () {
        // In a variable: tsc must not resolve a package the framework does not depend on.
        const name = '@sentry/node';
        let mod;
        try {
            mod = yield import(name);
        }
        catch (_a) {
            console.warn('[Etherial] SENTRY_DSN is set but @sentry/node is not installed: errors are not reported. Run `npm install @sentry/node`.');
            return;
        }
        const Sentry = (mod === null || mod === void 0 ? void 0 : mod.init) ? mod : mod === null || mod === void 0 ? void 0 : mod.default;
        if (!(Sentry === null || Sentry === void 0 ? void 0 : Sentry.init)) {
            console.warn('[Etherial] SENTRY_DSN is set but @sentry/node could not be loaded: errors are not reported.');
            return;
        }
        Sentry.init({
            dsn,
            environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
            release: process.env.SENTRY_RELEASE || undefined,
            // No IP address, cookies, bodies, query parameters or local
            // variables (a `password` one, say) collected by Sentry itself.
            // `sendDefaultPii` up to v10, `dataCollection` from v11: each
            // version ignores the other's.
            sendDefaultPii: false,
            includeLocalVariables: false,
            dataCollection: {
                userInfo: false,
                cookies: false,
                httpBodies: [],
                urlQueryParams: false,
                databaseQueryData: false,
                stackFrameVariables: false,
            },
            beforeSend: scrubEvent,
            beforeBreadcrumb: scrubBreadcrumb,
        });
        sentry = Sentry;
        console.log(`[Etherial] Sentry reporting on (${process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development'})`);
    }))());
    return starting;
}
/**
 * Reports an error, with what is safe to know of the request it broke:
 * method, route, scrubbed headers, query and body, and the user's id.
 * A no-op while Sentry is off.
 */
export function captureError(error, req) {
    if (!sentry) {
        return;
    }
    try {
        sentry.withScope((scope) => {
            var _a, _b, _c, _d, _e, _f;
            if (req) {
                const userId = (_c = (_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : req.user_id) !== null && _c !== void 0 ? _c : (_d = req.auth) === null || _d === void 0 ? void 0 : _d.user_id;
                if (userId !== undefined && userId !== null) {
                    scope.setUser({ id: String(userId) });
                }
                if ((_e = req.route) === null || _e === void 0 ? void 0 : _e.path) {
                    scope.setTag('route', `${req.method} ${(_f = req.baseUrl) !== null && _f !== void 0 ? _f : ''}${req.route.path}`);
                }
                scope.addEventProcessor((event) => {
                    var _a;
                    event.request = Object.assign(Object.assign({}, event.request), { method: req.method, url: scrubUrl((_a = req.originalUrl) !== null && _a !== void 0 ? _a : req.url), headers: scrubHeaders(req.headers), query_string: undefined, data: scrub(req.body) });
                    return event;
                });
            }
            sentry.captureException(error);
        });
    }
    catch (_a) {
        // Reporting must never be the reason a request fails.
    }
}
/** Waits for queued events to go out — before a CLI command exits, say. */
export function flushSentry() {
    return __awaiter(this, arguments, void 0, function* (timeoutMs = 2000) {
        if (!(sentry === null || sentry === void 0 ? void 0 : sentry.flush)) {
            return;
        }
        yield sentry.flush(timeoutMs).catch(() => undefined);
    });
}
