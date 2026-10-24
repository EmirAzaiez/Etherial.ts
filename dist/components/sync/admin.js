var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import etherial from '../../index.js';
import { ExternalSync, ExternalSyncTarget, SyncStatus } from './models.js';
import { ensureSyncTargets, resendSync, syncTargets } from './index.js';
export const SYNCS_COLLECTION = 'external-syncs';
export const SYNC_TARGETS_COLLECTION = 'external-sync-targets';
const STATUS_OPTIONS = [
    { value: SyncStatus.PENDING, label: 'Waiting', color: 'blue' },
    { value: SyncStatus.SENDING, label: 'Sending', color: 'blue' },
    { value: SyncStatus.SYNCED, label: 'Sent', color: 'green' },
    { value: SyncStatus.FAILED, label: 'Retrying', color: 'orange' },
    { value: SyncStatus.BLOCKED, label: 'Blocked', color: 'red' },
];
/**
 * Lifecycle: afterRun — shows the records sent and the targets in the
 * back-office, with "Resend" and the pause switches. Any leaf may call it; it
 * does it once, and nothing without a target.
 */
export function registerSyncAdmin(adminLeaf = etherial.eth_admin_leaf) {
    var _a, _b, _c;
    const targets = syncTargets();
    if (!targets.length || !(adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.registerCollection) || ((_a = adminLeaf.getCollection) === null || _a === void 0 ? void 0 : _a.call(adminLeaf, SYNCS_COLLECTION)))
        return;
    const targetOptions = targets.map(({ target, label }) => ({ value: target, label: `${target} (${label})` }));
    if (!((_c = (_b = adminLeaf.actions) === null || _b === void 0 ? void 0 : _b.get) === null || _c === void 0 ? void 0 : _c.call(_b, 'sync:resend'))) {
        adminLeaf.actions.register('sync:resend', {
            meta: {
                label: 'Resend',
                description: 'Sends this record again now, from its current state',
                icon: 'RefreshCw',
                color: 'primary',
                confirm: { title: 'Resend this record?', message: 'Its current state is sent again now.', confirmText: 'Resend', cancelText: 'Cancel' },
            },
            handler: (record) => __awaiter(this, void 0, void 0, function* () {
                const outcome = yield resendSync(record.target, record.record_id);
                switch (outcome.status) {
                    case SyncStatus.SYNCED:
                        return { success: true, data: { message: 'Sent' } };
                    case 'paused':
                        return { success: false, error: 'Sending is paused for this target' };
                    case 'skipped':
                        return { success: false, error: 'It is being sent right now' };
                    default:
                        return { success: false, error: 'error' in outcome && outcome.error ? outcome.error : `Not sent (${outcome.status})` };
                }
            }),
        });
    }
    adminLeaf.registerCollection({
        name: SYNCS_COLLECTION,
        model: ExternalSync,
        crud: ['list', 'show'],
        exportable: true,
        meta: {
            label: 'Outgoing sync',
            labelPlural: 'Outgoing syncs',
            icon: 'RefreshCw',
            description: 'Each record sent to an outside system, and where it stands',
            group: 'System',
            order: 97,
        },
        fields: [
            { name: 'id', type: 'integer', readonly: true, sortable: true },
            { name: 'target', type: 'select', label: 'Target', filterable: true, options: targetOptions },
            { name: 'record_id', type: 'string', label: 'Record', searchable: true },
            { name: 'status', type: 'select', label: 'Status', filterable: true, options: STATUS_OPTIONS },
            { name: 'external_id', type: 'string', label: 'Id over there', searchable: true },
            { name: 'external_url', type: 'url', label: 'Open over there', readonly: true },
            { name: 'attempts', type: 'integer', label: 'Failed tries', sortable: true },
            { name: 'last_error', type: 'text', label: 'Last error', searchable: true },
            { name: 'changes', type: 'json', label: 'Fields to send' },
            { name: 'next_attempt_at', type: 'datetime', label: 'Next try', sortable: true },
            { name: 'synced_at', type: 'datetime', label: 'Last sent', sortable: true },
            { name: 'created_at', type: 'datetime', label: 'First queued', sortable: true },
            { name: 'updated_at', type: 'datetime', label: 'Updated', sortable: true, filterable: true },
        ],
        views: {
            list: {
                fields: ['updated_at', 'target', 'record_id', 'status', 'attempts', 'last_error', 'synced_at'],
                sort: { field: 'updated_at', direction: 'desc' },
                search: ['record_id', 'external_id', 'last_error'],
                filters: ['target', 'status', 'updated_at'],
            },
            show: {
                layout: 'sections',
                sections: [
                    { title: 'Record', fields: ['target', 'record_id', 'status', 'external_id', 'external_url'] },
                    { title: 'Tries', fields: ['attempts', 'last_error', 'changes', 'next_attempt_at', 'synced_at', 'created_at', 'updated_at'] },
                ],
            },
        },
        actions: ['sync:resend'],
    });
    adminLeaf.registerCollection({
        name: SYNC_TARGETS_COLLECTION,
        model: ExternalSyncTarget,
        crud: ['list', 'show', 'update'],
        meta: {
            label: 'Sync target',
            labelPlural: 'Sync targets',
            icon: 'PauseCircle',
            description: 'Where records are sent; paused, changes wait and nothing goes out',
            group: 'System',
            order: 98,
        },
        fields: [
            { name: 'id', type: 'integer', readonly: true },
            { name: 'target', type: 'string', label: 'Target', readonly: true },
            { name: 'label', type: 'string', label: 'Sent to', readonly: true },
            { name: 'paused', type: 'boolean', label: 'Paused' },
            { name: 'updated_at', type: 'datetime', label: 'Updated', readonly: true },
        ],
        views: {
            list: { fields: ['target', 'label', 'paused', 'updated_at'], sort: { field: 'target', direction: 'asc' } },
            show: { fields: ['target', 'label', 'paused', 'updated_at'] },
            edit: { fields: ['paused'] },
        },
    });
    // The switches need their rows; the tables exist once the database ran.
    ensureSyncTargets().catch((err) => console.error('[sync] Could not list the targets:', (err === null || err === void 0 ? void 0 : err.message) || err));
}
