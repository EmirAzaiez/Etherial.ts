import { Etherial } from 'etherial'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Providers
import { ISmsProvider, TwilioProvider, TwilioConfig } from './providers/sms/index.js'
import { IEmailProvider, NodemailerProvider, NodemailerConfig, GmailOAuthProvider, GmailOAuthConfig } from './providers/email/index.js'
import { IPushProvider, ExpoProvider, ExpoConfig } from './providers/push/index.js'

// Services
import { SmsService } from './services/sms.service.js'
import { EmailService } from './services/email.service.js'
import { PushService } from './services/push.service.js'

// Seeds
import { getDefaultContent } from './seeds/email-template-defaults.js'

// Templates
import { TemplateConfig, defaultTemplateConfig } from './templates/TemplateEngine.js'
import { UnifonicConfig, UnifonicProvider } from './providers/sms/UnifonicProvider.js'

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

    public config: ETHPulseLeafConfig
    private routes: { route: string; methods: string[] }[] = []

    constructor(config: ETHPulseLeafConfig) {

        this.config = config

        // Initialize SMS providers
        if (config.sms?.providers) {
            for (const [name, providerConfig] of Object.entries(config.sms.providers)) {
                if (name === 'twilio') {
                    this.smsProviders.set(name, new TwilioProvider(providerConfig as TwilioConfig))
                }
                if (name === 'unifonic') {
                    this.smsProviders.set(name, new UnifonicProvider(providerConfig as UnifonicConfig))
                }
                // Add more SMS providers here as needed
            }
        }

        // Initialize Email providers
        if (config.email?.providers) {
            if (!config.email.template?.path) {
                throw new Error(
                    `[ETHPulseLeaf] email.template.path is required when email providers are configured. ` +
                    `Run 'etherial cmd eth_pulse_leaf:install-templates' to set up email templates, ` +
                    `then set email.template.path to the templates directory (e.g., path.join(process.cwd(), 'resources/emails')).`
                )
            }

            if (!fs.existsSync(config.email.template.path)) {
                throw new Error(
                    `[ETHPulseLeaf] Email template path does not exist: ${config.email.template.path}. ` +
                    `Run 'etherial cmd eth_pulse_leaf:install-templates' to copy default templates to your project.`
                )
            }

            for (const [name, providerConfig] of Object.entries(config.email.providers)) {
                if (name === 'nodemailer') {
                    this.emailProviders.set(
                        name,
                        new NodemailerProvider(
                            providerConfig as NodemailerConfig,
                            config.email.template
                        )
                    )
                } else if (name === 'gmail_oauth') {
                    this.emailProviders.set(
                        name,
                        new GmailOAuthProvider(
                            providerConfig as GmailOAuthConfig,
                            config.email.template
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

        // Register email template sync route (always available when templates are configured)
        if (config.email?.templates) {
            this.routes.push({
                route: path.join(__dirname, 'routes/email-templates-sync'),
                methods: ['getSync', 'createMissing', 'removeOrphan'],
            })
        }
    }

    /**
     * Lifecycle: beforeRun - Register models
     */
    // beforeRun({ database }: Etherial) {
    //     database?.addModels([
    //         path.join(__dirname, 'models/MessageLog.js'),
    //         path.join(__dirname, 'models/Device.js'),
    //     ])
    // }

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
    /**
     * Resolve the path to the bundled email templates shipped with the leaf
     */
    private getTemplatesSourcePath(): string {
        // From dist/leafs/ETHPulseLeaf/ -> root/resources/leafs/ETHPulseLeaf/templates
        return path.resolve(__dirname, '..', '..', '..', 'resources', 'leafs', 'ETHPulseLeaf', 'templates')
    }

    /**
     * Recursively copy a directory
     */
    private copyDirSync(src: string, dest: string): void {
        fs.mkdirSync(dest, { recursive: true })

        for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
            const srcPath = path.join(src, entry.name)
            const destPath = path.join(dest, entry.name)

            if (entry.isDirectory()) {
                this.copyDirSync(srcPath, destPath)
            } else {
                fs.copyFileSync(srcPath, destPath)
            }
        }
    }

    /**
     * Available CLI commands
     */
    commands() {
        return [
            {
                command: 'install-templates',
                description: 'Install email templates: copy EJS files + seed database with declared templates for all configured locales',
                action: async () => {
                    // ── Step 1: Copy EJS template files ──
                    const sourceDir = this.getTemplatesSourcePath()
                    const targetDir = path.join(process.cwd(), 'resources', 'emails')

                    if (!fs.existsSync(sourceDir)) {
                        console.error(`[ETHPulseLeaf] Source templates not found at: ${sourceDir}`)
                        return { success: false, message: 'Source templates not found' }
                    }

                    if (fs.existsSync(targetDir)) {
                        console.log(`[ETHPulseLeaf] Templates directory already exists — overwriting...`)
                    }

                    this.copyDirSync(sourceDir, targetDir)

                    const files: string[] = []
                    const listFiles = (dir: string, prefix = '') => {
                        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                            const rel = prefix ? `${prefix}/${entry.name}` : entry.name
                            if (entry.isDirectory()) {
                                listFiles(path.join(dir, entry.name), rel)
                            } else {
                                files.push(rel)
                            }
                        }
                    }
                    listFiles(targetDir)

                    console.log(`[ETHPulseLeaf] EJS templates installed to: ${targetDir}`)
                    for (const f of files) {
                        console.log(`    ${f}`)
                    }

                    // ── Step 2: Seed database with email templates ──
                    const templatesConfig = this.config.email?.templates
                    if (!templatesConfig || Object.keys(templatesConfig.emails).length === 0) {
                        console.log('\n[ETHPulseLeaf] No email templates declared in config — skipping database seed.')
                        console.log('  Set your config: email.template.path = path.join(process.cwd(), \'resources/emails\')')
                        return { success: true, message: `Installed ${files.length} template files (no DB seed)` }
                    }

                    const etherial_import = (await import('etherial')).default
                    const EmailTemplate = etherial_import.database?.sequelize.models.EmailTemplate as any

                    if (!EmailTemplate) {
                        console.log('\n[ETHPulseLeaf] EmailTemplate model not found — skipping database seed.')
                        console.log('  Make sure you have an EmailTemplate model extending BaseEmailTemplate.')
                        return { success: true, message: `Installed ${files.length} template files (no DB seed)` }
                    }

                    const locales = templatesConfig.locales
                    const keys = Object.keys(templatesConfig.emails)
                    let created = 0
                    let skipped = 0

                    console.log(`\n[ETHPulseLeaf] Seeding email templates (${locales.join(', ')})...\n`)

                    for (const key of keys) {
                        const expectedVars = templatesConfig.emails[key]

                        for (const locale of locales) {
                            const existing = await EmailTemplate.findOne({ where: { key, locale } })
                            if (existing) {
                                console.log(`  [skip] ${key} (${locale}) — already exists`)
                                skipped++
                                continue
                            }

                            const content = getDefaultContent(key, locale)

                            await EmailTemplate.create({
                                key,
                                locale,
                                subject: content.subject,
                                title: content.title || null,
                                greeting: content.greeting || null,
                                body: content.body,
                                button_text: content.button_text || null,
                                button_url: content.button_url || null,
                                footer: content.footer || null,
                                enabled: true,
                            })

                            console.log(`  [created] ${key} (${locale})`)
                            if (expectedVars.length > 0) {
                                console.log(`            variables: {{${expectedVars.join('}}, {{')}}}`)
                            }
                            created++
                        }
                    }

                    console.log(`\n[ETHPulseLeaf] Done: ${files.length} files, ${created} templates created, ${skipped} skipped`)
                    console.log(`  Customize content from the admin panel (Email Templates) or directly in the database.`)

                    return { success: true, message: `${files.length} files, ${created} created, ${skipped} skipped` }
                },
            },
            {
                command: 'test-email',
                description: 'Send a test email to verify configuration',
                action: async (to: string) => {
                    if (!to) {
                        console.error('Usage: eth_pulse_leaf:test-email <email>')
                        return
                    }

                    try {
                        const result = await this.email().sendTransactional({
                            email: to,
                            subject: 'Test Email from ETHPulseLeaf',
                            content: {
                                title: 'Test Email',
                                greeting: 'Hello!',
                                body: '<p>This is a test email from ETHPulseLeaf.</p><p>If you received this, your email configuration is working correctly!</p>',
                            }
                        })

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
                        const result = await this.sms().send({
                            phone: to,
                            message: 'Test SMS from ETHPulseLeaf. Your configuration is working!'
                        })

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
    unifonic?: UnifonicConfig
    // Add more SMS providers here
}

export interface EmailProviderConfig {
    nodemailer?: NodemailerConfig
    gmail_oauth?: GmailOAuthConfig
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

/**
 * Declares available email template keys and the variables they expect.
 */
export type EmailTemplateDefinitions = Record<string, string[]>

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
    locales: string[]
    /** Declared email template keys and their expected variables */
    emails: EmailTemplateDefinitions
}

export interface ETHPulseLeafConfig {
    last_app_build?: string
    sms?: {
        default: keyof SmsProviderConfig
        providers: SmsProviderConfig
    }
    email?: {
        default: keyof EmailProviderConfig
        providers: EmailProviderConfig
        template: {
            path: string
            config?: TemplateConfig
        }
        templates?: EmailTemplatesConfig
    }
    push?: {
        default: keyof PushProviderConfig
        defaultNotificationTitle?: string
        providers: PushProviderConfig
    }
    routes?: {
        devices?: DevicesMethods[]
    }
}

// Re-export types for external use
export { ISmsProvider, SmsResult, SmsOptions } from './providers/sms/index.js'
export { IEmailProvider, EmailResult, EmailOptions, TransactionalContent, GmailOAuthConfig } from './providers/email/index.js'
export { IPushProvider, PushResult, PushMessage, PushOptions } from './providers/push/index.js'
export { TemplateConfig } from './templates/TemplateEngine.js'
export { MessageLog, MessageType, MessageStatus } from './models/MessageLog.js'
export { Device, DevicePlatform, DevicePushTokenType, DevicePushTokenStatus, DeviceAttributes } from './models/Device.js'
export { ETHPulseLeafNotificationBaseModel } from './models/Notification.js'
export { BaseEmailTemplate, EmailTemplate, EmailTemplateAttributes } from './models/EmailTemplate.js'
export { registerPulseCollections } from './admin/features.js'
