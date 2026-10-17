// ──────────────────────────────────────────────────────────────────────────
// Back-office login journal.
//
// Every project signs its admins in through its own route (`/auth/email`,
// `/auth`, …) with its own token payload, so the leaf does not own the login.
// It watches it instead: the back-office tags its login request with
// `?via=backoffice`, and this middleware reads the answer the route sends —
// a token means it worked, anything else is the reason it did not.
//
// A token is not enough to call it a back-office login: the account must also
// pass `canAccessAdmin`, or an app user with a valid password would show up
// as an admin. Routes listed in `routes` are watched without the tag, so a
// script hitting the login directly still leaves a trace when it gets in.
//
// Logging never blocks or breaks the login: it runs after the response is
// handed over, and a failure only prints.
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
import etherial from 'etherial';
import { AdminLoginLog } from '../models/AdminLoginLog.js';
export const LOGIN_JOURNAL_COLLECTION = 'admin-logins';
export function loginJournalOptions(value) {
    if (!value)
        return null;
    return value === true ? {} : value;
}
const IDENTIFIER_KEYS = ['email', 'username', 'login', 'phone', 'identifier'];
function identifierOf(body) {
    if (!body || typeof body !== 'object')
        return null;
    for (const key of IDENTIFIER_KEYS) {
        const value = body[key];
        if (typeof value === 'string' && value.trim())
            return value.trim().toLowerCase().slice(0, 255);
    }
    return null;
}
function ipOf(req) {
    var _a, _b, _c;
    const forwarded = req.headers['x-forwarded-for'];
    const first = (_b = (_a = (Array.isArray(forwarded) ? forwarded[0] : forwarded)) === null || _a === void 0 ? void 0 : _a.split(',')[0]) === null || _b === void 0 ? void 0 : _b.trim();
    const ip = first || req.ip || ((_c = req.socket) === null || _c === void 0 ? void 0 : _c.remoteAddress) || '';
    return ip.replace(/^::ffff:/, '') || null;
}
/** "Chrome 141 on macOS" — enough to recognise a session, not a full parser. */
export function describeClient(ua) {
    var _a, _b;
    if (!ua)
        return null;
    const browser = (/Edg\/(\d+)/.exec(ua) && `Edge ${/Edg\/(\d+)/.exec(ua)[1]}`) ||
        (/OPR\/(\d+)/.exec(ua) && `Opera ${/OPR\/(\d+)/.exec(ua)[1]}`) ||
        (/Firefox\/(\d+)/.exec(ua) && `Firefox ${/Firefox\/(\d+)/.exec(ua)[1]}`) ||
        (/Chrome\/(\d+)/.exec(ua) && `Chrome ${/Chrome\/(\d+)/.exec(ua)[1]}`) ||
        (/Version\/(\d+)[\d.]* .*Safari/.exec(ua) && `Safari ${/Version\/(\d+)/.exec(ua)[1]}`) ||
        ((_b = (_a = /curl|PostmanRuntime|axios|node-fetch|python-requests|okhttp/i.exec(ua)) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : null);
    const os = (/iPhone|iPad/.test(ua) && 'iOS') ||
        (/Android/.test(ua) && 'Android') ||
        (/Mac OS X|Macintosh/.test(ua) && 'macOS') ||
        (/Windows/.test(ua) && 'Windows') ||
        (/Linux/.test(ua) && 'Linux') ||
        null;
    if (browser && os)
        return `${browser} on ${os}`;
    return browser || os || ua.slice(0, 60);
}
function tokenOf(body) {
    var _a, _b;
    const token = (_b = (_a = body === null || body === void 0 ? void 0 : body.data) === null || _a === void 0 ? void 0 : _a.token) !== null && _b !== void 0 ? _b : body === null || body === void 0 ? void 0 : body.token;
    return typeof token === 'string' && token ? token : null;
}
function reasonOf(status, body) {
    var _a;
    const error = Array.isArray(body === null || body === void 0 ? void 0 : body.errors) ? body.errors[0] : (_a = body === null || body === void 0 ? void 0 : body.error) !== null && _a !== void 0 ? _a : body === null || body === void 0 ? void 0 : body.message;
    const text = typeof error === 'string' ? error : error === null || error === void 0 ? void 0 : error.message;
    return String(text || `HTTP ${status}`).slice(0, 255);
}
function record(attempt, status, body, tagged) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const adminLeaf = etherial.eth_admin_leaf;
        const httpAuth = etherial.http_auth;
        const token = status < 400 && !((body === null || body === void 0 ? void 0 : body.status) >= 400) ? tokenOf(body) : null;
        let userId = null;
        let success = false;
        let reason = null;
        if (token) {
            const user = (httpAuth === null || httpAuth === void 0 ? void 0 : httpAuth.userFromToken) ? yield httpAuth.userFromToken(token) : null;
            const hasAccess = user ? yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.canAccessAdmin(user).catch(() => false)) : false;
            // An app user signing in through a watched route is not a back-office login.
            if (!hasAccess && !tagged)
                return;
            userId = (_a = user === null || user === void 0 ? void 0 : user.id) !== null && _a !== void 0 ? _a : null;
            success = !!hasAccess;
            reason = hasAccess ? null : 'no_admin_access';
        }
        else {
            // Untagged failures on a shared login route are app users mistyping a code.
            if (!tagged)
                return;
            reason = reasonOf(status, body);
        }
        const ua = attempt.userAgent;
        yield AdminLoginLog.create({
            user_id: userId,
            identifier: attempt.identifier,
            success,
            reason,
            ip: attempt.ip,
            client: describeClient(ua),
            user_agent: ua ? ua.slice(0, 1000) : null,
        });
    });
}
export function loginJournalMiddleware(config) {
    var _a;
    const routes = new Set((_a = config.routes) !== null && _a !== void 0 ? _a : []);
    return (req, res, next) => {
        var _a;
        if (req.method !== 'POST')
            return next();
        const tagged = ((_a = req.query) === null || _a === void 0 ? void 0 : _a.via) === 'backoffice';
        if (!tagged && !routes.has(req.path))
            return next();
        const send = res.json.bind(res);
        let done = false;
        res.json = (body) => {
            if (!done) {
                done = true;
                const status = res.statusCode;
                const attempt = {
                    identifier: identifierOf(req.body),
                    ip: ipOf(req),
                    userAgent: req.headers['user-agent'],
                };
                setImmediate(() => {
                    record(attempt, status, body, tagged).catch((err) => console.error('[ETHAdminLeaf] Login journal:', (err === null || err === void 0 ? void 0 : err.message) || err));
                });
            }
            return send(body);
        };
        next();
    };
}
/**
 * Joins each row to its account when the project has a user model, so the list
 * names the person instead of looking the id up in a page of users. No
 * constraint: the table must not depend on the project's.
 */
export function linkLoginJournalToUsers(config) {
    var _a, _b, _c, _d, _e;
    const models = (_c = (_b = (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize) === null || _b === void 0 ? void 0 : _b.models) !== null && _c !== void 0 ? _c : {};
    const User = models[(_d = config.userModel) !== null && _d !== void 0 ? _d : 'User'];
    if (!User)
        return false;
    if (!((_e = AdminLoginLog.associations) === null || _e === void 0 ? void 0 : _e.user)) {
        AdminLoginLog.belongsTo(User, { foreignKey: 'user_id', as: 'user', constraints: false });
    }
    return true;
}
/** The read-only collection the back-office lists the journal with. */
export function loginJournalCollection(config, hasUsers, linked) {
    var _a, _b;
    const usersCollection = (_a = config.usersCollection) !== null && _a !== void 0 ? _a : 'users';
    const displayField = (_b = config.usersDisplayField) !== null && _b !== void 0 ? _b : 'email';
    const include = linked ? [{ association: 'user', attributes: ['id', displayField] }] : [];
    return {
        name: LOGIN_JOURNAL_COLLECTION,
        model: AdminLoginLog,
        crud: ['list', 'show'],
        exportable: true,
        meta: {
            label: 'Login',
            labelPlural: 'Back-office logins',
            icon: 'LogIn',
            description: 'Every sign-in to the back-office, successful or not',
            group: 'System',
            order: 95,
        },
        fields: [
            { name: 'id', type: 'integer', readonly: true, sortable: true },
            {
                name: 'success',
                type: 'select',
                label: 'Result',
                filterable: true,
                options: [
                    { value: 'true', label: 'Signed in', color: 'green' },
                    { value: 'false', label: 'Refused', color: 'red' },
                ],
            },
            { name: 'identifier', type: 'string', label: 'Login', searchable: true, sortable: true },
            hasUsers
                ? {
                    name: 'user_id',
                    type: 'relation',
                    label: 'Account',
                    filterable: true,
                    relation: { collection: usersCollection, displayField },
                }
                : { name: 'user_id', type: 'integer', label: 'Account', filterable: true },
            { name: 'reason', type: 'string', label: 'Reason', filterable: true },
            { name: 'ip', type: 'string', label: 'IP address', searchable: true, filterable: true },
            { name: 'client', type: 'string', label: 'Browser' },
            { name: 'user_agent', type: 'text', label: 'User agent', readonly: true },
            { name: 'created_at', type: 'datetime', label: 'Date', readonly: true, sortable: true, filterable: true },
        ],
        views: {
            list: {
                fields: ['success', 'identifier', 'user_id', 'reason', 'ip', 'client', 'created_at'],
                sort: { field: 'created_at', direction: 'desc' },
                search: ['identifier', 'ip'],
                filters: ['success', 'reason', 'user_id', 'created_at'],
                include,
            },
            show: {
                layout: 'sections',
                sections: [
                    { title: 'Attempt', fields: ['success', 'reason', 'identifier', 'user_id', 'created_at'] },
                    { title: 'Origin', fields: ['ip', 'client', 'user_agent'] },
                ],
                include,
            },
        },
    };
}
