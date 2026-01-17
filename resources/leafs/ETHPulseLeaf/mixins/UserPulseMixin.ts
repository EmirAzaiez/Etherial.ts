import { Model } from 'etherial/components/database/provider'
import type { PushResult } from '../providers/push'

/**
 * ETHPulseLeaf User Mixin
 * 
 * This mixin provides messaging methods (push, sms, email) to any User model.
 * 
 * Usage in your project's User.ts:
 * ```typescript
 * import { UserLeafBase } from './ETHUserLeaf/models/User'
 * import { applyPulseMixin, PulseUserMethods } from './ETHPulseLeaf/mixins/UserPulseMixin'
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
    sendPushNotification(title: string, body: string, data?: Record<string, any>, providerName?: string): Promise<PushResult[]>

    /**
     * Send SMS to user's phone number
     * Requires the user to have a 'phone' property
     * @param message - SMS message content
     * @param providerName - Optional provider name (defaults to configured default)
     */
    sendSms(message: string, providerName?: string): Promise<PulseResult>

    /**
     * Send transactional email to user
     * Requires the user to have an 'email' property
     * @param subject - Email subject
     * @param content - Transactional email content (title, greeting, body, footer, etc.)
     * @param providerName - Optional provider name (defaults to configured default)
     */
    sendEmail(subject: string, content: { title?: string; greeting?: string; body: string; footer?: string }, providerName?: string): Promise<PulseResult>
}

// Type for classes that can receive the mixin
type Constructor<T = {}> = new (...args: any[]) => T

// Base interface that user models must have
interface UserLike {
    id: number
    phone?: string
    email?: string
}

/**
 * Apply the Pulse mixin to a User model class
 * This adds sendPushNotification, sendSms, and sendEmail methods
 */
export function applyPulseMixin<TBase extends Constructor<Model<any> & UserLike>>(Base: TBase) {
    return class extends Base implements PulseUserMethods {
        /**
         * Send push notification to all user's devices
         */
        async sendPushNotification(
            title: string,
            body: string,
            data?: Record<string, any>,
            providerName?: string
        ): Promise<PushResult[]> {
            const etherial = (await import('etherial')).default as any

            if (!etherial.eth_pulse_leaf) {
                console.warn('[PulseMixin.sendPushNotification] ETHPulseLeaf is not configured')
                return []
            }

            // @ts-ignore - Runtime import
            const { Device } = await import('../models/Device.js')

            const devices = await Device.findAll({
                where: {
                    user_id: this.id,
                    status: true,
                },
            })

            if (devices.length === 0) {
                return []
            }

            return etherial.eth_pulse_leaf.push(providerName).sendToDevices(devices, {
                title,
                body,
                data,
            })
        }

        /**
         * Send SMS to user's phone number
         */
        async sendSms(message: string, providerName?: string): Promise<PulseResult> {
            const etherial = (await import('etherial')).default as any

            if (!etherial.eth_pulse_leaf) {
                console.warn('[PulseMixin.sendSms] ETHPulseLeaf is not configured')
                return { success: false, error: 'ETHPulseLeaf not configured' }
            }

            if (!this.phone) {
                return { success: false, error: 'User has no phone number' }
            }

            return etherial.eth_pulse_leaf.sms(providerName).send(this.phone, message)
        }

        /**
         * Send transactional email to user
         */
        async sendEmail(
            subject: string,
            content: { title?: string; greeting?: string; body: string; footer?: string },
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

            return etherial.eth_pulse_leaf.email(providerName).sendTransactional(
                this.email,
                subject,
                content
            )
        }
    }
}
