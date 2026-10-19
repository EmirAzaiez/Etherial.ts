// ──────────────────────────────────────────────────────────────────────────
// Telling the staff.
//
// The other notify steps reach customers through Pulse. This one reaches the
// people running the back-office: a line in their bell (and an email when
// asked), sent through the admin leaf's notifications, so it lands only on
// people who may open what it links to. It exists only when the project runs
// the admin leaf with `features.notifications` on.
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
import { registry } from '../registry/Registry.js';
import { adminLeaf, listCollections, collectionLabelPlural } from '../registry/admin.js';
/** `12, 15` or `[12, 15]` or a template that resolved to either: the integer ids in it. */
function idsOf(value) {
    const list = Array.isArray(value) ? value : String(value !== null && value !== void 0 ? value : '').split(/[\s,;]+/);
    return Array.from(new Set(list.map((entry) => Number(entry)).filter((id) => Number.isInteger(id) && id > 0)));
}
export const adminNotifyNode = {
    id: 'admin.notify',
    label: 'Notify the staff',
    description: 'Puts a notification in the back-office bell of the people you pick, and emails it if you want.',
    icon: 'Bell',
    category: 'notify',
    available: () => { var _a, _b; return ((_b = (_a = adminLeaf()) === null || _a === void 0 ? void 0 : _a.notificationsEnabled) === null || _b === void 0 ? void 0 : _b.call(_a)) === true; },
    config: () => [
        {
            name: 'recipients',
            type: 'select',
            label: 'Who',
            required: true,
            defaultValue: 'permission',
            options: [
                { value: 'all', label: 'Every back-office user' },
                { value: 'permission', label: 'Everyone with a permission on a collection' },
                { value: 'role', label: 'Everyone with a role' },
                { value: 'users', label: 'Specific users' },
            ],
        },
        {
            name: 'collection',
            type: 'select',
            label: 'Collection',
            required: true,
            options: listCollections().map((collection) => ({
                value: collection.name,
                label: collectionLabelPlural(collection),
            })),
            showIf: { field: 'recipients', operator: 'eq', value: 'permission' },
        },
        {
            name: 'permission',
            type: 'select',
            label: 'Permission',
            defaultValue: 'view',
            options: [
                { value: 'view', label: 'Can view' },
                { value: 'create', label: 'Can create' },
                { value: 'update', label: 'Can edit' },
                { value: 'delete', label: 'Can delete' },
                { value: 'actions', label: 'Can run actions' },
            ],
            showIf: { field: 'recipients', operator: 'eq', value: 'permission' },
        },
        {
            name: 'role_ids',
            type: 'string',
            label: 'Role ids',
            required: true,
            helpText: 'One role id, or several separated by commas.',
            showIf: { field: 'recipients', operator: 'eq', value: 'role' },
        },
        {
            name: 'user_ids',
            type: 'string',
            label: 'User ids',
            required: true,
            helpText: 'Ids separated by commas, or a value from the record, e.g. {{record.manager_id}}. Only back-office users are notified.',
            showIf: { field: 'recipients', operator: 'eq', value: 'users' },
        },
        { name: 'title', type: 'string', label: 'Title', required: true },
        { name: 'body', type: 'text', label: 'Message' },
        {
            name: 'link',
            type: 'string',
            label: 'Opens',
            helpText: 'A back-office path, e.g. /orders/{{record.id}}. Leave empty to open nothing.',
        },
        {
            name: 'email',
            type: 'boolean',
            label: 'Email it too',
            defaultValue: false,
            helpText: 'Sent right away, when the back-office has an address and an email transport.',
        },
    ],
    output: [{ key: 'notified', label: 'People notified', type: 'number' }],
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ config, context, log }) {
        var _b, _c, _d;
        const leaf = adminLeaf();
        if (!(leaf === null || leaf === void 0 ? void 0 : leaf.notify)) {
            throw new Error('Notifications are not enabled in the back-office');
        }
        const to = {};
        if (config.recipients === 'all')
            to.all = true;
        if (config.recipients === 'permission') {
            to.permission = { collection: String((_b = config.collection) !== null && _b !== void 0 ? _b : ''), permission: config.permission || 'view' };
        }
        if (config.recipients === 'role')
            to.adminRoleIds = idsOf(config.role_ids);
        if (config.recipients === 'users')
            to.userIds = idsOf(config.user_ids);
        const link = String((_c = config.link) !== null && _c !== void 0 ? _c : '').trim();
        const notified = yield leaf.notify({
            to,
            type: 'flow',
            title: String((_d = config.title) !== null && _d !== void 0 ? _d : '').trim() || 'Notification',
            body: config.body ? String(config.body) : undefined,
            link: link || undefined,
            collection: config.recipients === 'permission' ? config.collection : undefined,
            // No actor: the only user a run names is whoever started it by hand,
            // usually to test it, and leaving them out would make the test
            // look like it reached nobody.
            actorId: null,
            data: { flow_id: context.flowId, flow_name: context.flowName, run_id: context.runId },
            email: config.email === true || config.email === 'true',
        });
        log(notified ? `Notified ${notified} ${notified === 1 ? 'person' : 'people'}` : 'Nobody to notify');
        return { output: { notified } };
    }),
};
export function registerAdminNodes() {
    registry.registerNode(adminNotifyNode);
}
