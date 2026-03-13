import {
    IEmailProvider,
    EmailResult,
    EmailOptions,
    TransactionalContent,
} from '../providers/email/IEmailProvider.js'
import { MessageLog, MessageType, MessageStatus } from '../models/MessageLog.js'

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
        params: {
            email: string | string[];
            subject: string;
            content: TransactionalContent;
        },
        providerName?: string
    ): Promise<EmailResult> {
        const provider = this.provider(providerName)
        const result = await provider.sendTransactional(params)

        // Log the message
        const recipients = Array.isArray(params.email) ? params.email : [params.email]
        await Promise.all(
            recipients.map(recipient =>
                this.logMessage({
                    provider: provider.name,
                    recipient,
                    subject: params.subject,
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
