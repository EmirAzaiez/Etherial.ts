import {
    IEmailProvider,
    EmailResult,
    EmailOptions,
    TransactionalContent,
    TemplateEmailOptions
} from '../providers/email/IEmailProvider'
import { MessageLog, MessageType, MessageStatus } from '../models/MessageLog'

export class EmailService {
    private providers: Map<string, IEmailProvider> = new Map()
    private defaultProvider: string

    constructor(providers: Map<string, IEmailProvider>, defaultProvider: string) {
        this.providers = providers
        this.defaultProvider = defaultProvider
    }

    /**
     * Get a specific provider or the default one
     */
    provider(name?: string): IEmailProvider {
        const providerName = name || this.defaultProvider
        const provider = this.providers.get(providerName)

        if (!provider) {
            throw new Error(`Email provider "${providerName}" not found. Available: ${Array.from(this.providers.keys()).join(', ')}`)
        }

        return provider
    }

    /**
     * Send raw email using the default or specified provider
     */
    async send(options: EmailOptions, providerName?: string): Promise<EmailResult> {
        const provider = this.provider(providerName)
        const result = await provider.send(options)

        // Log the message
        const recipients = Array.isArray(options.to) ? options.to : [options.to]
        await Promise.all(
            recipients.map(recipient =>
                this.logMessage({
                    provider: provider.name,
                    recipient,
                    subject: options.subject,
                    status: result.success ? MessageStatus.SENT : MessageStatus.FAILED,
                    externalId: result.messageId,
                    errorMessage: result.error,
                })
            )
        )

        return result
    }

    /**
     * Send transactional email with built-in template
     */
    async sendTransactional(
        to: string | string[],
        subject: string,
        content: TransactionalContent,
        providerName?: string
    ): Promise<EmailResult> {
        const provider = this.provider(providerName)
        const result = await provider.sendTransactional(to, subject, content)

        // Log the message
        const recipients = Array.isArray(to) ? to : [to]
        await Promise.all(
            recipients.map(recipient =>
                this.logMessage({
                    provider: provider.name,
                    recipient,
                    subject,
                    status: result.success ? MessageStatus.SENT : MessageStatus.FAILED,
                    externalId: result.messageId,
                    errorMessage: result.error,
                    metadata: { type: 'transactional' },
                })
            )
        )

        return result
    }

    /**
     * Send email using custom EJS template
     */
    async sendFromTemplate(
        templateName: string,
        options: TemplateEmailOptions,
        providerName?: string
    ): Promise<EmailResult> {
        const provider = this.provider(providerName)
        const result = await provider.sendFromTemplate(templateName, options)

        // Log the message
        const recipients = Array.isArray(options.to) ? options.to : [options.to]
        await Promise.all(
            recipients.map(recipient =>
                this.logMessage({
                    provider: provider.name,
                    recipient,
                    subject: options.subject,
                    status: result.success ? MessageStatus.SENT : MessageStatus.FAILED,
                    externalId: result.messageId,
                    errorMessage: result.error,
                    metadata: { type: 'template', templateName },
                })
            )
        )

        return result
    }

    /**
     * Send password reset email using preset template
     */
    async sendPasswordReset(
        to: string,
        resetUrl: string,
        userName?: string,
        expiresIn?: string,
        providerName?: string
    ): Promise<EmailResult> {
        return this.sendFromTemplate('password_reset', {
            to,
            subject: 'Reset Your Password',
            data: {
                resetUrl,
                userName,
                expiresIn: expiresIn || '1 hour',
            },
        }, providerName)
    }

    /**
     * Send email verification using preset template
     */
    async sendEmailVerification(
        to: string,
        verificationUrl: string,
        verificationCode?: string,
        userName?: string,
        providerName?: string
    ): Promise<EmailResult> {
        return this.sendFromTemplate('email_verification', {
            to,
            subject: 'Verify Your Email',
            data: {
                verificationUrl,
                verificationCode,
                userName,
            },
        }, providerName)
    }

    /**
     * Send welcome email using preset template
     */
    async sendWelcome(
        to: string,
        dashboardUrl: string,
        userName?: string,
        features?: string[],
        providerName?: string
    ): Promise<EmailResult> {
        return this.sendFromTemplate('welcome', {
            to,
            subject: 'Welcome!',
            data: {
                dashboardUrl,
                userName,
                features,
            },
        }, providerName)
    }

    /**
     * Log message to database
     */
    private async logMessage(data: {
        provider: string
        recipient: string
        subject?: string
        status: MessageStatus
        externalId?: string
        errorMessage?: string
        metadata?: Record<string, any>
        userId?: number
    }): Promise<void> {
        try {
            await MessageLog.logMessage({
                type: MessageType.EMAIL,
                ...data,
            })
        } catch (error) {
            console.error('[EmailService] Failed to log message:', error)
        }
    }
}
