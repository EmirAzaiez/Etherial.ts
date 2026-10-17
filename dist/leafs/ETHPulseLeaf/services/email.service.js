var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import { MessageType, MessageStatus } from '../models/MessageLog.js';
import { BaseEmailTemplate } from '../models/EmailTemplate.js';
import etherial from 'etherial';
const getModels = () => {
    const models = etherial.database.sequelize.models;
    return {
        MessageLog: models.MessageLog,
    };
};
/** The words of an HTML email, for the log: tags out, entities and blank runs collapsed. */
function htmlToText(html) {
    if (!html)
        return undefined;
    return html
        .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<br\s*\/?>|<\/(p|div|h\d|li|tr)>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/[ \t]+/g, ' ')
        .replace(/\s*\n\s*/g, '\n')
        .trim();
}
function transactionalText(content) {
    if (!content)
        return undefined;
    // The button's URL is left out: a reset or magic link carries its token.
    const parts = [content.title, content.greeting, content.body, content.buttonText, content.additionalContent];
    return htmlToText(parts.filter(Boolean).join('\n\n'));
}
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
            const { userId } = options, email = __rest(options, ["userId"]);
            const result = yield provider.send(email);
            // Log the message
            const recipients = Array.isArray(options.to) ? options.to : [options.to];
            yield Promise.all(recipients.map(recipient => this.logMessage({
                provider: provider.name,
                recipient,
                subject: options.subject,
                content: options.text || htmlToText(options.html),
                status: result.success ? MessageStatus.SENT : MessageStatus.FAILED,
                externalId: result.messageId,
                errorMessage: result.error,
                userId,
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
            const { userId } = params, email = __rest(params, ["userId"]);
            const result = yield provider.sendTransactional(email);
            // Log the message — cc/bcc recipients are deliberately not logged, so a
            // blind copy stays blind in the MessageLog too.
            const recipients = Array.isArray(params.email) ? params.email : [params.email];
            yield Promise.all(recipients.map(recipient => this.logMessage({
                provider: provider.name,
                recipient,
                subject: params.subject,
                content: transactionalText(params.content),
                status: result.success ? MessageStatus.SENT : MessageStatus.FAILED,
                externalId: result.messageId,
                errorMessage: result.error,
                metadata: { type: 'transactional' },
                userId,
            })));
            return result;
        });
    }
    /**
     * Send email using a template stored in the database.
     *
     * ```typescript
     * await emailService.sendFromTemplate('password_reset', {
     *     to: 'john@example.com',
     *     locale: 'fr',
     *     variables: { firstname: 'John', token: 'abc123', resetUrl: 'https://app.com/reset/abc123' }
     * })
     * ```
     */
    sendFromTemplate(key, params, providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            const locale = params.locale || 'en';
            const template = yield BaseEmailTemplate.findByKey(key, locale);
            if (!template) {
                const errorMsg = `Email template "${key}" not found for locale "${locale}"`;
                console.error(`[EmailService] ${errorMsg}`);
                return {
                    success: false,
                    error: errorMsg,
                    provider: providerName || this.defaultProvider,
                    timestamp: new Date(),
                };
            }
            const resolved = template.resolve(params.variables || {});
            return this.sendTransactional({
                email: params.to,
                userId: params.userId,
                subject: resolved.subject,
                content: {
                    title: resolved.title,
                    greeting: resolved.greeting,
                    body: resolved.body,
                    buttonText: resolved.buttonText,
                    buttonUrl: resolved.buttonUrl,
                    additionalContent: resolved.additionalContent,
                },
            }, providerName);
        });
    }
    /**
     * Log message to database
     */
    logMessage(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { MessageLog } = getModels();
                yield MessageLog.logMessage(Object.assign({ type: MessageType.EMAIL }, data));
            }
            catch (error) {
                console.error('[EmailService] Failed to log message:', error);
            }
        });
    }
}
