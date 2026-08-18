// ──────────────────────────────────────────────────────────────────────────
// Sending things to people.
//
// Backed by ETHPulseLeaf, which already owns the providers, the templates and
// the message log. These steps only exist when that leaf is configured — a
// palette offering "send an SMS" to a project with no SMS provider produces a
// flow that fails at three in the morning instead of at design time.
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
import { registry } from '../registry/Registry.js';
function pulse() {
    var _a;
    return (_a = etherial.eth_pulse_leaf) !== null && _a !== void 0 ? _a : null;
}
function hasService(kind) {
    const leaf = pulse();
    if (!leaf)
        return false;
    try {
        // The accessor throws when nothing is configured, which is exactly the
        // question being asked.
        leaf[kind]();
        return true;
    }
    catch (_a) {
        return false;
    }
}
export const emailNode = {
    id: 'notify.email',
    label: 'Send an email',
    icon: 'Mail',
    category: 'notify',
    available: () => hasService('email'),
    config: [
        {
            name: 'to',
            type: 'string',
            label: 'To',
            required: true,
            helpText: 'One address, or several separated by commas. Usually {{record.customer.email}}.',
        },
        { name: 'subject', type: 'string', label: 'Subject', required: true },
        {
            name: 'format',
            type: 'select',
            label: 'Body',
            defaultValue: 'transactional',
            options: [
                { value: 'transactional', label: 'Styled — the workspace template' },
                { value: 'text', label: 'Plain text' },
                { value: 'html', label: 'Raw HTML' },
            ],
        },
        { name: 'body', type: 'text', label: 'Message', required: true },
        {
            name: 'button_text',
            type: 'string',
            label: 'Button',
            showIf: { field: 'format', operator: 'eq', value: 'transactional' },
        },
        {
            name: 'button_url',
            type: 'string',
            label: 'Button link',
            showIf: { field: 'format', operator: 'eq', value: 'transactional' },
        },
    ],
    output: [
        { key: 'sent', label: 'Sent', type: 'boolean' },
        { key: 'recipients', label: 'Recipients', type: 'array' },
    ],
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ config, log }) {
        var _b, _c, _d, _e, _f, _g;
        const recipients = splitRecipients(config.to);
        if (recipients.length === 0) {
            // Not an error: a customer without an email address is a normal state
            // of the world, and failing the run would bury the useful steps.
            log('No address to send to');
            return { output: { sent: false, recipients: [] } };
        }
        const service = pulse().email();
        if (config.format === 'transactional') {
            // `sendTransactional` names its recipient `email`, where the plain
            // `send` below names it `to`. Passing the wrong one sends to nobody.
            const result = yield service.sendTransactional({
                email: recipients,
                subject: String((_b = config.subject) !== null && _b !== void 0 ? _b : ''),
                content: {
                    title: String((_c = config.subject) !== null && _c !== void 0 ? _c : ''),
                    body: String((_d = config.body) !== null && _d !== void 0 ? _d : ''),
                    buttonText: config.button_text || undefined,
                    buttonUrl: config.button_url || undefined,
                },
            });
            log(`Sent to ${recipients.join(', ')}`);
            return { output: { sent: (result === null || result === void 0 ? void 0 : result.success) !== false, recipients } };
        }
        const result = yield service.send(Object.assign({ to: recipients, subject: String((_e = config.subject) !== null && _e !== void 0 ? _e : '') }, (config.format === 'html'
            ? { html: String((_f = config.body) !== null && _f !== void 0 ? _f : '') }
            : { text: String((_g = config.body) !== null && _g !== void 0 ? _g : '') })));
        log(`Sent to ${recipients.join(', ')}`);
        return { output: { sent: (result === null || result === void 0 ? void 0 : result.success) !== false, recipients } };
    }),
};
export const smsNode = {
    id: 'notify.sms',
    label: 'Send an SMS',
    icon: 'MessageSquare',
    category: 'notify',
    available: () => hasService('sms'),
    config: [
        {
            name: 'to',
            type: 'string',
            label: 'To',
            required: true,
            helpText: 'A phone number in international format.',
        },
        { name: 'message', type: 'text', label: 'Message', required: true, maxLength: 800 },
    ],
    output: [{ key: 'sent', label: 'Sent', type: 'boolean' }],
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ config, log }) {
        var _b, _c;
        const recipients = splitRecipients(config.to);
        if (recipients.length === 0) {
            log('No number to send to');
            return { output: { sent: false } };
        }
        const service = pulse().sms();
        const message = String((_b = config.message) !== null && _b !== void 0 ? _b : '');
        let sent = 0;
        for (const phone of recipients) {
            const result = yield service.send({ phone, message });
            if ((result === null || result === void 0 ? void 0 : result.success) !== false)
                sent += 1;
            else
                log(`Failed for ${phone}: ${(_c = result === null || result === void 0 ? void 0 : result.error) !== null && _c !== void 0 ? _c : 'unknown error'}`);
        }
        log(`${sent}/${recipients.length} sent`);
        return { output: { sent: sent > 0, count: sent } };
    }),
};
export const pushNode = {
    id: 'notify.push',
    label: 'Send a push notification',
    icon: 'BellRing',
    category: 'notify',
    available: () => hasService('push'),
    config: [
        {
            name: 'target',
            type: 'select',
            label: 'To',
            defaultValue: 'user',
            options: [
                { value: 'user', label: "A user's devices" },
                { value: 'token', label: 'A device token' },
            ],
        },
        {
            name: 'user_id',
            type: 'string',
            label: 'User',
            defaultValue: '{{record.user_id}}',
            showIf: { field: 'target', operator: 'eq', value: 'user' },
        },
        {
            name: 'token',
            type: 'string',
            label: 'Device token',
            showIf: { field: 'target', operator: 'eq', value: 'token' },
        },
        { name: 'title', type: 'string', label: 'Title', required: true },
        { name: 'body', type: 'text', label: 'Message', required: true },
        {
            name: 'data',
            type: 'json',
            label: 'Payload',
            helpText: 'Passed through to the app — a screen to open, an id to load.',
        },
    ],
    output: [
        { key: 'sent', label: 'Sent', type: 'boolean' },
        { key: 'devices', label: 'Devices reached', type: 'number' },
    ],
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ config, log }) {
        var _b, _c, _d, _e, _f, _g, _h, _j;
        const leaf = pulse();
        const service = leaf.push();
        const message = {
            title: String((_b = config.title) !== null && _b !== void 0 ? _b : '') || ((_d = (_c = leaf.config) === null || _c === void 0 ? void 0 : _c.push) === null || _d === void 0 ? void 0 : _d.defaultNotificationTitle),
            body: String((_e = config.body) !== null && _e !== void 0 ? _e : ''),
            data: config.data && typeof config.data === 'object' ? config.data : undefined,
        };
        if (config.target === 'token') {
            const token = String((_f = config.token) !== null && _f !== void 0 ? _f : '').trim();
            if (!token) {
                log('No device token');
                return { output: { sent: false, devices: 0 } };
            }
            const result = yield service.send(token, message);
            return { output: { sent: (result === null || result === void 0 ? void 0 : result.success) !== false, devices: 1 } };
        }
        const userId = config.user_id;
        if (userId === null || userId === undefined || userId === '') {
            log('No user to notify');
            return { output: { sent: false, devices: 0 } };
        }
        const Device = (_j = (_h = (_g = etherial.database) === null || _g === void 0 ? void 0 : _g.sequelize) === null || _h === void 0 ? void 0 : _h.models) === null || _j === void 0 ? void 0 : _j.Device;
        if (!Device) {
            log('No device registry — is ETHPulseLeaf installed with its models?');
            return { output: { sent: false, devices: 0 } };
        }
        // `status: true` is what the rest of the project means by "a device we
        // still send to" — one the user logged out of is still a row here, and
        // pushing to it fails or reaches a phone that no longer expects it.
        const devices = yield Device.findAll({ where: { user_id: userId, status: true } });
        if (devices.length === 0) {
            // Someone who never opened the app. Worth a line in the log, not a
            // failed run.
            log(`User ${userId} has no registered device`);
            return { output: { sent: false, devices: 0 } };
        }
        const results = yield service.sendToDevices(devices, message);
        const sent = results.filter((result) => (result === null || result === void 0 ? void 0 : result.success) !== false).length;
        log(`${sent}/${devices.length} device${devices.length === 1 ? '' : 's'}`);
        return { output: { sent: sent > 0, devices: sent } };
    }),
};
function splitRecipients(value) {
    if (Array.isArray(value))
        return value.map((entry) => String(entry).trim()).filter(Boolean);
    return String(value !== null && value !== void 0 ? value : '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
}
export function registerNotifyNodes() {
    registry.registerNode(emailNode);
    registry.registerNode(smsNode);
    registry.registerNode(pushNode);
}
