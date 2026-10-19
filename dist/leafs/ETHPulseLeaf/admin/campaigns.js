var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as yup from 'yup';
import { EDITABLE_CAMPAIGN_STATUSES, NotificationCampaignStatus } from '../models/PushCampaign.js';
import { collectReceipts, defaultCampaignTitle, dispatchCampaign, findCampaignTestUser, refreshCampaignStats, sendCampaignTest, } from '../services/campaigns.js';
/**
 * The back-office side of push campaigns: the "Push campaigns" and "Push
 * deliveries" collections, their actions, and the hooks that turn the create
 * form's "When" choice into a draft, a schedule or an immediate send.
 *
 * The create request never sends anything itself: it schedules, and the engine
 * (services/campaigns.ts) sends, records the results and collects the receipts.
 */
export const CAMPAIGNS_COLLECTION = 'campaigns';
export const CAMPAIGN_DELIVERIES_COLLECTION = 'campaign-deliveries';
/** What the engine owns: never typed in from the back-office. */
const ENGINE_COLUMNS = ['status', 'sent_at', 'error', 'devices_count', 'sent_count', 'failed_count', 'delivered_count', 'opened_count'];
/** "Send At" may lag the click by this much and still count as now. */
const PAST_TOLERANCE_MS = 60 * 1000;
const dispatchInBackground = (campaignId) => {
    // Not awaited: a big audience takes a while, and the admin gets the
    // campaign page right away, its status moving to "sent" when done.
    dispatchCampaign(campaignId).catch((err) => console.error('[Campaigns] dispatch failed:', err));
};
/** The model's literal defaults, so the project's rules see the campaign as it will be saved. */
function modelDefaults(model) {
    var _a, _b, _c;
    const defaults = {};
    const attributes = (_c = (_b = (_a = model === null || model === void 0 ? void 0 : model.getAttributes) === null || _a === void 0 ? void 0 : _a.call(model)) !== null && _b !== void 0 ? _b : model === null || model === void 0 ? void 0 : model.rawAttributes) !== null && _c !== void 0 ? _c : {};
    for (const [name, attribute] of Object.entries(attributes)) {
        const value = attribute === null || attribute === void 0 ? void 0 : attribute.defaultValue;
        if (value === undefined || typeof value === 'function' || (typeof value === 'object' && value !== null)) {
            continue;
        }
        defaults[name] = value;
    }
    return defaults;
}
function registerActions(adminLeaf, cfg) {
    var _a;
    const actions = adminLeaf.actions;
    const Campaign = cfg.models.campaign;
    const audienceNoun = cfg.audienceNoun || 'users';
    const timeZone = (_a = cfg.timeZone) !== null && _a !== void 0 ? _a : { id: 'UTC', label: 'UTC' };
    actions.register('campaigns:send-test', {
        meta: {
            label: 'Send a test',
            description: `Send this campaign, exactly as ${audienceNoun} will get it, to one person's phones only. It doesn't count in the results.`,
            icon: 'flask-conical',
            color: 'secondary',
            category: 'notifications',
        },
        form: yup.object({
            email: yup.string().email().label('Send to (email) — leave empty to send it to yourself'),
        }),
        handler: (record, data, req) => __awaiter(this, void 0, void 0, function* () {
            try {
                const email = ((data === null || data === void 0 ? void 0 : data.email) || '').trim();
                const user = email ? yield findCampaignTestUser(email) : req === null || req === void 0 ? void 0 : req.user;
                if (!user) {
                    return { success: false, error: email ? `No user with the email ${email}.` : 'Enter the email of the person to send the test to.' };
                }
                const result = yield sendCampaignTest(record, user.id);
                if (result.devices === 0) {
                    return {
                        success: false,
                        error: `${user.email} has no phone registered for notifications: they need to log into the app and allow notifications.`,
                    };
                }
                if (result.sent === 0) {
                    return { success: false, error: `The test could not be sent to ${user.email}: ${result.errors.join(', ')}` };
                }
                return {
                    success: true,
                    data: { summary: `Test sent to ${user.email} on ${result.sent} of ${result.devices} device(s).`, errors: result.errors },
                };
            }
            catch (error) {
                return { success: false, error: error.message };
            }
        }),
    });
    actions.register('campaigns:send-now', {
        meta: {
            label: 'Send now',
            description: 'Send this draft or scheduled campaign to its audience right away.',
            icon: 'send',
            color: 'primary',
            category: 'notifications',
            confirm: {
                title: 'Send this campaign now',
                message: 'The push goes out to every targeted user immediately. This cannot be undone.',
                confirmText: 'Send',
                cancelText: 'Cancel',
            },
        },
        handler: (record) => __awaiter(this, void 0, void 0, function* () {
            // Conditional on the status: two clicks, or a click racing the
            // sweep, must not bring a sent campaign back to `scheduled`.
            const [updated] = yield Campaign.update({ status: NotificationCampaignStatus.SCHEDULED, scheduled_at: new Date() }, { where: { id: record.id, status: EDITABLE_CAMPAIGN_STATUSES } });
            if (updated === 0) {
                yield record.reload().catch(() => undefined);
                return { success: false, error: `This campaign is already ${record.status}.` };
            }
            dispatchInBackground(record.id);
            return { success: true, data: { summary: 'Sending — refresh the page in a moment to see the results.' } };
        }),
    });
    actions.register('campaigns:schedule', {
        meta: {
            label: 'Schedule',
            description: 'Send this draft automatically at its "Send At" time (edit the campaign to set it).',
            icon: 'calendar-clock',
            color: 'warning',
            category: 'notifications',
            confirm: {
                title: 'Schedule this campaign',
                message: 'It will be sent automatically at its "Send At" time.',
                confirmText: 'Schedule',
                cancelText: 'Cancel',
            },
        },
        handler: (record) => __awaiter(this, void 0, void 0, function* () {
            if (record.status !== NotificationCampaignStatus.DRAFT) {
                return { success: false, error: `Only a draft can be scheduled — this campaign is ${record.status}.` };
            }
            if (!record.scheduled_at) {
                return { success: false, error: 'Edit the campaign and set "Send At" first.' };
            }
            if (record.scheduled_at.getTime() < Date.now() - PAST_TOLERANCE_MS) {
                return { success: false, error: '"Send At" is in the past. Edit it, or use "Send now".' };
            }
            const [updated] = yield Campaign.update({ status: NotificationCampaignStatus.SCHEDULED }, { where: { id: record.id, status: NotificationCampaignStatus.DRAFT } });
            if (updated === 0) {
                yield record.reload().catch(() => undefined);
                return { success: false, error: `Only a draft can be scheduled — this campaign is ${record.status}.` };
            }
            const when = record.scheduled_at.toLocaleString('en-GB', { timeZone: timeZone.id, dateStyle: 'medium', timeStyle: 'short' });
            return { success: true, data: { summary: `Scheduled for ${when} (${timeZone.label}).` } };
        }),
    });
    actions.register('campaigns:unschedule', {
        meta: {
            label: 'Unschedule',
            description: 'Stop a scheduled campaign from going out: it goes back to draft.',
            icon: 'pause',
            color: 'secondary',
            category: 'notifications',
        },
        handler: (record) => __awaiter(this, void 0, void 0, function* () {
            // Conditional on the status so it can't race the sweep claiming it.
            const [updated] = yield Campaign.update({ status: NotificationCampaignStatus.DRAFT }, { where: { id: record.id, status: NotificationCampaignStatus.SCHEDULED } });
            if (updated === 0) {
                return { success: false, error: `Only a scheduled campaign can be unscheduled — this one is ${record.status}.` };
            }
            return { success: true, data: { summary: 'Back to draft. It will not be sent.' } };
        }),
    });
    actions.register('campaigns:refresh-results', {
        meta: {
            label: 'Refresh results',
            description: 'Fetch the latest delivery receipts now instead of waiting for the next automatic pass (every 5 min).',
            icon: 'refresh-cw',
            color: 'secondary',
            category: 'notifications',
        },
        handler: (record) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield collectReceipts();
                yield refreshCampaignStats(record.id);
                yield record.reload();
                return {
                    success: true,
                    data: {
                        summary: `${record.sent_count} sent, ${record.delivered_count} delivered, ${record.failed_count} failed, ${record.opened_count} opened.`,
                    },
                };
            }
            catch (error) {
                return { success: false, error: error.message };
            }
        }),
    });
}
function registerHooks(adminLeaf, cfg) {
    const hooks = adminLeaf.hooks;
    hooks.register('pulse:campaign-set-creator', {
        collection: CAMPAIGNS_COLLECTION,
        description: 'Auto-assign creator when campaign is created',
        beforeCreate: (data, req) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            if ((_a = req === null || req === void 0 ? void 0 : req.user) === null || _a === void 0 ? void 0 : _a.id) {
                data.created_by_user_id = req.user.id;
            }
            return data;
        }),
    });
    hooks.register('pulse:campaign-lifecycle', {
        collection: CAMPAIGNS_COLLECTION,
        description: 'Turn the "When" choice into a draft, a schedule, or an immediate send',
        beforeCreate: (data) => __awaiter(this, void 0, void 0, function* () {
            const mode = data.send_mode;
            delete data.send_mode;
            for (const key of ENGINE_COLUMNS) {
                delete data[key];
            }
            if (cfg.validate) {
                yield cfg.validate(Object.assign(Object.assign({}, modelDefaults(cfg.models.campaign)), data));
            }
            if (mode === 'now') {
                data.status = NotificationCampaignStatus.SCHEDULED;
                data.scheduled_at = new Date();
            }
            else if (mode === 'schedule') {
                const at = data.scheduled_at ? new Date(data.scheduled_at) : null;
                if (!at || isNaN(at.getTime())) {
                    throw new Error('Pick the date and time to send it at ("Send At").');
                }
                if (at.getTime() < Date.now() - PAST_TOLERANCE_MS) {
                    throw new Error('"Send At" is in the past. Pick a later time, or choose "Send now".');
                }
                data.status = NotificationCampaignStatus.SCHEDULED;
            }
            else if (mode === 'draft') {
                data.status = NotificationCampaignStatus.DRAFT;
            }
            else {
                throw new Error('Choose when to send it: now, later, or save it as a draft.');
            }
            return data;
        }),
        afterCreate: (campaign) => __awaiter(this, void 0, void 0, function* () {
            // "Send now": don't wait up to a minute for the sweep.
            if (campaign.status === NotificationCampaignStatus.SCHEDULED && campaign.scheduled_at && campaign.scheduled_at.getTime() <= Date.now()) {
                dispatchInBackground(campaign.id);
            }
        }),
        beforeUpdate: (record, data) => __awaiter(this, void 0, void 0, function* () {
            if (!EDITABLE_CAMPAIGN_STATUSES.includes(record.status)) {
                throw new Error('This campaign has already been sent, it can no longer be edited. Create a new one instead.');
            }
            delete data.send_mode;
            // Status moves through the actions (Send now / Schedule / Unschedule), never by hand.
            for (const key of ENGINE_COLUMNS) {
                delete data[key];
            }
            if (cfg.validate) {
                yield cfg.validate(Object.assign(Object.assign({}, record.get({ plain: true })), data));
            }
            if (record.status === NotificationCampaignStatus.SCHEDULED && 'scheduled_at' in data) {
                const at = data.scheduled_at ? new Date(data.scheduled_at) : null;
                if (!at || isNaN(at.getTime())) {
                    throw new Error('A scheduled campaign needs its "Send At". Use "Unschedule" to turn it back into a draft.');
                }
            }
            return data;
        }),
        beforeDelete: (record) => __awaiter(this, void 0, void 0, function* () {
            if (!EDITABLE_CAMPAIGN_STATUSES.includes(record.status)) {
                throw new Error('A sent campaign is kept for its results and cannot be deleted.');
            }
            return true;
        }),
    });
}
/** The leaf's own audience: two boxes, signed-in users and guests. */
const DEFAULT_TARGETING = [
    { name: 'target_logged_user', type: 'boolean', label: 'Target Logged Users', defaultValue: true },
    {
        name: 'target_not_logged_user',
        type: 'boolean',
        label: 'Target Guests',
        defaultValue: false,
        helpText: 'Phones with the app but no account logged in.',
    },
];
function campaignFields(cfg, targeting) {
    var _a, _b;
    const fields = [
        { name: 'id', type: 'integer', label: 'ID', readonly: true, sortable: true },
        { name: 'title', type: 'string', label: 'Title', col: 6, helpText: `Leave empty for "${defaultCampaignTitle()}"` },
        { name: 'title_ar', type: 'string', label: 'Title (Arabic)', col: 6, helpText: 'Sent to phones set to Arabic. Leave empty to use the English title' },
        { name: 'message', type: 'text', label: 'Message', required: true, col: 6 },
        { name: 'message_ar', type: 'text', label: 'Message (Arabic)', col: 6, helpText: 'Sent to phones set to Arabic. Leave empty to use the English message' },
        { name: 'url', type: 'url', label: 'URL', helpText: 'Link to open when notification is tapped' },
        {
            name: 'show_in_notifications',
            type: 'boolean',
            label: 'Show in notification screen',
            defaultValue: true,
            helpText: 'Also keep it in the notification screen of the app, so users can find it after the push is gone. Users who turned push notifications off see it there too. Logged-in users only.',
        },
        ...targeting,
        {
            // Create-only choice, turned into status / scheduled_at by the
            // pulse:campaign-lifecycle hook (never stored).
            name: 'send_mode',
            type: 'select',
            label: 'When',
            required: true,
            options: [
                { value: 'now', label: 'Send now' },
                { value: 'schedule', label: 'Schedule for later' },
                { value: 'draft', label: 'Save as draft (send a test first)' },
            ],
        },
        {
            name: 'scheduled_at',
            type: 'datetime',
            label: 'Send At',
            sortable: true,
            // No showIf on send_mode: that field is create-only, the edit
            // form would then never show the date.
            helpText: 'Only for "Schedule for later" — leave empty otherwise',
        },
        {
            name: 'status',
            type: 'select',
            label: 'Status',
            readonly: true,
            sortable: true,
            filterable: true,
            options: [
                { value: 'draft', label: 'Draft', color: 'secondary' },
                { value: 'scheduled', label: 'Scheduled', color: 'warning' },
                { value: 'sending', label: 'Sending', color: 'primary' },
                { value: 'sent', label: 'Sent', color: 'success' },
                { value: 'failed', label: 'Failed', color: 'danger' },
            ],
        },
        { name: 'error', type: 'text', label: 'Error', readonly: true },
        { name: 'devices_count', type: 'integer', label: 'Targeted', readonly: true, sortable: true, helpText: 'Devices matching the targeting at send time' },
        { name: 'sent_count', type: 'integer', label: 'Sent', readonly: true, sortable: true, helpText: 'Accepted by Expo' },
        { name: 'delivered_count', type: 'integer', label: 'Delivered', readonly: true, sortable: true, helpText: 'Confirmed by Apple / Google (~15 min after sending)' },
        { name: 'failed_count', type: 'integer', label: 'Failed', readonly: true, sortable: true },
        { name: 'opened_count', type: 'integer', label: 'Opened', readonly: true, sortable: true, helpText: 'Devices where the notification was tapped' },
        { name: 'open_rate', type: 'string', label: 'Open Rate', readonly: true, helpText: 'Opened / Sent' },
        {
            name: 'created_by_user_id',
            type: 'relation',
            label: 'Created By',
            readonly: true,
            relation: { collection: 'users', displayField: 'email' },
        },
        { name: 'sent_at', type: 'datetime', label: 'Sent At', readonly: true, sortable: true },
        { name: 'created_at', type: 'datetime', label: 'Created At', readonly: true, sortable: true },
    ];
    const overrides = (_b = (_a = cfg.admin) === null || _a === void 0 ? void 0 : _a.fields) !== null && _b !== void 0 ? _b : {};
    return fields.map((field) => (overrides[field.name] ? Object.assign(Object.assign({}, field), overrides[field.name]) : field));
}
function campaignsCollection(cfg) {
    var _a, _b, _c;
    const targeting = (_b = (_a = cfg.admin) === null || _a === void 0 ? void 0 : _a.targeting) !== null && _b !== void 0 ? _b : DEFAULT_TARGETING;
    const targetingNames = targeting.map((field) => field.name);
    const content = ['title', 'message', 'title_ar', 'message_ar', 'url', 'show_in_notifications'];
    return {
        name: CAMPAIGNS_COLLECTION,
        model: cfg.models.campaign,
        crud: ['list', 'show', 'create', 'update', 'delete'],
        actions: ['campaigns:send-test', 'campaigns:send-now', 'campaigns:schedule', 'campaigns:unschedule', 'campaigns:refresh-results'],
        meta: Object.assign({ label: 'Push campaign', labelPlural: 'Push campaigns', icon: 'megaphone', description: 'Send push notifications to your users — now, later, or as a draft to test first', group: 'Notifications', order: 1, showInDashboard: true }, (_c = cfg.admin) === null || _c === void 0 ? void 0 : _c.meta),
        fields: campaignFields(cfg, targeting),
        views: {
            list: {
                fields: ['id', 'message', 'status', 'scheduled_at', 'sent_count', 'delivered_count', 'opened_count', 'open_rate', 'sent_at'],
                sort: { field: 'created_at', direction: 'desc' },
                filters: ['status'],
            },
            show: {
                layout: 'sections',
                sections: [
                    { title: 'Campaign', fields: content },
                    ...(targetingNames.length > 0 ? [{ title: 'Targeting', fields: targetingNames }] : []),
                    { title: 'Delivery', fields: ['status', 'scheduled_at', 'sent_at', 'error', 'created_by_user_id', 'created_at'] },
                    { title: 'Results', fields: ['devices_count', 'sent_count', 'delivered_count', 'failed_count', 'opened_count', 'open_rate'] },
                ],
                // The project's campaign model declares `created_by_user` (BelongsTo User).
                include: [{ association: 'created_by_user', attributes: ['id', 'email'] }],
                collections: [
                    {
                        name: CAMPAIGN_DELIVERIES_COLLECTION,
                        title: 'Deliveries',
                        model: cfg.models.delivery,
                        foreignKey: 'campaign_id',
                        fields: ['id', 'user_id', 'status', 'error', 'opened_at', 'created_at'],
                        sort: { field: 'id', direction: 'asc' },
                        filters: ['status'],
                    },
                ],
            },
            create: {
                fields: [...content, ...targetingNames, 'send_mode', 'scheduled_at'],
            },
            edit: {
                // No `send_mode` here: a draft is scheduled with the Schedule
                // action, a scheduled campaign just gets its date moved.
                fields: [...content, ...targetingNames, 'scheduled_at'],
            },
        },
    };
}
/** One row per (campaign, device) — read-only, it is the campaign's results. */
function deliveriesCollection(cfg) {
    var _a, _b, _c;
    return {
        name: CAMPAIGN_DELIVERIES_COLLECTION,
        model: cfg.models.delivery,
        crud: ['list', 'show'],
        meta: {
            label: 'Push delivery',
            labelPlural: 'Push deliveries',
            icon: 'send',
            description: 'What happened to each push campaign on each device',
            group: (_c = (_b = (_a = cfg.admin) === null || _a === void 0 ? void 0 : _a.meta) === null || _b === void 0 ? void 0 : _b.group) !== null && _c !== void 0 ? _c : 'Notifications',
            order: 2,
        },
        fields: [
            { name: 'id', type: 'integer', label: 'ID', readonly: true, sortable: true },
            { name: 'campaign_id', type: 'relation', label: 'Campaign', readonly: true, filterable: true, relation: { collection: CAMPAIGNS_COLLECTION, displayField: 'message' } },
            { name: 'user_id', type: 'relation', label: 'User', readonly: true, relation: { collection: 'users', displayField: 'email' } },
            { name: 'device_id', type: 'integer', label: 'Device', readonly: true },
            {
                name: 'status',
                type: 'select',
                label: 'Status',
                readonly: true,
                filterable: true,
                options: [
                    { value: 'sent', label: 'Sent', color: 'primary' },
                    { value: 'delivered', label: 'Delivered', color: 'success' },
                    { value: 'failed', label: 'Failed', color: 'danger' },
                ],
            },
            { name: 'error', type: 'string', label: 'Error', readonly: true },
            { name: 'opened_at', type: 'datetime', label: 'Opened At', readonly: true, sortable: true },
            { name: 'created_at', type: 'datetime', label: 'Sent At', readonly: true, sortable: true },
        ],
        views: {
            list: {
                fields: ['id', 'campaign_id', 'user_id', 'status', 'error', 'opened_at', 'created_at'],
                sort: { field: 'id', direction: 'desc' },
                filters: ['campaign_id', 'status'],
                // The project's delivery model declares `user` (BelongsTo User).
                include: [{ association: 'user', attributes: ['id', 'email'] }],
            },
            show: {
                fields: ['id', 'campaign_id', 'user_id', 'device_id', 'status', 'error', 'opened_at', 'created_at'],
                include: [{ association: 'user', attributes: ['id', 'email'] }],
            },
        },
    };
}
/**
 * Registers the actions, hooks and both collections. Called from the leaf's
 * beforeRun: before the admin leaf resolves the hooks (its run) and installs
 * the change history on the collections that exist (its afterRun).
 *
 * A project that registers a `campaigns` collection of its own keeps it; the
 * actions and hooks are the leaf's either way.
 */
export function registerPushCampaignsAdmin(adminLeaf, cfg) {
    if (!(adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.actions) || !(adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.hooks)) {
        return;
    }
    registerActions(adminLeaf, cfg);
    registerHooks(adminLeaf, cfg);
    if (!adminLeaf.getCollection(CAMPAIGNS_COLLECTION)) {
        adminLeaf.registerCollection(campaignsCollection(cfg));
    }
    if (!adminLeaf.getCollection(CAMPAIGN_DELIVERIES_COLLECTION)) {
        adminLeaf.registerCollection(deliveriesCollection(cfg));
    }
}
