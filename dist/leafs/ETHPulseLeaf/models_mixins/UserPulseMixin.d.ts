import { Model } from 'etherial/components/database/provider';
import type { PushResult } from '../providers/push/index.js';
/**
 * ETHPulseLeaf User Mixin
 *
 * This mixin provides messaging methods (push, sms, email) to any User model.
 *
 * Usage in your project's User.ts:
 * ```typescript
 * import { UserLeafBase } from './ETHUserLeaf/models/User.js'
 * import { applyPulseMixin, PulseUserMethods } from './ETHPulseLeaf/models_mixins/UserPulseMixin.js'
 *
 * @Table({ tableName: 'users' })
 * export class User extends applyPulseMixin(UserLeafBase) {
 *     // Your custom fields and methods
 * }
 * ```
 *
 * Then you can use:
 * ```typescript
 * await user.sendPushNotification('Hello', 'World')
 * await user.sendSms('Your code is 1234')
 * await user.sendEmail('Welcome!', { title: 'Welcome', body: '<p>Hi!</p>' })
 * await user.sendEmailFromTemplate('password_reset', { locale: 'fr', variables: { token: '...' } })
 * ```
 */
export interface PulseResult {
    success: boolean;
    error?: string;
    messageId?: string;
}
export interface PulseUserMethods {
    /**
     * Send push notification to all user's devices
     * @param title - Notification title
     * @param body - Notification body
     * @param data - Optional data payload
     * @param providerName - Optional provider name (defaults to configured default)
     */
    sendPushNotification(params: {
        title: string;
        body: string;
        data?: Record<string, any>;
    }, providerName?: string): Promise<PushResult[]>;
    /**
     * Send SMS to user's phone number
     * Requires the user to have a 'phone' property
     * @param params - SMS parameters (message)
     * @param providerName - Optional provider name (defaults to configured default)
     */
    sendSms(params: {
        message: string;
    }, providerName?: string): Promise<PulseResult>;
    /**
     * Send transactional email to user
     * Requires the user to have an 'email' property
     * @param params - Email parameters (subject, content)
     * @param providerName - Optional provider name (defaults to configured default)
     */
    sendEmail(params: {
        subject: string;
        content: {
            title?: string;
            greeting?: string;
            body: string;
            footer?: string;
        };
    }, providerName?: string): Promise<PulseResult>;
    /**
     * Send email using a database template
     * Auto-injects user's email and basic variables (firstname, lastname, email)
     *
     * ```typescript
     * await user.sendEmailFromTemplate('password_reset', {
     *     locale: 'fr',
     *     variables: { token: resetToken, resetUrl: 'https://app.com/reset' }
     * })
     * ```
     */
    sendEmailFromTemplate(key: string, options?: {
        locale?: string;
        variables?: Record<string, string>;
    }, providerName?: string): Promise<PulseResult>;
}
type Constructor<T = {}> = new (...args: any[]) => T;
interface UserLike {
    id?: number;
    phone?: string;
    email?: string;
}
/**
 * Apply the Pulse mixin to a User model class
 * This adds sendPushNotification, sendSms, sendEmail, and sendEmailFromTemplate methods
 */
export declare function applyPulseMixin<TBase extends Constructor<Model<any> & UserLike>>(Base: TBase): {
    new (...args: any[]): {
        /**
         * Send push notification to all user's devices
         */
        sendPushNotification(params: {
            title?: string;
            body: string;
            data?: Record<string, any>;
        }, providerName?: string): Promise<PushResult[]>;
        /**
         * Send SMS to user's phone number
         */
        sendSms(params: {
            message: string;
        }, providerName?: string): Promise<PulseResult>;
        /**
         * Send transactional email to user
         */
        sendEmail(params: {
            subject: string;
            content: {
                title?: string;
                greeting?: string;
                body: string;
                footer?: string;
            };
        }, providerName?: string): Promise<PulseResult>;
        /**
         * Send email using a database template
         * Auto-injects user email and merges user info into variables
         */
        sendEmailFromTemplate(key: string, options?: {
            locale?: string;
            variables?: Record<string, string>;
        }, providerName?: string): Promise<PulseResult>;
    };
} & TBase;
export {};
