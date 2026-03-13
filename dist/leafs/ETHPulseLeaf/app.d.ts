import { Etherial } from 'etherial';
import { TwilioConfig } from './providers/sms/index.js';
import { NodemailerConfig } from './providers/email/index.js';
import { ExpoConfig } from './providers/push/index.js';
import { SmsService } from './services/sms.service.js';
import { EmailService } from './services/email.service.js';
import { PushService } from './services/push.service.js';
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
    private templateConfig;
    private routes;
    constructor(config: ETHPulseLeafConfig);
    /**
     * Lifecycle: beforeRun - Register models
     */
    /**
     * Lifecycle: run
     */
    run({ http }: Etherial): void;
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
}
export interface EmailProviderConfig {
    nodemailer?: NodemailerConfig;
}
export interface PushProviderConfig {
    expo?: ExpoConfig;
}
export declare const AvailableRouteMethods: {
    readonly devices: readonly ["registerDevice", "revokeDevice"];
};
export type DevicesMethods = (typeof AvailableRouteMethods.devices)[number];
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
    };
    push?: {
        default: keyof PushProviderConfig;
        defaultNotificationTitle?: string;
        providers: PushProviderConfig;
    };
    routes?: {
        devices?: DevicesMethods[];
    };
}
export { ISmsProvider, SmsResult, SmsOptions } from './providers/sms/index.js';
export { IEmailProvider, EmailResult, EmailOptions, TransactionalContent } from './providers/email/index.js';
export { IPushProvider, PushResult, PushMessage, PushOptions } from './providers/push/index.js';
export { TemplateConfig } from './templates/TemplateEngine.js';
export { MessageLog, MessageType, MessageStatus } from './models/MessageLog.js';
export { Device, DevicePlatform, DevicePushTokenType, DevicePushTokenStatus, DeviceAttributes } from './models/Device.js';
export { ETHPulseLeafNotificationBaseModel } from './models/Notification.js';
