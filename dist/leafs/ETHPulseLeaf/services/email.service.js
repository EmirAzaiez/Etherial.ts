var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { MessageLog, MessageType, MessageStatus } from '../models/MessageLog.js';
export class EmailService {
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
            throw new Error(`Email provider "${providerName}" not found. Available: ${Array.from(this.providers.keys()).join(', ')}`);
        }
        return provider;
    }
    /**
     * Send raw email using the default or specified provider
     */
    send(options, providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            const provider = this.provider(providerName);
            const result = yield provider.send(options);
            // Log the message
            const recipients = Array.isArray(options.to) ? options.to : [options.to];
            yield Promise.all(recipients.map(recipient => this.logMessage({
                provider: provider.name,
                recipient,
                subject: options.subject,
                status: result.success ? MessageStatus.SENT : MessageStatus.FAILED,
                externalId: result.messageId,
                errorMessage: result.error,
            })));
            return result;
        });
    }
    /**
     * Send transactional email with built-in template
     */
    sendTransactional(params, providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            const provider = this.provider(providerName);
            const result = yield provider.sendTransactional(params);
            // Log the message
            const recipients = Array.isArray(params.email) ? params.email : [params.email];
            yield Promise.all(recipients.map(recipient => this.logMessage({
                provider: provider.name,
                recipient,
                subject: params.subject,
                status: result.success ? MessageStatus.SENT : MessageStatus.FAILED,
                externalId: result.messageId,
                errorMessage: result.error,
                metadata: { type: 'transactional' },
            })));
            return result;
        });
    }
    /**
     * Log message to database
     */
    logMessage(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield MessageLog.logMessage(Object.assign({ type: MessageType.EMAIL }, data));
            }
            catch (error) {
                console.error('[EmailService] Failed to log message:', error);
            }
        });
    }
}
