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
/**
 * Apply the Pulse mixin to a User model class
 * This adds sendPushNotification, sendSms, sendEmail, and sendEmailFromTemplate methods
 */
export function applyPulseMixin(Base) {
    return class extends Base {
        /**
         * Send push notification to all user's devices
         */
        sendPushNotification(params, providerName) {
            return __awaiter(this, void 0, void 0, function* () {
                // const etherial = (await import('etherial')).default as any
                const eth = etherial;
                if (!eth.eth_pulse_leaf) {
                    console.warn('[PulseMixin.sendPushNotification] ETHPulseLeaf is not configured');
                    return [];
                }
                const Device = etherial.database.sequelize.models.Device;
                const devices = yield Device.findAll({
                    where: {
                        user_id: this.id,
                        status: true,
                    },
                });
                if (devices.length === 0) {
                    return [];
                }
                return eth.eth_pulse_leaf.push(providerName).sendToDevices(devices, {
                    title: params.title || eth.eth_pulse_leaf.config.push.defaultNotificationTitle,
                    body: params.body,
                    data: params.data,
                });
            });
        }
        /**
         * Send SMS to user's phone number
         */
        sendSms(params, providerName) {
            return __awaiter(this, void 0, void 0, function* () {
                const etherial = (yield import('etherial')).default;
                if (!etherial.eth_pulse_leaf) {
                    console.warn('[PulseMixin.sendSms] ETHPulseLeaf is not configured');
                    return { success: false, error: 'ETHPulseLeaf not configured' };
                }
                if (!this.phone) {
                    return { success: false, error: 'User has no phone number' };
                }
                return etherial.eth_pulse_leaf.sms(providerName).send({ phone: this.phone, message: params.message });
            });
        }
        /**
         * Send transactional email to user
         */
        sendEmail(params, providerName) {
            return __awaiter(this, void 0, void 0, function* () {
                const etherial = (yield import('etherial')).default;
                if (!etherial.eth_pulse_leaf) {
                    console.warn('[PulseMixin.sendEmail] ETHPulseLeaf is not configured');
                    return { success: false, error: 'ETHPulseLeaf not configured' };
                }
                if (!this.email) {
                    return { success: false, error: 'User has no email' };
                }
                return etherial.eth_pulse_leaf.email(providerName).sendTransactional({
                    email: this.email,
                    subject: params.subject,
                    content: params.content
                });
            });
        }
        /**
         * Send email using a database template
         * Auto-injects user email and merges user info into variables
         */
        sendEmailFromTemplate(key, options, providerName) {
            return __awaiter(this, void 0, void 0, function* () {
                const etherial = (yield import('etherial')).default;
                if (!etherial.eth_pulse_leaf) {
                    console.warn('[PulseMixin.sendEmailFromTemplate] ETHPulseLeaf is not configured');
                    return { success: false, error: 'ETHPulseLeaf not configured' };
                }
                if (!this.email) {
                    return { success: false, error: 'User has no email' };
                }
                const userVars = {
                    firstname: this.firstname || this.first_name || '',
                    lastname: this.lastname || this.last_name || '',
                    email: this.email,
                };
                return etherial.eth_pulse_leaf.email(providerName).sendFromTemplate(key, {
                    to: this.email,
                    locale: options === null || options === void 0 ? void 0 : options.locale,
                    variables: Object.assign(Object.assign({}, userVars), options === null || options === void 0 ? void 0 : options.variables),
                });
            });
        }
    };
}
