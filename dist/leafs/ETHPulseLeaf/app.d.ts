import { Etherial } from 'etherial';
import { TwilioConfig, SaudiAlertConfig } from './providers/sms/index.js';
import { NodemailerConfig, GmailOAuthConfig } from './providers/email/index.js';
import { ExpoConfig } from './providers/push/index.js';
import { SmsService } from './services/sms.service.js';
import { EmailService } from './services/email.service.js';
import { PushService } from './services/push.service.js';
import { CommunicationsConfig, CommunicationSource } from './services/communications.js';
import { PulseTextsConfig } from './services/texts.js';
import { TemplateConfig } from './templates/TemplateEngine.js';
import { UnifonicConfig } from './providers/sms/UnifonicProvider.js';
/**
 * ETHPulseLeaf - Unified Messaging System
 *
 * Handles SMS, Email, and Push Notifications with a provider-based architecture.
 */
export default class ETHPulseLeaf {
    readonly etherial_module_name = "eth_pulse_leaf";
    private smsProviders;
    private emailProviders;
    private pushProviders;
    private _smsService?;
    private _emailService?;
    private _pushService?;
    config: ETHPulseLeafConfig;
    private routes;
    constructor(config: ETHPulseLeafConfig);
    /**
     * Lifecycle: beforeRun - the notification texts' table, before the project syncs.
     * The other models are the project's (it extends the base ones).
     */
    beforeRun({ database }: Etherial): void;
    /**
     * Lifecycle: run
     */
    run({ http }: Etherial): void;
    /**
     * Lifecycle: afterRun - tell the back-office where the timeline lives, once
     * the admin leaf is up (it may be declared after this one).
     */
    afterRun(): void;
    /**
     * A notification's text, as the back-office last wrote it in the person's
     * language, else the code's: `await pulse.text('appointment.confirmed', { user, data: { time } })`.
     */
    text(key: string, input?: {
        user?: any;
        locale?: string | null;
        data?: Record<string, unknown>;
    }): Promise<string>;
    /**
     * Add the project's own messages to a user's timeline: a campaign table,
     * a WhatsApp log… Each entry needs a channel, a date and an id.
     */
    registerCommunicationSource(name: string, source: CommunicationSource): void;
    /**
     * Get SMS service
     * @param providerName Optional provider name, uses default if not specified
     */
    sms(providerName?: string): SmsService;
    /**
     * Get Email service
     * @param providerName Optional provider name, uses default if not specified
     */
    email(providerName?: string): EmailService;
    /**
     * Get Push service
     * @param providerName Optional provider name, uses default if not specified
     */
    push(providerName?: string): PushService;
    /**
     * Available CLI commands
     */
    /**
     * Resolve the path to the bundled email templates shipped with the leaf
     */
    private getTemplatesSourcePath;
    /**
     * Recursively copy a directory
     */
    private copyDirSync;
    /**
     * Available CLI commands
     */
    commands(): ({
        command: string;
        description: string;
        action: () => Promise<{
            success: boolean;
            message: string;
        }>;
    } | {
        command: string;
        description: string;
        action: (to: string) => Promise<void>;
    })[];
}
export interface SmsProviderConfig {
    twilio?: TwilioConfig;
    unifonic?: UnifonicConfig;
    saudialert?: SaudiAlertConfig;
}
export interface EmailProviderConfig {
    nodemailer?: NodemailerConfig;
    gmail_oauth?: GmailOAuthConfig;
}
export interface PushProviderConfig {
    expo?: ExpoConfig;
}
export declare const AvailableRouteMethods: {
    readonly devices: readonly ["registerDevice", "revokeDevice"];
};
export type DevicesMethods = (typeof AvailableRouteMethods.devices)[number];
/**
 * Declares available email template keys and the variables they expect.
 */
export type EmailTemplateDefinitions = Record<string, string[]>;
/**
 * Email templates configuration.
 *
 * ```typescript
 * email: {
 *     templates: {
 *         locales: ['fr', 'en', 'ar'],
 *         emails: {
 *             password_reset: ['firstname', 'token', 'resetUrl'],
 *             email_verification: ['firstname', 'verifyUrl'],
 *             welcome: ['firstname'],
 *         }
 *     }
 * }
 * ```
 */
export interface EmailTemplatesConfig {
    /** Supported locales. First one is the default. */
    locales: string[];
    /** Declared email template keys and their expected variables */
    emails: EmailTemplateDefinitions;
}
export interface ETHPulseLeafConfig {
    last_app_build?: string;
    sms?: {
        default: keyof SmsProviderConfig;
        providers: SmsProviderConfig;
    };
    email?: {
        default: keyof EmailProviderConfig;
        providers: EmailProviderConfig;
        template: {
            path: string;
            config?: TemplateConfig;
        };
        templates?: EmailTemplatesConfig;
    };
    push?: {
        default: keyof PushProviderConfig;
        defaultNotificationTitle?: string;
        providers: PushProviderConfig;
    };
    routes?: {
        devices?: DevicesMethods[];
    };
    /**
     * The texts of the automatic notifications, in every language. The
     * back-office's Notification texts page rewrites them; `text(key)` reads
     * the one that goes out.
     */
    texts?: PulseTextsConfig;
    /**
     * Off by default. When on, every message sent is logged with its content
     * (codes and long tokens masked) and the back-office shows a timeline of a
     * user's push, SMS, email and inbox messages next to their devices.
     */
    communications?: boolean | CommunicationsConfig;
}
export { CommunicationsConfig, CommunicationSource, CommunicationEntry, CommunicationQuery } from './services/communications.js';
export { PulseTextsConfig, PulseTextDefinition, PulseTextVariable, PulseLocalized } from './services/texts.js';
export { PulseText } from './models/PulseText.js';
export { ISmsProvider, SmsResult, SmsOptions } from './providers/sms/index.js';
export { IEmailProvider, EmailResult, EmailOptions, TransactionalContent, GmailOAuthConfig } from './providers/email/index.js';
export { IPushProvider, PushResult, PushMessage, PushOptions } from './providers/push/index.js';
export { TemplateConfig } from './templates/TemplateEngine.js';
export { MessageLog, MessageType, MessageStatus } from './models/MessageLog.js';
export { Device, DevicePlatform, DevicePushTokenType, DevicePushTokenStatus, DeviceAttributes } from './models/Device.js';
export { ETHPulseLeafNotificationBaseModel } from './models/Notification.js';
export { BaseEmailTemplate, EmailTemplate, EmailTemplateAttributes } from './models/EmailTemplate.js';
export { registerPulseCollections } from './admin/features.js';
