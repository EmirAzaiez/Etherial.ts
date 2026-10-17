// ──────────────────────────────────────────────────────────────────────────
// A user's communications, in one timeline.
//
// "Did this customer get the reminder?" used to mean opening the message log,
// guessing the recipient (an email? a push token?), then the notifications,
// then the devices. The back-office now asks one route, which merges what the
// leaf knows — the message log, the in-app inbox, the devices — with what the
// project adds: a campaign table, a WhatsApp log, anything with a user id and
// a date.
//
// The log is matched by user id *and* by address. Rows written before the
// services passed the user id along only carry the recipient, and an email
// sent to a typed address belongs to whoever owns it today.
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
import etherial from 'etherial';
import { Op } from 'sequelize';
export function communicationsOptions(value) {
    if (!value)
        return null;
    return value === true ? {} : value;
}
const sources = new Map();
export function registerCommunicationSource(name, source) {
    sources.set(name, source);
}
const models = () => { var _a, _b, _c; return (_c = (_b = (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize) === null || _b === void 0 ? void 0 : _b.models) !== null && _c !== void 0 ? _c : {}; };
const adminLeaf = () => etherial.eth_admin_leaf;
/** The admin collection a model is listed in, so an entry can link to its record. */
export function collectionOf(model) {
    var _a, _b, _c;
    if (!model)
        return null;
    const found = (_b = (_a = adminLeaf()) === null || _a === void 0 ? void 0 : _a.collections) === null || _b === void 0 ? void 0 : _b.find((c) => { var _a; return c.model === model || ((_a = c.model) === null || _a === void 0 ? void 0 : _a.name) === model.name; });
    return (_c = found === null || found === void 0 ? void 0 : found.name) !== null && _c !== void 0 ? _c : null;
}
const SOURCE_LABELS = {
    transactional: 'Transactional',
    'back-office': 'Back-office',
};
/** The addresses a user is reachable at, as the log records them. */
function addressesOf(user, devices) {
    const values = [user === null || user === void 0 ? void 0 : user.email, user === null || user === void 0 ? void 0 : user.phone, user === null || user === void 0 ? void 0 : user.phone_number, user === null || user === void 0 ? void 0 : user.mobile, ...devices.map((d) => d.push_token)];
    const out = new Set();
    for (const v of values) {
        if (typeof v !== 'string' || !v.trim())
            continue;
        out.add(v.trim());
        if (v.includes('@'))
            out.add(v.trim().toLowerCase());
    }
    return [...out];
}
function messageLogWhere(query, addresses) {
    const owner = [{ user_id: query.userId }];
    if (addresses.length)
        owner.push({ recipient: { [Op.in]: addresses } });
    const where = { [Op.or]: owner };
    if (query.before)
        where.created_at = { [Op.lt]: query.before };
    if (query.channel && query.channel !== 'inbox')
        where.type = query.channel;
    return where;
}
/**
 * The built-in sources, from the models the project registered: the message
 * log (push, SMS, email) and the in-app inbox. Either is skipped when the
 * project has no such model.
 */
function builtinSources(devices) {
    var _a;
    const { MessageLog, Notification } = models();
    const builtins = new Map();
    if (MessageLog) {
        const collection = collectionOf(MessageLog);
        builtins.set('messages', {
            channels: ['push', 'sms', 'email'],
            list(query) {
                return __awaiter(this, void 0, void 0, function* () {
                    const rows = yield MessageLog.findAll({
                        where: messageLogWhere(query, addressesOf(query.user, devices)),
                        order: [['created_at', 'DESC'], ['id', 'DESC']],
                        limit: query.limit,
                    });
                    const deviceByToken = new Map(devices.map((d) => [d.push_token, d]));
                    let legacy = null;
                    return rows.map((row) => {
                        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
                        const meta = (_a = row.metadata) !== null && _a !== void 0 ? _a : {};
                        const device = row.type === 'push' ? deviceByToken.get(row.recipient) : null;
                        const at = new Date((_b = row.created_at) !== null && _b !== void 0 ? _b : row.createdAt).getTime();
                        let groupKey = meta.notification_id ? `inbox:${meta.notification_id}` : meta.batch ? `batch:${meta.batch}` : undefined;
                        // Rows logged before batches existed: the same push to each
                        // of a user's devices, written within a few seconds.
                        if (!groupKey && row.type === 'push') {
                            const subject = (_c = row.subject) !== null && _c !== void 0 ? _c : '';
                            const content = (_d = meta.content) !== null && _d !== void 0 ? _d : '';
                            if (!legacy || legacy.subject !== subject || legacy.content !== content || legacy.at - at > 3000) {
                                legacy = { key: `push:${row.id}`, subject, content, at };
                            }
                            groupKey = legacy.key;
                        }
                        return {
                            id: `message:${row.id}`,
                            channel: row.type,
                            at: (_e = row.created_at) !== null && _e !== void 0 ? _e : row.createdAt,
                            title: (_f = row.subject) !== null && _f !== void 0 ? _f : null,
                            body: (_g = meta.content) !== null && _g !== void 0 ? _g : null,
                            status: row.status,
                            recipient: row.type === 'push' ? null : row.recipient,
                            error: (_h = row.error_message) !== null && _h !== void 0 ? _h : null,
                            source: (_l = (_k = SOURCE_LABELS[(_j = meta.source) !== null && _j !== void 0 ? _j : meta.type]) !== null && _k !== void 0 ? _k : meta.source) !== null && _l !== void 0 ? _l : null,
                            device: device ? deviceLabel(device) : null,
                            link: collection ? { collection, id: row.id } : null,
                            groupKey,
                        };
                    });
                });
            },
            count(query) {
                return __awaiter(this, void 0, void 0, function* () {
                    const rows = yield MessageLog.count({
                        where: messageLogWhere(Object.assign(Object.assign({}, query), { before: undefined, channel: undefined }), addressesOf(query.user, devices)),
                        group: ['type'],
                    });
                    const out = {};
                    for (const r of rows)
                        out[r.type] = Number(r.count);
                    return out;
                });
            },
        });
    }
    if (Notification && ((_a = Notification.rawAttributes) === null || _a === void 0 ? void 0 : _a.created_for_user_id)) {
        const collection = collectionOf(Notification);
        builtins.set('inbox', {
            channels: ['inbox'],
            list(query) {
                return __awaiter(this, void 0, void 0, function* () {
                    const where = { created_for_user_id: query.userId };
                    if (query.before)
                        where.created_at = { [Op.lt]: query.before };
                    const rows = yield Notification.findAll({
                        where,
                        order: [['created_at', 'DESC'], ['id', 'DESC']],
                        limit: query.limit,
                        paranoid: false,
                    });
                    return rows.map((row) => {
                        var _a, _b, _c;
                        return ({
                            id: `inbox:${row.id}`,
                            channel: 'inbox',
                            at: (_a = row.created_at) !== null && _a !== void 0 ? _a : row.createdAt,
                            title: (_b = row.title) !== null && _b !== void 0 ? _b : null,
                            body: [row.location_title, row.sub_location_title].filter(Boolean).join(' · ') || null,
                            status: row.deleted_at ? 'deleted' : row.is_opened ? 'opened' : 'unread',
                            source: (_c = row.location) !== null && _c !== void 0 ? _c : null,
                            link: collection ? { collection, id: row.id } : null,
                        });
                    });
                });
            },
            count(query) {
                return __awaiter(this, void 0, void 0, function* () {
                    return { inbox: yield Notification.count({ where: { created_for_user_id: query.userId }, paranoid: false }) };
                });
            },
        });
    }
    return builtins;
}
export function deviceLabel(device) {
    const name = [device.brand && device.model && !String(device.model).startsWith(device.brand) ? device.brand : null, device.model || device.device]
        .filter(Boolean)
        .join(' ');
    return name || device.platform || `Device #${device.id}`;
}
// The leaf's DevicePlatform values; a project may store the name instead.
const PLATFORMS = { '1': 'web', '2': 'android', '3': 'ios' };
function serializeDevice(device) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const token = (_a = device.push_token) !== null && _a !== void 0 ? _a : null;
    const platform = device.platform == null ? null : (_b = PLATFORMS[String(device.platform)]) !== null && _b !== void 0 ? _b : String(device.platform).toLowerCase();
    return {
        id: device.id,
        label: deviceLabel(device),
        platform,
        os_version: (_c = device.os_version) !== null && _c !== void 0 ? _c : null,
        app_version: (_d = device.app_version) !== null && _d !== void 0 ? _d : null,
        locale: (_e = device.locale) !== null && _e !== void 0 ? _e : null,
        tz: (_f = device.tz) !== null && _f !== void 0 ? _f : null,
        // 1 = enabled in the leaf's enum; a project may store it as a string.
        push_enabled: !!token && (device.push_token_status === undefined || device.push_token_status === 1 || device.push_token_status === 'enabled'),
        active: device.status !== false,
        // Enough to tell two tokens apart, not enough to push with.
        push_token: token ? `${token.slice(0, 22)}…` : null,
        last_activity: (_g = device.last_activity) !== null && _g !== void 0 ? _g : null,
        created_at: (_j = (_h = device.created_at) !== null && _h !== void 0 ? _h : device.createdAt) !== null && _j !== void 0 ? _j : null,
    };
}
const RANK = ['failed', 'sent', 'delivered', 'opened'];
function summarize(entries) {
    const parts = entries.map((e) => { var _a, _b; return (_a = e.push) !== null && _a !== void 0 ? _a : { status: (_b = e.status) !== null && _b !== void 0 ? _b : 'sent', devices: 1, failed: e.status === 'failed' ? 1 : 0 }; });
    const sum = (key) => parts.reduce((n, p) => { var _a; return n + ((_a = p[key]) !== null && _a !== void 0 ? _a : 0); }, 0);
    const devices = sum('devices');
    const failed = sum('failed');
    const best = parts.map((p) => p.status).reduce((a, b) => (RANK.indexOf(b) > RANK.indexOf(a) ? b : a), 'failed');
    return { status: failed === devices ? 'failed' : best, devices, failed, delivered: sum('delivered'), opened: sum('opened') };
}
/**
 * One message, one line: the entries sharing a `groupKey` fold into the inbox
 * entry when it is on the page (it is what the user sees), else into the
 * first of them. The push side becomes a delivery summary.
 */
function mergeGroups(entries) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const keyOf = (e) => { var _a; return (_a = e.groupKey) !== null && _a !== void 0 ? _a : (e.channel === 'inbox' ? e.id : undefined); };
    const groups = new Map();
    for (const e of entries) {
        const key = keyOf(e);
        if (!key)
            continue;
        const group = (_a = groups.get(key)) !== null && _a !== void 0 ? _a : [];
        group.push(e);
        groups.set(key, group);
    }
    const out = [];
    const done = new Set();
    for (const e of entries) {
        const key = keyOf(e);
        const group = key ? groups.get(key) : [e];
        if (group.length === 1) {
            out.push(e);
            continue;
        }
        if (done.has(key))
            continue;
        done.add(key);
        const base = (_b = group.find((g) => g.channel === 'inbox')) !== null && _b !== void 0 ? _b : group[0];
        const pushes = group.filter((g) => g.channel === 'push');
        const other = group.find((g) => g !== base);
        const push = pushes.length ? summarize(pushes) : base.push;
        out.push(Object.assign(Object.assign({}, base), { status: base.channel === 'inbox' || !push ? base.status : push.status, title: (_c = base.title) !== null && _c !== void 0 ? _c : other.title, body: (_d = base.body) !== null && _d !== void 0 ? _d : other.body, 
            // The record that sent it says more than the inbox row.
            source: (_e = other.source) !== null && _e !== void 0 ? _e : base.source, link: (_f = other.link) !== null && _f !== void 0 ? _f : base.link, device: pushes.length > 1 ? null : (_h = (_g = pushes[0]) === null || _g === void 0 ? void 0 : _g.device) !== null && _h !== void 0 ? _h : base.device, push }));
    }
    return out;
}
export function userCommunications(options) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const m = models();
        const User = m[(_a = options.config.userModel) !== null && _a !== void 0 ? _a : 'User'];
        const user = User ? yield User.findByPk(options.userId) : null;
        if (User && !user)
            return null;
        const Device = m.Device;
        // The phone in use first: by last activity, which a project may not track.
        const seen = (d) => { var _a, _b, _c; return new Date((_c = (_b = (_a = d.last_activity) !== null && _a !== void 0 ? _a : d.updated_at) !== null && _b !== void 0 ? _b : d.updatedAt) !== null && _c !== void 0 ? _c : 0).getTime(); };
        const devices = Device
            ? (yield Device.findAll({ where: { user_id: options.userId } })).sort((a, b) => seen(b) - seen(a))
            : [];
        const limit = Math.min(Math.max((_b = options.limit) !== null && _b !== void 0 ? _b : 30, 1), 100);
        const query = {
            userId: options.userId,
            user,
            before: options.before,
            limit,
            channel: options.channel,
        };
        const all = new Map([...builtinSources(devices), ...sources]);
        const active = [...all.entries()].filter(([, s]) => !query.channel || s.channels.includes(query.channel));
        const lists = yield Promise.all(active.map(([name, s]) => s.list(query).catch((err) => {
            console.error(`[ETHPulseLeaf] Communications source "${name}":`, (err === null || err === void 0 ? void 0 : err.message) || err);
            return [];
        })));
        // Each source returned its newest `limit`; the newest `limit` of the union
        // is exact. The cursor is the oldest one kept.
        const merged = lists
            .flat()
            .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
            .slice(0, limit);
        const items = mergeGroups(merged).map((_a) => {
            var { groupKey } = _a, e = __rest(_a, ["groupKey"]);
            return e;
        });
        const nextBefore = merged.length === limit ? new Date(merged[merged.length - 1].at).toISOString() : null;
        // Totals only on the first page: they do not move with the cursor.
        let counts;
        if (!options.before) {
            counts = {};
            const results = yield Promise.all([...all.entries()].map(([name, s]) => s.count
                ? s.count(Object.assign(Object.assign({}, query), { channel: undefined })).catch((err) => {
                    console.error(`[ETHPulseLeaf] Communications count "${name}":`, (err === null || err === void 0 ? void 0 : err.message) || err);
                    return {};
                })
                : Promise.resolve({})));
            for (const r of results) {
                for (const [channel, n] of Object.entries(r))
                    counts[channel] = ((_c = counts[channel]) !== null && _c !== void 0 ? _c : 0) + (n !== null && n !== void 0 ? n : 0);
            }
        }
        return {
            devices: devices.map(serializeDevice),
            items,
            counts,
            nextBefore,
        };
    });
}
