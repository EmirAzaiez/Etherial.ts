var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Op, QueryTypes, col, fn, where as sqlWhere } from 'sequelize';
import { Expo } from 'expo-server-sdk';
import etherial from 'etherial';
import { runExclusive } from '../../../components/database/lock.js';
import { DevicePushTokenStatus } from '../models/Device.js';
import { NotificationCampaignStatus } from '../models/PushCampaign.js';
import { NotificationDeliveryStatus } from '../models/NotificationCampaignDelivery.js';
const SWEEP_INTERVAL_MS = 60 * 1000;
/** Receipts are collected every five minutes, by one server. */
const RECEIPT_INTERVAL_MS = 5 * 60 * 1000;
/** Expo advises waiting ~15 min before asking for a receipt… */
const RECEIPT_DELAY_MS = 15 * 60 * 1000;
/** …and forgets them after 24h. Past that, the delivery stays "sent". */
const RECEIPT_TTL_MS = 23 * 60 * 60 * 1000;
/** The `location` of a campaign in the notification centre (the bell). */
export const CAMPAIGN_NOTIFICATION_LOCATION = 'Campaign';
let config = null;
export function setCampaignsConfig(value) {
    config = value !== null && value !== void 0 ? value : null;
}
export function campaignsConfig() {
    if (!config) {
        throw new Error('[ETHPulseLeaf] Push campaigns are off: set `campaigns` in the leaf config');
    }
    return config;
}
const pulseConfig = () => { var _a; return (_a = etherial.eth_pulse_leaf) === null || _a === void 0 ? void 0 : _a.config; };
function models() {
    var _a, _b, _c;
    const own = campaignsConfig().models;
    const registered = etherial.database.sequelize.models;
    return {
        Campaign: own.campaign,
        Delivery: own.delivery,
        Device: (_a = own.device) !== null && _a !== void 0 ? _a : registered.Device,
        User: (_b = own.user) !== null && _b !== void 0 ? _b : registered.User,
        Notification: (_c = own.notification) !== null && _c !== void 0 ? _c : registered.Notification,
    };
}
let expoClient = null;
function expo() {
    var _a, _b, _c, _d;
    if (!expoClient) {
        const accessToken = ((_d = (_c = (_b = (_a = pulseConfig()) === null || _a === void 0 ? void 0 : _a.push) === null || _b === void 0 ? void 0 : _b.providers) === null || _c === void 0 ? void 0 : _c.expo) === null || _d === void 0 ? void 0 : _d.accessToken) || process.env.EXPO_ACCESS_TOKEN || undefined;
        expoClient = new Expo({ accessToken });
    }
    return expoClient;
}
export const defaultCampaignTitle = () => { var _a, _b; return ((_b = (_a = pulseConfig()) === null || _a === void 0 ? void 0 : _a.push) === null || _b === void 0 ? void 0 : _b.defaultNotificationTitle) || 'Notification'; };
function isArabic(device) {
    const own = campaignsConfig().arabic;
    if (own) {
        return own(device);
    }
    return (device.locale || '').toLowerCase().startsWith('ar');
}
/** The push a device gets for this campaign, in its language. */
function buildMessage(campaign, device, extraData = {}) {
    const arabic = isArabic(device);
    const data = Object.assign(Object.assign({}, (campaign.data || {})), extraData);
    if (campaign.url) {
        data.location = 'ExternalLink';
        data.url = campaign.url;
    }
    return {
        sound: 'default',
        title: (arabic && campaign.title_ar) || campaign.title || defaultCampaignTitle(),
        body: (arabic && campaign.message_ar) || campaign.message,
        data,
    };
}
/** The device's user, with what the language guess reads (and, given, who it must be). */
function userInclude(userWhere) {
    var _a;
    const include = { association: 'user', attributes: ['id', ...((_a = campaignsConfig().userAttributes) !== null && _a !== void 0 ? _a : [])], required: false };
    if (userWhere) {
        include.where = userWhere;
        include.required = true;
    }
    return include;
}
/**
 * Every enabled device a campaign targets, as the project's audience says.
 *
 * `pushOnly: false` keeps the devices that refused push, and `inbox` drops the
 * guests: the notification centre is for every signed-in user, and only for them.
 */
function targetDevices(campaign_1) {
    return __awaiter(this, arguments, void 0, function* (campaign, { pushOnly = true, inbox = false } = {}) {
        const { Device } = models();
        const own = campaignsConfig().audience;
        const resolved = own
            ? yield own(campaign)
            : { users: campaign.target_logged_user !== false, guests: !!campaign.target_not_logged_user };
        const audience = Array.isArray(resolved) ? { userIds: resolved } : resolved !== null && resolved !== void 0 ? resolved : {};
        const named = audience.userIds !== undefined || audience.userWhere !== undefined;
        const users = named || audience.users !== false;
        // A filter on the users is an inner join: it leaves no room for guests.
        const guests = !!audience.guests && !inbox && !audience.userWhere;
        if (!users && !guests) {
            return [];
        }
        const where = Object.assign(Object.assign({}, (pushOnly ? { push_token_status: DevicePushTokenStatus.ENABLED } : {})), { status: true });
        const signedIn = audience.userIds !== undefined ? { [Op.in]: audience.userIds } : { [Op.ne]: null };
        if (users && guests) {
            if (audience.userIds !== undefined) {
                where[Op.or] = [{ user_id: signedIn }, { user_id: null }];
            }
        }
        else if (users) {
            where.user_id = signedIn;
        }
        else {
            where.user_id = null;
        }
        return Device.findAll({ where, include: [userInclude(audience.userWhere)] });
    });
}
/**
 * Counts what `targetDevices` would send to, for a campaign not saved yet: the
 * form's targeting columns, read by the project's own audience rule, so the
 * count is the one the send will find (give or take the phones that change in
 * between).
 */
export function previewCampaignAudience(campaign) {
    return __awaiter(this, void 0, void 0, function* () {
        const devices = yield targetDevices(campaign, { pushOnly: false });
        const preview = { phones: 0, people: 0, guests: 0, arabic: 0, off: 0 };
        const people = new Set();
        for (const device of devices) {
            if (device.push_token_status !== DevicePushTokenStatus.ENABLED) {
                preview.off++;
                continue;
            }
            preview.phones++;
            if (device.user_id == null) {
                preview.guests++;
            }
            else {
                people.add(device.user_id);
            }
            if (isArabic(device)) {
                preview.arabic++;
            }
        }
        preview.people = people.size;
        return preview;
    });
}
/**
 * Sends one message per device and returns what Expo said about each one. A
 * chunk that fails as a whole marks all its devices failed.
 */
function sendToDevices(devices, messageFor) {
    return __awaiter(this, void 0, void 0, function* () {
        const outcomes = [];
        const valid = [];
        for (const device of devices) {
            if (Expo.isExpoPushToken(device.push_token)) {
                valid.push(device);
            }
            else {
                outcomes.push({ device, ticket: null, error: 'InvalidPushToken' });
            }
        }
        // chunkPushNotifications keeps the order, so chunk i/j maps back to valid[k].
        const messages = valid.map((device) => (Object.assign({ to: device.push_token }, messageFor(device))));
        let k = 0;
        for (const chunk of expo().chunkPushNotifications(messages)) {
            const slice = valid.slice(k, k + chunk.length);
            k += chunk.length;
            try {
                const tickets = yield expo().sendPushNotificationsAsync(chunk);
                slice.forEach((device, i) => { var _a; return outcomes.push({ device, ticket: (_a = tickets[i]) !== null && _a !== void 0 ? _a : null }); });
            }
            catch (err) {
                const error = (err === null || err === void 0 ? void 0 : err.message) || 'Push send failed';
                slice.forEach((device) => outcomes.push({ device, ticket: null, error }));
            }
        }
        return outcomes;
    });
}
/** What a campaign reads like in the notification centre, in the person's language. */
function inboxText(campaign, arabic) {
    const title = (arabic && campaign.title_ar) || campaign.title;
    const message = (arabic && campaign.message_ar) || campaign.message;
    return [title, message].filter((part) => part && part.trim()).join('\n');
}
/**
 * Leaves the campaign in the notification centre of every signed-in user it
 * targets, one entry per user (not per device), in the language of the device
 * they used last. Users who refused push get it too: the centre is where they
 * can still find it.
 *
 * A push alone leaves no trace in the app: once the banner is gone, the
 * campaign cannot be found anywhere. Safe to call again, a user who already
 * has the entry is skipped.
 *
 * `bulkCreate` on purpose: a Notification created one by one pushes itself
 * (@AfterCreate in the base notification), and the campaign has already pushed.
 */
export function publishCampaignToInbox(campaign) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const { Notification } = models();
        const devices = yield targetDevices(campaign, { pushOnly: false, inbox: true });
        const already = yield Notification.findAll({
            where: { location: CAMPAIGN_NOTIFICATION_LOCATION, location_id: campaign.id },
            attributes: ['created_for_user_id'],
        });
        const done = new Set(already.map((n) => n.created_for_user_id));
        const lastDevice = new Map();
        for (const device of devices) {
            if (!device.user_id || done.has(device.user_id)) {
                continue;
            }
            const current = lastDevice.get(device.user_id);
            if (!current || ((_b = (_a = device.last_activity) === null || _a === void 0 ? void 0 : _a.getTime()) !== null && _b !== void 0 ? _b : 0) > ((_d = (_c = current.last_activity) === null || _c === void 0 ? void 0 : _c.getTime()) !== null && _d !== void 0 ? _d : 0)) {
                lastDevice.set(device.user_id, device);
            }
        }
        const rows = [...lastDevice.values()].map((device) => {
            var _a;
            return ({
                title: inboxText(campaign, isArabic(device)),
                location: CAMPAIGN_NOTIFICATION_LOCATION,
                location_id: campaign.id,
                // The link the push opens, so the entry opens it too (the column is a varchar(255))
                location_title: campaign.url && campaign.url.length <= 255 ? campaign.url : null,
                created_for_user_id: device.user_id,
                created_by_user_id: (_a = campaign.created_by_user_id) !== null && _a !== void 0 ? _a : null,
            });
        });
        if (rows.length > 0) {
            yield Notification.bulkCreate(rows, { hooks: false });
        }
        return rows.length;
    });
}
function inboxEnabled() {
    return campaignsConfig().inbox !== false && !!models().Notification;
}
/** Stops pushing to a token Apple / Google told us is gone. */
function disableDevices(deviceIds) {
    return __awaiter(this, void 0, void 0, function* () {
        if (deviceIds.length === 0) {
            return;
        }
        const { Device } = models();
        yield Device.update({ push_token_status: DevicePushTokenStatus.DISABLED }, { where: { id: { [Op.in]: deviceIds } } });
    });
}
const quotedTable = (model) => model.sequelize.getQueryInterface().queryGenerator.quoteTable(model.getTableName());
/** Recomputes the campaign's counters from its deliveries (one query). */
export function refreshCampaignStats(campaignId) {
    return __awaiter(this, void 0, void 0, function* () {
        const { Campaign, Delivery } = models();
        yield Campaign.sequelize.query(`UPDATE ${quotedTable(Campaign)} c
            SET sent_count      = s.sent,
                failed_count    = s.failed,
                delivered_count = s.delivered,
                opened_count    = s.opened
           FROM (SELECT COUNT(*) FILTER (WHERE status <> 'failed')    AS sent,
                        COUNT(*) FILTER (WHERE status = 'failed')     AS failed,
                        COUNT(*) FILTER (WHERE status = 'delivered')  AS delivered,
                        COUNT(*) FILTER (WHERE opened_at IS NOT NULL) AS opened
                   FROM ${quotedTable(Delivery)}
                  WHERE campaign_id = :id) s
          WHERE c.id = :id`, { replacements: { id: campaignId }, type: QueryTypes.UPDATE });
    });
}
function ticketError(ticket) {
    var _a;
    if (!ticket || ticket.status !== 'error') {
        return null;
    }
    return ((_a = ticket.details) === null || _a === void 0 ? void 0 : _a.error) || ticket.message || 'Error';
}
/**
 * Sends a campaign that is due. Safe to call from anywhere, any number of times,
 * from any number of API instances: the status flip to `sending` is the claim,
 * and only the caller that wins it sends anything.
 *
 * Returns false when the campaign was not claimable (not scheduled, or not due).
 */
export function dispatchCampaign(campaignId) {
    return __awaiter(this, void 0, void 0, function* () {
        const { Campaign, Delivery } = models();
        const [claimed] = yield Campaign.update({ status: NotificationCampaignStatus.SENDING, error: null }, {
            where: {
                id: campaignId,
                status: NotificationCampaignStatus.SCHEDULED,
                scheduled_at: { [Op.lte]: new Date() },
            },
        });
        if (claimed === 0) {
            return false;
        }
        const campaign = yield Campaign.findByPk(campaignId);
        if (!campaign) {
            return false;
        }
        try {
            const devices = yield targetDevices(campaign);
            yield campaign.update({ devices_count: devices.length });
            const outcomes = yield sendToDevices(devices, (device) => buildMessage(campaign, device, { campaign_id: campaign.id }));
            yield Delivery.bulkCreate(outcomes.map(({ device, ticket, error }) => {
                var _a, _b, _c;
                const ok = (ticket === null || ticket === void 0 ? void 0 : ticket.status) === 'ok';
                return {
                    campaign_id: campaign.id,
                    device_id: device.id,
                    user_id: (_a = device.user_id) !== null && _a !== void 0 ? _a : null,
                    status: ok ? NotificationDeliveryStatus.SENT : NotificationDeliveryStatus.FAILED,
                    ticket_id: ok ? ticket.id : null,
                    error: ok ? null : (_c = (_b = ticketError(ticket)) !== null && _b !== void 0 ? _b : error) !== null && _c !== void 0 ? _c : 'Unknown error',
                };
            }), { ignoreDuplicates: true });
            yield disableDevices(outcomes.filter((o) => { var _a, _b; return ((_a = o.ticket) === null || _a === void 0 ? void 0 : _a.status) === 'error' && ((_b = o.ticket.details) === null || _b === void 0 ? void 0 : _b.error) === 'DeviceNotRegistered'; }).map((o) => o.device.id));
            yield campaign.update({ status: NotificationCampaignStatus.SENT, sent_at: new Date() });
            yield refreshCampaignStats(campaign.id);
            console.log(`[Campaigns] #${campaign.id} sent to ${devices.length} device(s)`);
            // The pushes are out: a failure here must not mark the campaign failed
            if (campaign.show_in_notifications !== false && inboxEnabled()) {
                try {
                    const people = yield publishCampaignToInbox(campaign);
                    console.log(`[Campaigns] #${campaign.id} added to ${people} notification centre(s)`);
                }
                catch (err) {
                    console.error(`[Campaigns] #${campaign.id} notification centre failed:`, (err === null || err === void 0 ? void 0 : err.message) || err);
                }
            }
            return true;
        }
        catch (err) {
            const message = (err === null || err === void 0 ? void 0 : err.message) || String(err);
            console.error(`[Campaigns] #${campaign.id} failed:`, message);
            yield campaign.update({ status: NotificationCampaignStatus.FAILED, error: message });
            yield refreshCampaignStats(campaign.id).catch(() => undefined);
            return true;
        }
    });
}
/**
 * Sends the campaign, exactly as people will get it, to one user's devices
 * only. Nothing is recorded: a test never counts in the results.
 */
export function sendCampaignTest(campaign, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const { Device } = models();
        const devices = yield Device.findAll({
            where: { user_id: userId, push_token_status: DevicePushTokenStatus.ENABLED, status: true },
            include: [userInclude()],
        });
        // No campaign_id in the data: tapping a test must not count as an open.
        const outcomes = yield sendToDevices(devices, (device) => buildMessage(campaign, device, { campaign_test: true }));
        return {
            devices: devices.length,
            sent: outcomes.filter((o) => { var _a; return ((_a = o.ticket) === null || _a === void 0 ? void 0 : _a.status) === 'ok'; }).length,
            errors: outcomes.map((o) => { var _a; return (_a = ticketError(o.ticket)) !== null && _a !== void 0 ? _a : o.error; }).filter((e) => !!e),
        };
    });
}
/** The user a test goes to, by email, whatever its case. */
export function findCampaignTestUser(email) {
    return __awaiter(this, void 0, void 0, function* () {
        const { User } = models();
        return User.findOne({ where: sqlWhere(fn('lower', col('email')), email.trim().toLowerCase()) });
    });
}
/**
 * Collects the receipts of the tickets old enough to have one. Receipts that
 * are not ready yet are simply retried on the next pass.
 */
export function collectReceipts() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const { Delivery } = models();
        const now = Date.now();
        const pending = yield Delivery.findAll({
            where: {
                status: NotificationDeliveryStatus.SENT,
                ticket_id: { [Op.ne]: null },
                receipt_checked_at: null,
                created_at: { [Op.lte]: new Date(now - RECEIPT_DELAY_MS) },
            },
            limit: 5000,
            order: [['id', 'ASC']],
        });
        if (pending.length === 0) {
            return;
        }
        const byTicket = new Map(pending.map((d) => [d.ticket_id, d]));
        const touched = new Set();
        const deadDevices = [];
        for (const chunk of expo().chunkPushNotificationReceiptIds([...byTicket.keys()])) {
            let receipts;
            try {
                receipts = yield expo().getPushNotificationReceiptsAsync(chunk);
            }
            catch (err) {
                console.warn('[Campaigns] receipt fetch failed:', err === null || err === void 0 ? void 0 : err.message);
                continue;
            }
            for (const [ticketId, receipt] of Object.entries(receipts)) {
                const delivery = byTicket.get(ticketId);
                if (!delivery) {
                    continue;
                }
                const code = ((_a = receipt.details) === null || _a === void 0 ? void 0 : _a.error) || receipt.message;
                yield delivery.update({
                    status: receipt.status === 'ok' ? NotificationDeliveryStatus.DELIVERED : NotificationDeliveryStatus.FAILED,
                    error: receipt.status === 'ok' ? null : code,
                    receipt_checked_at: new Date(),
                });
                if (((_b = receipt.details) === null || _b === void 0 ? void 0 : _b.error) === 'DeviceNotRegistered') {
                    deadDevices.push(delivery.device_id);
                }
                touched.add(delivery.campaign_id);
            }
        }
        // Expo no longer has a receipt for these: stop asking, they stay "sent".
        const expired = pending.filter((d) => !d.receipt_checked_at && d.created_at.getTime() < now - RECEIPT_TTL_MS);
        if (expired.length > 0) {
            yield Delivery.update({ receipt_checked_at: new Date() }, { where: { id: { [Op.in]: expired.map((d) => d.id) }, receipt_checked_at: null } });
        }
        yield disableDevices(deadDevices);
        for (const campaignId of touched) {
            yield refreshCampaignStats(campaignId);
        }
    });
}
/**
 * The app reports a tap on a campaign push, with its installation id. Idempotent:
 * only the first tap on a device counts (the app re-reports the launch
 * notification on every cold start).
 */
export function recordCampaignOpen(campaignId, installationId) {
    return __awaiter(this, void 0, void 0, function* () {
        const { Device, Delivery } = models();
        const device = yield Device.findOne({ where: { device: installationId }, attributes: ['id'] });
        if (!device) {
            return false;
        }
        const [updated] = yield Delivery.update({ opened_at: new Date() }, { where: { campaign_id: campaignId, device_id: device.id, opened_at: null } });
        if (updated > 0) {
            yield refreshCampaignStats(campaignId);
        }
        return updated > 0;
    });
}
/** Sends every scheduled campaign that has come due. */
function dispatchDueCampaigns() {
    return __awaiter(this, void 0, void 0, function* () {
        const { Campaign } = models();
        const due = yield Campaign.findAll({
            where: { status: NotificationCampaignStatus.SCHEDULED, scheduled_at: { [Op.lte]: new Date() } },
            attributes: ['id'],
            order: [['scheduled_at', 'ASC']],
        });
        for (const { id } of due) {
            yield dispatchCampaign(id);
        }
    });
}
let sweepTimer = null;
let sweeping = false;
function sweepOnce() {
    return __awaiter(this, void 0, void 0, function* () {
        if (sweeping) {
            return;
        }
        sweeping = true;
        try {
            // One server per turn. The leases are only there to spare the others
            // the work: the claim in dispatchCampaign is what makes a campaign go
            // out once, even when a long send outlives its lease.
            yield runExclusive('pulse:push-campaigns', { ttlMs: SWEEP_INTERVAL_MS - 5000, release: false }, dispatchDueCampaigns);
            yield runExclusive('pulse:push-campaign-receipts', { ttlMs: RECEIPT_INTERVAL_MS - 5000, release: false }, collectReceipts);
        }
        catch (err) {
            console.error('[Campaigns] sweep failed:', err);
        }
        finally {
            sweeping = false;
        }
    });
}
/**
 * Start the campaign sweep: due campaigns every minute, receipts every five.
 * The first pass waits a little, for the project's start-up migrations.
 *
 * A campaign left in `sending` by a crash mid-dispatch is NOT retried: some of
 * its pushes are already out, and sending again would double them. It shows up
 * as `sending` in the back-office, with its partial results.
 */
export function startCampaignSweep() {
    if (!config || config.sweep === false || sweepTimer) {
        return;
    }
    setTimeout(sweepOnce, 15000).unref();
    sweepTimer = setInterval(sweepOnce, SWEEP_INTERVAL_MS);
    sweepTimer.unref();
}
