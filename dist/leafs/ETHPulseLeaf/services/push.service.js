var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { MessageLog, MessageType, MessageStatus } from '../models/MessageLog';
export class PushService {
    constructor(providers, defaultProvider) {
        this.providers = new Map();
        this.providers = providers;
        this.defaultProvider = defaultProvider;
    }
    /**
     * Get a specific provider or the default one
     */
    provider(name) {
        const providerName = name || this.defaultProvider;
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error(`Push provider "${providerName}" not found. Available: ${Array.from(this.providers.keys()).join(', ')}`);
        }
        return provider;
    }
    /**
     * Send push notification to a single device
     */
    send(pushToken, message, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const provider = this.provider(options === null || options === void 0 ? void 0 : options.providerName);
            const result = yield provider.send(pushToken, message, options);
            yield this.logMessage({
                provider: provider.name,
                recipient: pushToken,
                subject: message.title,
                content: message.body,
                status: result.success ? MessageStatus.SENT : MessageStatus.FAILED,
                externalId: result.ticketId,
                errorMessage: result.error,
                userId: options === null || options === void 0 ? void 0 : options.userId,
            });
            return result;
        });
    }
    /**
     * Send push notification to multiple devices
     */
    sendMultiple(pushTokens, message, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const provider = this.provider(options === null || options === void 0 ? void 0 : options.providerName);
            const results = yield provider.sendMultiple(pushTokens, message, options);
            // Log each message
            yield Promise.all(results.map((result, index) => {
                var _a;
                return this.logMessage({
                    provider: provider.name,
                    recipient: pushTokens[index],
                    subject: message.title,
                    content: message.body,
                    status: result.success ? MessageStatus.SENT : MessageStatus.FAILED,
                    externalId: result.ticketId,
                    errorMessage: result.error,
                    userId: (_a = options === null || options === void 0 ? void 0 : options.userIds) === null || _a === void 0 ? void 0 : _a[index],
                });
            }));
            return results;
        });
    }
    /**
     * Send push notification to a Device model instance
     */
    sendToDevice(device, message, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!device.push_token) {
                return { success: false, error: 'Device has no push token' };
            }
            return this.send(device.push_token, message, Object.assign(Object.assign({}, options), { userId: device.user_id }));
        });
    }
    /**
     * Send push notification to multiple Device model instances
     */
    sendToDevices(devices, message, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const validDevices = devices.filter(d => d.push_token);
            if (validDevices.length === 0) {
                return devices.map(() => ({ success: false, error: 'Device has no push token' }));
            }
            return this.sendMultiple(validDevices.map(d => d.push_token), message, Object.assign(Object.assign({}, options), { userIds: validDevices.map(d => d.user_id) }));
        });
    }
    /**
     * Log message to database
     */
    logMessage(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield MessageLog.logMessage(Object.assign({ type: MessageType.PUSH }, data));
            }
            catch (error) {
                console.error('[PushService] Failed to log message:', error);
            }
        });
    }
}
