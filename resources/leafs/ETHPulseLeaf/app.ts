import { Etherial } from 'etherial'
import * as path from 'path'

// Providers
import { ISmsProvider, TwilioProvider, TwilioConfig } from './providers/sms'
import { IEmailProvider, NodemailerProvider, NodemailerConfig } from './providers/email'
import { IPushProvider, ExpoProvider, ExpoConfig } from './providers/push'

// Services
import { SmsService } from './services/sms.service'
import { EmailService } from './services/email.service'
import { PushService } from './services/push.service'

// Templates
import { TemplateConfig, defaultTemplateConfig } from './templates/TemplateEngine'

/**
 * ETHPulseLeaf - Unified Messaging System
 * 
 * Handles SMS, Email, and Push Notifications with a provider-based architecture.
 */
export default class ETHPulseLeaf {
    readonly etherial_module_name = 'eth_pulse_leaf'

    private smsProviders: Map<string, ISmsProvider> = new Map()
    private emailProviders: Map<string, IEmailProvider> = new Map()
    private pushProviders: Map<string, IPushProvider> = new Map()

    private _smsService?: SmsService
    private _emailService?: EmailService
    private _pushService?: PushService

    private config: ETHPulseLeafConfig
    private templateConfig: TemplateConfig
    private routes: { route: string; methods: string[] }[] = []

    constructor(config: ETHPulseLeafConfig) {
        this.config = config
        this.templateConfig = {
            ...defaultTemplateConfig,
            ...config.templates,
        }

        // Initialize SMS providers
        if (config.sms?.providers) {
            for (const [name, providerConfig] of Object.entries(config.sms.providers)) {
                if (name === 'twilio') {
                    this.smsProviders.set(name, new TwilioProvider(providerConfig as TwilioConfig))
                }
                // Add more SMS providers here as needed
            }
        }

        // Initialize Email providers
        if (config.email?.providers) {
            for (const [name, providerConfig] of Object.entries(config.email.providers)) {
                if (name === 'nodemailer') {
                    this.emailProviders.set(
                        name,
                        new NodemailerProvider(
                            providerConfig as NodemailerConfig,
                            this.templateConfig,
                            this.templateConfig.customTemplatesPath
                        )
                    )
                }
                // Add more Email providers here as needed
            }
        }

        // Initialize Push providers
        if (config.push?.providers) {
            for (const [name, providerConfig] of Object.entries(config.push.providers)) {
                if (name === 'expo') {
                    this.pushProviders.set(name, new ExpoProvider(providerConfig as ExpoConfig))
                }
                // Add more Push providers here as needed
            }
        }

        // Initialize services
        if (this.smsProviders.size > 0) {
            const defaultSmsProvider = config.sms?.default || this.smsProviders.keys().next().value
            this._smsService = new SmsService(this.smsProviders, defaultSmsProvider!)
        }

        if (this.emailProviders.size > 0) {
            const defaultEmailProvider = config.email?.default || this.emailProviders.keys().next().value
            this._emailService = new EmailService(this.emailProviders, defaultEmailProvider!)
        }

        if (this.pushProviders.size > 0) {
            const defaultPushProvider = config.push?.default || this.pushProviders.keys().next().value
            this._pushService = new PushService(this.pushProviders, defaultPushProvider!)
        }

        // Initialize device routes
        if (config.routes?.devices && config.routes.devices.length > 0) {
            this.routes.push({ route: path.join(__dirname, 'routes/devices'), methods: config.routes.devices })
        }
    }

    /**
     * Lifecycle: beforeRun - Register models
     */
    beforeRun({ database }: Etherial) {
        database?.addModels([
            path.join(__dirname, 'models/MessageLog.js'),
            path.join(__dirname, 'models/Device.js'),
        ])
    }

    /**
     * Lifecycle: run
     */
    run({ http }: Etherial) {
        console.log('[ETHPulseLeaf] Initialized with providers:')
        console.log(`  SMS: ${Array.from(this.smsProviders.keys()).join(', ') || 'none'}`)
        console.log(`  Email: ${Array.from(this.emailProviders.keys()).join(', ') || 'none'}`)
        console.log(`  Push: ${Array.from(this.pushProviders.keys()).join(', ') || 'none'}`)

        // Register device routes
        if (this.routes.length > 0) {
            http.routes_leafs.push(...this.routes)
        }
    }

    /**
     * Get SMS service
     * @param providerName Optional provider name, uses default if not specified
     */
    sms(providerName?: string): SmsService {
        if (!this._smsService) {
            throw new Error('[ETHPulseLeaf] No SMS providers configured')
        }

        // If a specific provider is requested, validate it exists
        if (providerName) {
            const provider = this.smsProviders.get(providerName)
            if (!provider) {
                throw new Error(`[ETHPulseLeaf] SMS provider "${providerName}" not found. Available: ${Array.from(this.smsProviders.keys()).join(', ')}`)
            }
        }

        return this._smsService
    }

    /**
     * Get Email service
     * @param providerName Optional provider name, uses default if not specified
     */
    email(providerName?: string): EmailService {
        if (!this._emailService) {
            throw new Error('[ETHPulseLeaf] No Email providers configured')
        }

        // If a specific provider is requested, validate it exists
        if (providerName) {
            const provider = this.emailProviders.get(providerName)
            if (!provider) {
                throw new Error(`[ETHPulseLeaf] Email provider "${providerName}" not found. Available: ${Array.from(this.emailProviders.keys()).join(', ')}`)
            }
        }

        return this._emailService
    }

    /**
     * Get Push service
     * @param providerName Optional provider name, uses default if not specified
     */
    push(providerName?: string): PushService {
        if (!this._pushService) {
            throw new Error('[ETHPulseLeaf] No Push providers configured')
        }

        // If a specific provider is requested, validate it exists
        if (providerName) {
            const provider = this.pushProviders.get(providerName)
            if (!provider) {
                throw new Error(`[ETHPulseLeaf] Push provider "${providerName}" not found. Available: ${Array.from(this.pushProviders.keys()).join(', ')}`)
            }
        }

        return this._pushService
    }

    /**
     * Available CLI commands
     */
    commands() {
        return [
            {
                command: 'test-email',
                description: 'Send a test email to verify configuration',
                action: async (to: string) => {
                    if (!to) {
                        console.error('Usage: eth_pulse_leaf:test-email <email>')
                        return
                    }

                    try {
                        const result = await this.email().sendTransactional(
                            to,
                            'Test Email from ETHPulseLeaf',
                            {
                                title: 'Test Email',
                                greeting: 'Hello!',
                                body: '<p>This is a test email from ETHPulseLeaf.</p><p>If you received this, your email configuration is working correctly!</p>',
                                footer: 'This is an automated test email.',
                            }
                        )

                        if (result.success) {
                            console.log(`✅ Test email sent successfully to ${to}`)
                        } else {
                            console.error(`❌ Failed to send test email: ${result.error}`)
                        }
                    } catch (error: any) {
                        console.error(`❌ Error: ${error.message}`)
                    }
                },
            },
            {
                command: 'test-sms',
                description: 'Send a test SMS to verify configuration',
                action: async (to: string) => {
                    if (!to) {
                        console.error('Usage: eth_pulse_leaf:test-sms <phone>')
                        return
                    }

                    try {
                        const result = await this.sms().send(
                            to,
                            'Test SMS from ETHPulseLeaf. Your configuration is working!'
                        )

                        if (result.success) {
                            console.log(`✅ Test SMS sent successfully to ${to}`)
                        } else {
                            console.error(`❌ Failed to send test SMS: ${result.error}`)
                        }
                    } catch (error: any) {
                        console.error(`❌ Error: ${error.message}`)
                    }
                },
            },
            {
                command: 'test-push',
                description: 'Send a test push notification to verify configuration',
                action: async (token: string) => {
                    if (!token) {
                        console.error('Usage: eth_pulse_leaf:test-push <expo_push_token>')
                        return
                    }

                    try {
                        const result = await this.push().send(token, {
                            title: 'Test Push',
                            body: 'Test push notification from ETHPulseLeaf. Your configuration is working!',
                        })

                        if (result.success) {
                            console.log(`✅ Test push sent successfully`)
                        } else {
                            console.error(`❌ Failed to send test push: ${result.error}`)
                        }
                    } catch (error: any) {
                        console.error(`❌ Error: ${error.message}`)
                    }
                },
            },
        ]
    }
}

// ============================================
// Configuration Types
// ============================================

export interface SmsProviderConfig {
    twilio?: TwilioConfig
    // Add more SMS providers here
}

export interface EmailProviderConfig {
    nodemailer?: NodemailerConfig
    // Add more Email providers here
}

export interface PushProviderConfig {
    expo?: ExpoConfig
    // Add more Push providers here
}

export const AvailableRouteMethods = {
    devices: ['registerDevice', 'revokeDevice'],
} as const

export type DevicesMethods = (typeof AvailableRouteMethods.devices)[number]

export interface ETHPulseLeafConfig {
    sms?: {
        default: keyof SmsProviderConfig
        providers: SmsProviderConfig
    }
    email?: {
        default: keyof EmailProviderConfig
        providers: EmailProviderConfig
    }
    push?: {
        default: keyof PushProviderConfig
        providers: PushProviderConfig
    }
    routes?: {
        devices?: DevicesMethods[]
    }
    templates?: TemplateConfig
}

// Re-export types for external use
export { ISmsProvider, SmsResult, SmsOptions } from './providers/sms'
export { IEmailProvider, EmailResult, EmailOptions, TransactionalContent } from './providers/email'
export { IPushProvider, PushResult, PushMessage, PushOptions } from './providers/push'
export { TemplateConfig } from './templates/TemplateEngine'
export { MessageLog, MessageType, MessageStatus } from './models/MessageLog'
export { Device, DevicePlatform, DevicePushTokenType, DevicePushTokenStatus, DeviceAttributes } from './models/Device'
export { ETHPulseLeafNotificationBaseModel } from './models/Notification'
