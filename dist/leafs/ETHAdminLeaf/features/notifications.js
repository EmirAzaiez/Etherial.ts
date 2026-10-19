// ──────────────────────────────────────────────────────────────────────────
// Back-office notifications.
//
// Anything on the server can tell staff something happened: a note mentions
// them, a flow step decides a manager should look, a campaign finished. Each
// recipient gets a row of their own (the bell in the header reads them), and
// an email right away when the sender asks for one, or in a daily digest of
// what they have not read.
//
// Recipients are named the way the sender thinks of them: these users, people
// with this role, whoever may edit orders, every admin. They are resolved now,
// through the access helpers, so someone who lost access to a collection is
// not told about its records. The person who caused it is never notified.
//
// Emails need the back-office's address (`appUrl`) for their links, and a
// transport: the mail leaf's `admin_notification` email when the project lists
// it, else ETHPulseLeaf's transactional template. Without either, the bell
// still works and nothing is sent.
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
import { Op } from 'sequelize';
import { runExclusive } from '../../../components/database/lock.js';
import { AdminNotification } from '../models/AdminNotification.js';
import { rolesConfig } from './access.js';
export const NOTIFICATION_EMAIL = 'admin_notification';
const DAY = 24 * 3600 * 1000;
const DIGEST_LINES = 10;
const DIGEST_ROWS = 5000;
let config = null;
const warned = new Set();
export function notificationsOptions(value) {
    if (!value)
        return null;
    return value === true ? {} : value;
}
/** Called by the leaf when `features.notifications` is on: until then `notifyAdmins` does nothing. */
export function configureNotifications(value) {
    config = value;
}
export function notificationsEnabled() {
    return config !== null;
}
function warnOnce(key, message) {
    if (warned.has(key))
        return;
    warned.add(key);
    console.warn(`[ETHAdminLeaf] ${message}`);
}
// ── Users ─────────────────────────────────────────────────────────────────
function adminLeaf() {
    var _a;
    return (_a = etherial.eth_admin_leaf) !== null && _a !== void 0 ? _a : null;
}
function valueOf(user, key) {
    return typeof (user === null || user === void 0 ? void 0 : user.get) === 'function' ? user.get(key) : user === null || user === void 0 ? void 0 : user[key];
}
export function userIdOf(user) {
    const id = Number(valueOf(user, 'id'));
    return Number.isInteger(id) ? id : null;
}
/** "Sara Ali", else the email: how a person is named in the bell, a note, a mention. */
export function adminUserLabel(user) {
    var _a, _b;
    if (!user)
        return '';
    const name = [(_a = valueOf(user, 'firstname')) !== null && _a !== void 0 ? _a : valueOf(user, 'first_name'), (_b = valueOf(user, 'lastname')) !== null && _b !== void 0 ? _b : valueOf(user, 'last_name')]
        .filter(Boolean)
        .join(' ');
    return String(name || valueOf(user, 'name') || valueOf(user, 'email') || valueOf(user, 'username') || `#${valueOf(user, 'id')}`);
}
function userModel(name) {
    var _a, _b, _c, _d, _e;
    const models = (_c = (_b = (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize) === null || _b === void 0 ? void 0 : _b.models) !== null && _c !== void 0 ? _c : {};
    return (_e = models[(_d = name !== null && name !== void 0 ? name : config === null || config === void 0 ? void 0 : config.userModel) !== null && _d !== void 0 ? _d : 'User']) !== null && _e !== void 0 ? _e : null;
}
/** The users behind these ids, by id. Missing ones are simply absent. */
export function loadUsers(ids, modelName) {
    return __awaiter(this, void 0, void 0, function* () {
        const found = new Map();
        const unique = Array.from(new Set(ids.filter((id) => Number.isInteger(id))));
        const User = userModel(modelName);
        if (!unique.length || !User)
            return found;
        const users = yield User.findAll({ where: { id: { [Op.in]: unique } } });
        for (const user of users) {
            const id = userIdOf(user);
            if (id !== null)
                found.set(id, user);
        }
        return found;
    });
}
/**
 * The people who may open the back-office, optionally only those holding a
 * permission on a collection. Comes from the access helpers (`listAdminUsers`):
 * a project without them has no way to list its staff, so every recipient
 * other than explicit user ids resolves to nobody, with one warning.
 */
export function listAdminUsers(filter) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const leaf = adminLeaf();
        if (typeof (leaf === null || leaf === void 0 ? void 0 : leaf.listAdminUsers) !== 'function') {
            warnOnce('listAdminUsers', 'listAdminUsers() is missing: notifications to roles, permissions or all admins reach nobody');
            return [];
        }
        return (_a = (yield leaf.listAdminUsers(filter))) !== null && _a !== void 0 ? _a : [];
    });
}
function resolveRecipients(to) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        const leaf = adminLeaf();
        const found = new Map();
        if (!leaf || !to)
            return found;
        const add = (users) => {
            for (const user of users) {
                const id = userIdOf(user);
                if (id !== null)
                    found.set(id, user);
            }
        };
        // Explicit ids come from wherever the sender found them (a flow's
        // template, a record's owner): only those who can still sign in to the
        // back-office are kept, or a resident's id would fill a table no one reads.
        if ((_a = to.userIds) === null || _a === void 0 ? void 0 : _a.length) {
            const users = yield loadUsers(to.userIds.map(Number));
            for (const user of users.values()) {
                if (yield leaf.canAccessAdmin(user))
                    add([user]);
            }
        }
        let everyone = null;
        const all = () => __awaiter(this, void 0, void 0, function* () { return (everyone !== null && everyone !== void 0 ? everyone : (everyone = yield listAdminUsers())); });
        if (to.all)
            add(yield all());
        if ((_b = to.adminRoleIds) === null || _b === void 0 ? void 0 : _b.length) {
            const roles = new Set(to.adminRoleIds.map(Number));
            const column = (_d = (_c = rolesConfig()) === null || _c === void 0 ? void 0 : _c.roleIdColumn) !== null && _d !== void 0 ? _d : 'admin_role_id';
            add((yield all()).filter((user) => roles.has(Number(valueOf(user, column)))));
        }
        if ((_e = to.permission) === null || _e === void 0 ? void 0 : _e.collection) {
            add(yield listAdminUsers({ collection: to.permission.collection, permission: (_f = to.permission.permission) !== null && _f !== void 0 ? _f : 'view' }));
        }
        return found;
    });
}
// ── Sending ───────────────────────────────────────────────────────────────
function safeLink(link) {
    if (typeof link !== 'string')
        return null;
    const trimmed = link.trim();
    // A back-office path only: the bell navigates to it inside the app.
    if (!trimmed.startsWith('/') || trimmed.startsWith('//'))
        return null;
    return trimmed.slice(0, 512);
}
/**
 * Creates one notification per recipient and resolves with how many. Does
 * nothing (0) while `features.notifications` is off, so any code may call it.
 * Rejects only when the rows cannot be written; emails go out afterwards and
 * never hold the caller up.
 */
export function notifyAdmins(input) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (!config || !(input === null || input === void 0 ? void 0 : input.to) || !input.title)
            return 0;
        const recipients = yield resolveRecipients(input.to);
        const actorId = Number(input.actorId);
        if (Number.isInteger(actorId))
            recipients.delete(actorId);
        if (!recipients.size)
            return 0;
        const base = {
            type: String(input.type || 'info').slice(0, 32),
            title: String(input.title).slice(0, 255),
            body: input.body ? String(input.body) : null,
            link: safeLink(input.link),
            collection: (_a = input.collection) !== null && _a !== void 0 ? _a : null,
            record_id: input.recordId !== undefined && input.recordId !== null ? String(input.recordId) : null,
            actor_id: Number.isInteger(actorId) ? actorId : null,
            data: (_b = input.data) !== null && _b !== void 0 ? _b : null,
        };
        const rows = yield AdminNotification.bulkCreate(Array.from(recipients.keys()).map((user_id) => (Object.assign(Object.assign({}, base), { user_id }))));
        if (input.email) {
            emailNow(rows, recipients).catch((err) => console.error('[ETHAdminLeaf] Notification email:', (err === null || err === void 0 ? void 0 : err.message) || err));
        }
        return rows.length;
    });
}
function emailOptions() {
    var _a, _b, _c;
    if (!config || config.email === false)
        return null;
    if (!config.appUrl) {
        warnOnce('appUrl', 'features.notifications.appUrl is not set: notification emails are not sent');
        return null;
    }
    const email = typeof config.email === 'object' ? config.email : {};
    return {
        digest: (_a = email.digest) !== null && _a !== void 0 ? _a : 'off',
        digestHour: (_b = email.digestHour) !== null && _b !== void 0 ? _b : 8,
        template: (_c = email.template) !== null && _c !== void 0 ? _c : NOTIFICATION_EMAIL,
    };
}
function absoluteUrl(link) {
    var _a;
    const base = String((_a = config === null || config === void 0 ? void 0 : config.appUrl) !== null && _a !== void 0 ? _a : '').replace(/\/+$/, '');
    return base + (link !== null && link !== void 0 ? link : '/');
}
function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
/** Sends one email to one user. Resolves with whether it left; never throws. */
function deliver(user, email, template) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const address = valueOf(user, 'email');
        if (!address)
            return false;
        try {
            const mail = etherial.eth_mail_leaf;
            const listed = ((_b = (_a = mail === null || mail === void 0 ? void 0 : mail.config) === null || _a === void 0 ? void 0 : _a.emails) !== null && _b !== void 0 ? _b : []).some((d) => d.key === template);
            if (mail && listed) {
                const result = yield mail.send(template, {
                    to: address,
                    user,
                    data: { title: email.title, body: email.body, url: email.url, button_label: email.buttonLabel },
                });
                return (result === null || result === void 0 ? void 0 : result.sent) === true;
            }
            // The mail leaf would refuse a key the project does not list, so the
            // fallback is Pulse's own branded template, which takes HTML.
            const pulse = etherial.eth_pulse_leaf;
            if (!(pulse === null || pulse === void 0 ? void 0 : pulse.email)) {
                warnOnce('transport', 'no mail transport (ETHMailLeaf email or ETHPulseLeaf email provider): notification emails are not sent');
                return false;
            }
            const result = yield pulse.email().sendTransactional({
                email: address,
                userId: (_c = userIdOf(user)) !== null && _c !== void 0 ? _c : undefined,
                subject: email.title,
                content: {
                    title: escapeHtml(email.title),
                    body: email.body ? `<p>${escapeHtml(email.body).replace(/\n/g, '<br>')}</p>` : '',
                    buttonText: email.buttonLabel,
                    buttonUrl: email.url,
                },
            });
            return (result === null || result === void 0 ? void 0 : result.success) === true;
        }
        catch (err) {
            console.error('[ETHAdminLeaf] Notification email:', (err === null || err === void 0 ? void 0 : err.message) || err);
            return false;
        }
    });
}
function emailNow(rows, recipients) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const options = emailOptions();
        if (!options)
            return;
        for (const row of rows) {
            const user = recipients.get(row.user_id);
            const sent = yield deliver(user, { title: row.title, body: (_a = row.body) !== null && _a !== void 0 ? _a : '', url: absoluteUrl(row.link), buttonLabel: 'Open' }, options.template);
            if (sent && row.id) {
                yield AdminNotification.update({ emailed_at: new Date() }, { where: { id: row.id } });
            }
        }
    });
}
/** One email per person for what they have neither read nor been emailed about this week. */
function sendDigest(template) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const since = new Date(Date.now() - 7 * DAY);
        const rows = yield AdminNotification.findAll({
            where: { read_at: null, emailed_at: null, created_at: { [Op.gte]: since } },
            order: [['id', 'DESC']],
            limit: DIGEST_ROWS,
        });
        const byUser = new Map();
        for (const row of rows) {
            const list = (_a = byUser.get(row.user_id)) !== null && _a !== void 0 ? _a : [];
            list.push(row);
            byUser.set(row.user_id, list);
        }
        if (!byUser.size)
            return;
        const leaf = adminLeaf();
        const users = yield loadUsers(Array.from(byUser.keys()));
        for (const [userId, list] of byUser) {
            const user = users.get(userId);
            if (!user || !(yield (leaf === null || leaf === void 0 ? void 0 : leaf.canAccessAdmin(user))))
                continue;
            const lines = list.slice(0, DIGEST_LINES).map((row) => `• ${row.title}`);
            if (list.length > DIGEST_LINES)
                lines.push(`… and ${list.length - DIGEST_LINES} more`);
            const sent = yield deliver(user, {
                title: list.length === 1 ? 'You have 1 unread notification' : `You have ${list.length} unread notifications`,
                body: lines.join('\n'),
                url: absoluteUrl('/'),
                buttonLabel: 'Open the back-office',
            }, template);
            if (sent) {
                yield AdminNotification.update({ emailed_at: new Date() }, {
                    where: { id: { [Op.in]: list.map((row) => row.id) } },
                });
            }
        }
    });
}
/**
 * The purge, daily, and the digest, checked hourly. Both run under a lease,
 * so with several servers only one of them does each turn.
 */
export function scheduleNotificationJobs() {
    var _a;
    if (!config)
        return;
    const days = (_a = config.retentionDays) !== null && _a !== void 0 ? _a : 90;
    const purge = () => runExclusive('admin-notifications:purge', { ttlMs: 23 * 3600 * 1000, release: false }, () => __awaiter(this, void 0, void 0, function* () {
        const cutoff = new Date(Date.now() - days * DAY);
        yield AdminNotification.destroy({ where: { created_at: { [Op.lt]: cutoff } } });
    })).catch((err) => console.error('[ETHAdminLeaf] Notification retention:', (err === null || err === void 0 ? void 0 : err.message) || err));
    if (days > 0) {
        purge();
        setInterval(purge, DAY).unref();
    }
    const options = emailOptions();
    if (!options || options.digest !== 'daily')
        return;
    const digest = () => {
        if (new Date().getHours() !== options.digestHour)
            return;
        // The lease outlives the hour: every server checks within it, one sends.
        runExclusive('admin-notifications:digest', { ttlMs: 20 * 3600 * 1000, release: false }, () => sendDigest(options.template)).catch((err) => console.error('[ETHAdminLeaf] Notification digest:', (err === null || err === void 0 ? void 0 : err.message) || err));
    };
    digest();
    setInterval(digest, 3600 * 1000).unref();
}
/**
 * The email the leaf sends through the mail leaf, ready to add to its
 * `emails` so the back-office can restyle and translate it:
 * `emails: [...mine, adminNotificationEmail()]`.
 */
export function adminNotificationEmail() {
    return {
        key: NOTIFICATION_EMAIL,
        name: 'Back-office notification',
        description: 'Sent to staff when they are mentioned in a note or notified by a flow, and as the daily digest.',
        category: 'Back-office',
        variables: {
            title: { label: 'Title', example: 'Sara Ali mentioned you on Order #12' },
            body: { label: 'Text', example: 'Can you check the delivery address?' },
            url: { label: 'Link', example: 'https://admin.example.com/orders/12' },
            button_label: { label: 'Button', example: 'Open' },
        },
        subject: '{{title}}',
        blocks: [
            { type: 'heading', text: '{{title}}' },
            { type: 'text', text: '{{body}}' },
            { type: 'button', label: '{{button_label}}', url: '{{url}}' },
        ],
    };
}
