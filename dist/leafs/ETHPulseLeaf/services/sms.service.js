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
export class SmsService {
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
            throw new Error(`SMS provider "${providerName}" not found. Available: ${Array.from(this.providers.keys()).join(', ')}`);
        }
        return provider;
    }
    /**
     * Send SMS using the default or specified provider
     */
    send(params, providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            const provider = this.provider(providerName);
            const result = yield provider.send(params);
            // Log the message
            yield this.logMessage({
                provider: provider.name,
                recipient: params.phone,
                status: result.success ? MessageStatus.SENT : MessageStatus.FAILED,
                externalId: result.messageId,
                errorMessage: result.error,
            });
            return result;
        });
    }
    /**
     * Send SMS to multiple recipients
     */
    sendBulk(recipients, message, providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            const provider = this.provider(providerName);
            const results = yield provider.sendBulk(recipients, message);
            // Log each message
            yield Promise.all(results.map((result, index) => this.logMessage({
                provider: provider.name,
                recipient: recipients[index],
                status: result.success ? MessageStatus.SENT : MessageStatus.FAILED,
                externalId: result.messageId,
                errorMessage: result.error,
            })));
            return results;
        });
    }
    /**
     * Send verification code SMS
     */
    sendVerificationCode(to, code, providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            const message = `Your verification code is: ${code}`;
            return this.send({ phone: to, message }, providerName);
        });
    }
    /**
     * Log message to database
     */
    logMessage(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield MessageLog.logMessage(Object.assign({ type: MessageType.SMS }, data));
            }
            catch (error) {
                console.error('[SmsService] Failed to log message:', error);
            }
        });
    }
}
