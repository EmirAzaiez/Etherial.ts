import etherial from 'etherial'

import { Model } from 'etherial/components/database/provider'
import type { PushResult } from '../providers/push/index.js'

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

// Simplified result types to avoid import issues
export interface PulseResult {
    success: boolean
    error?: string
    messageId?: string
}

// Type for the mixin methods
export interface PulseUserMethods {
    /**
     * Send push notification to all user's devices
     * @param title - Notification title
     * @param body - Notification body
     * @param data - Optional data payload
     * @param providerName - Optional provider name (defaults to configured default)
     */
    sendPushNotification(params: { title: string, body: string, data?: Record<string, any> }, providerName?: string): Promise<PushResult[]>

    /**
     * Send SMS to user's phone number
     * Requires the user to have a 'phone' property
     * @param params - SMS parameters (message)
     * @param providerName - Optional provider name (defaults to configured default)
     */
    sendSms(params: { message: string }, providerName?: string): Promise<PulseResult>

    /**
     * Send transactional email to user
     * Requires the user to have an 'email' property
     * @param params - Email parameters (subject, content)
     * @param providerName - Optional provider name (defaults to configured default)
     */
    sendEmail(params: { subject: string; content: { title?: string; greeting?: string; body: string; footer?: string } }, providerName?: string): Promise<PulseResult>

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
    sendEmailFromTemplate(key: string, options?: { locale?: string; variables?: Record<string, string> }, providerName?: string): Promise<PulseResult>
}

// Type for classes that can receive the mixin
type Constructor<T = {}> = new (...args: any[]) => T

// Base interface that user models must have
interface UserLike {
    id?: number
    phone?: string
    email?: string
}

/**
 * Apply the Pulse mixin to a User model class
 * This adds sendPushNotification, sendSms, sendEmail, and sendEmailFromTemplate methods
 */
export function applyPulseMixin<TBase extends Constructor<Model<any> & UserLike>>(Base: TBase) {
    return class extends Base implements PulseUserMethods {
        /**
         * Send push notification to all user's devices
         */
        async sendPushNotification(
            params: {
                title?: string,
                body: string,
                data?: Record<string, any>,
            },
            providerName?: string
        ): Promise<PushResult[]> {
            // const etherial = (await import('etherial')).default as any

            const eth = etherial as any
            if (!eth.eth_pulse_leaf) {
                console.warn('[PulseMixin.sendPushNotification] ETHPulseLeaf is not configured')
                return []
            }

            const Device = etherial.database!.sequelize.models.Device as any

            const devices = await Device.findAll({
                where: {
                    user_id: this.id,
                    status: true,
                },
            })

            if (devices.length === 0) {
                return []
            }

            return eth.eth_pulse_leaf.push(providerName).sendToDevices(devices, {
                title: params.title || eth.eth_pulse_leaf.config.push.defaultNotificationTitle,
                body: params.body,
                data: params.data,
            })
        }

        /**
         * Send SMS to user's phone number
         */
        async sendSms(params: { message: string }, providerName?: string): Promise<PulseResult> {
            const etherial = (await import('etherial')).default as any

            if (!etherial.eth_pulse_leaf) {
                console.warn('[PulseMixin.sendSms] ETHPulseLeaf is not configured')
                return { success: false, error: 'ETHPulseLeaf not configured' }
            }

            if (!this.phone) {
                return { success: false, error: 'User has no phone number' }
            }

            return etherial.eth_pulse_leaf.sms(providerName).send({ phone: this.phone, message: params.message })
        }

        /**
         * Send transactional email to user
         */
        async sendEmail(
            params: {
                subject: string;
                content: { title?: string; greeting?: string; body: string; footer?: string }
            },
            providerName?: string
        ): Promise<PulseResult> {
            const etherial = (await import('etherial')).default as any

            if (!etherial.eth_pulse_leaf) {
                console.warn('[PulseMixin.sendEmail] ETHPulseLeaf is not configured')
                return { success: false, error: 'ETHPulseLeaf not configured' }
            }

            if (!this.email) {
                return { success: false, error: 'User has no email' }
            }

            return etherial.eth_pulse_leaf.email(providerName).sendTransactional({
                email: this.email,
                subject: params.subject,
                content: params.content
            })
        }

        /**
         * Send email using a database template
         * Auto-injects user email and merges user info into variables
         */
        async sendEmailFromTemplate(
            key: string,
            options?: {
                locale?: string
                variables?: Record<string, string>
            },
            providerName?: string
        ): Promise<PulseResult> {
            const etherial = (await import('etherial')).default as any

            if (!etherial.eth_pulse_leaf) {
                console.warn('[PulseMixin.sendEmailFromTemplate] ETHPulseLeaf is not configured')
                return { success: false, error: 'ETHPulseLeaf not configured' }
            }

            if (!this.email) {
                return { success: false, error: 'User has no email' }
            }

            const userVars: Record<string, string> = {
                firstname: (this as any).firstname || (this as any).first_name || '',
                lastname: (this as any).lastname || (this as any).last_name || '',
                email: this.email,
            }

            return etherial.eth_pulse_leaf.email(providerName).sendFromTemplate(key, {
                to: this.email,
                locale: options?.locale,
                variables: { ...userVars, ...options?.variables },
            })
        }
    }
}
