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
import { DevicePushTokenStatus } from '../models/Device.js';
import { Op } from 'sequelize';
import etherial from 'etherial';
const getModels = () => {
    const models = etherial.database.sequelize.models;
    return {
        Device: models.Device,
        MessageLog: models.MessageLog,
        NotificationCampaign: models.NotificationCampaign,
    };
};
const getPulseLeaf = () => etherial.eth_pulse_leaf;
// ============================================
// ACTIONS (User-triggered, buttons in UI)
// ============================================
export const pulseActions = {
    'pulse:send-push': {
        meta: {
            label: 'Send Push Notification',
            description: 'Send a push notification to this user',
            icon: 'bell',
            color: 'primary',
            category: 'notifications',
            confirm: {
                title: 'Send Push Notification',
                message: 'Are you sure you want to send a push notification?',
                confirmText: 'Send',
                cancelText: 'Cancel'
            }
        },
        form: yup.object({
            title: yup.string().label('Title'),
            message: yup.string().required().max(500).label('Message'),
            url: yup.string().url().label('Link (optional)')
        }),
        handler: (record, data, _req, _context) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            const { title, message, url } = data;
            const { Device } = getModels();
            const devices = yield Device.findAll({
                where: {
                    user_id: record.id,
                    push_token_status: DevicePushTokenStatus.ENABLED,
                    status: true
                }
            });
            const tokens = devices.map(d => d.push_token).filter(Boolean);
            if (tokens.length === 0) {
                return { success: true, data: { sent_to: 0, message: 'No active devices' } };
            }
            const pulseLeaf = getPulseLeaf();
            const defaultTitle = ((_b = (_a = pulseLeaf === null || pulseLeaf === void 0 ? void 0 : pulseLeaf.config) === null || _a === void 0 ? void 0 : _a.push) === null || _b === void 0 ? void 0 : _b.defaultNotificationTitle) || 'Notification';
            // Build notification data (same format as campaigns)
            let notificationData = {};
            if (url) {
                notificationData.location = 'ExternalLink';
                notificationData.url = url;
            }
            yield pulseLeaf.push().sendMultiple(tokens, {
                title: title || defaultTitle,
                body: message,
                data: notificationData
            });
            return { success: true, data: { sent_to: tokens.length } };
        })
    },
    'pulse:send-sms': {
        meta: {
            label: 'Send SMS',
            description: 'Send an SMS to this user',
            icon: 'message-square',
            color: 'primary',
            category: 'notifications',
            confirm: {
                title: 'Send SMS',
                message: 'Are you sure you want to send an SMS?',
                confirmText: 'Send',
                cancelText: 'Cancel'
            }
        },
        form: yup.object({
            message: yup.string().required().max(160).label('Message')
        }),
        handler: (record, data, _req, _context) => __awaiter(void 0, void 0, void 0, function* () {
            const phone = record.phone_number || record.phone || record.mobile;
            if (!phone) {
                return { success: false, error: 'No phone number found' };
            }
            const pulseLeaf = getPulseLeaf();
            const result = yield pulseLeaf.sms().send({ phone, message: data.message });
            return result.success
                ? { success: true, data: { sent: true, phone } }
                : { success: false, error: result.error };
        })
    },
    'pulse:send-email': {
        meta: {
            label: 'Send Email',
            description: 'Send an email to this user',
            icon: 'mail',
            color: 'primary',
            category: 'notifications',
            confirm: {
                title: 'Send Email',
                message: 'Are you sure you want to send an email?',
                confirmText: 'Send',
                cancelText: 'Cancel'
            }
        },
        form: yup.object({
            subject: yup.string().required().label('Subject'),
            body: yup.string().required().max(50000).label('Body')
        }),
        handler: (record, data, _req, _context) => __awaiter(void 0, void 0, void 0, function* () {
            const email = record.email;
            if (!email) {
                return { success: false, error: 'No email found' };
            }
            const pulseLeaf = getPulseLeaf();
            const result = yield pulseLeaf.email().sendTransactional({
                email,
                subject: data.subject,
                content: {
                    title: data.subject,
                    greeting: `Hello ${record.first_name || record.firstname || ''}`.trim(),
                    body: data.body
                }
            });
            return result.success
                ? { success: true, data: { sent: true, email } }
                : { success: false, error: result.error };
        })
    },
    'pulse:revoke-devices': {
        meta: {
            label: 'Revoke All Devices',
            description: 'Log out user from all devices',
            icon: 'shield-off',
            color: 'danger',
            category: 'security',
            confirm: {
                title: 'Revoke All Devices',
                message: 'This will log out the user from all devices. Are you sure?',
                confirmText: 'Revoke All',
                cancelText: 'Cancel'
            }
        },
        handler: (record, _data, _req, _context) => __awaiter(void 0, void 0, void 0, function* () {
            const { Device } = getModels();
            const [count] = yield Device.update({ status: false, push_token_status: DevicePushTokenStatus.DISABLED }, { where: { user_id: record.id } });
            return { success: true, data: { revoked_count: count } };
        })
    },
};
// ============================================
// HOOKS (Auto-triggered on CRUD)
// ============================================
export const pulseHooks = {
    'pulse:send-campaign': {
        collection: 'campaigns',
        description: 'Auto-send push notifications when campaign is created',
        afterCreate: (campaign, _req) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            try {
                const { message, url, data, target_logged_user, target_not_logged_user } = campaign;
                let notificationData = data || {};
                if (url) {
                    notificationData.location = 'ExternalLink';
                    notificationData.url = url;
                }
                const whereConditions = {
                    push_token_status: DevicePushTokenStatus.ENABLED,
                    status: true
                };
                if (target_logged_user && !target_not_logged_user) {
                    whereConditions.user_id = { [Op.ne]: null };
                }
                else if (!target_logged_user && target_not_logged_user) {
                    whereConditions.user_id = null;
                }
                const { Device } = getModels();
                const devices = yield Device.findAll({ where: whereConditions });
                yield campaign.update({ devices_count: devices.length });
                if (devices.length === 0) {
                    console.log('[pulse:send-campaign] No devices found');
                    return;
                }
                const tokens = devices.map(d => d.push_token).filter(Boolean);
                if (tokens.length > 0) {
                    const pulseLeaf = getPulseLeaf();
                    const defaultTitle = ((_b = (_a = pulseLeaf === null || pulseLeaf === void 0 ? void 0 : pulseLeaf.config) === null || _a === void 0 ? void 0 : _a.push) === null || _b === void 0 ? void 0 : _b.defaultNotificationTitle) || 'Notification';
                    yield pulseLeaf.push().sendMultiple(tokens, {
                        title: defaultTitle,
                        body: message,
                        data: notificationData
                    });
                    console.log(`[pulse:send-campaign] Sent to ${tokens.length} devices`);
                }
            }
            catch (error) {
                console.error('[pulse:send-campaign] Error:', error.message);
            }
        })
    }
};
export function registerPulseActions(registry) {
    for (const [name, action] of Object.entries(pulseActions)) {
        registry.register(name, action);
    }
    console.log('[ETHPulseLeaf] Actions:', Object.keys(pulseActions).join(', '));
}
export function registerPulseHooks(registry) {
    for (const [name, hook] of Object.entries(pulseHooks)) {
        registry.register(name, hook);
    }
    console.log('[ETHPulseLeaf] Hooks:', Object.keys(pulseHooks).join(', '));
}
export function registerPulseFeatures(actions, hooks) {
    registerPulseActions(actions);
    registerPulseHooks(hooks);
}
