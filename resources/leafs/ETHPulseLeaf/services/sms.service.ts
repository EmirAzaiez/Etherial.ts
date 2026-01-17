import { ISmsProvider, SmsResult, SmsOptions } from '../providers/sms/ISmsProvider'
import { MessageLog, MessageType, MessageStatus } from '../models/MessageLog'

export class SmsService {
    private providers: Map<string, ISmsProvider> = new Map()
    private defaultProvider: string

    constructor(providers: Map<string, ISmsProvider>, defaultProvider: string) {
        this.providers = providers
        this.defaultProvider = defaultProvider
    }

    /**
     * Get a specific provider or the default one
     */
    provider(name?: string): ISmsProvider {
        const providerName = name || this.defaultProvider
        const provider = this.providers.get(providerName)

        if (!provider) {
            throw new Error(`SMS provider "${providerName}" not found. Available: ${Array.from(this.providers.keys()).join(', ')}`)
        }

        return provider
    }

    /**
     * Send SMS using the default or specified provider
     */
    async send(to: string, message: string, providerName?: string): Promise<SmsResult> {
        const provider = this.provider(providerName)
        const result = await provider.send(to, message)

        // Log the message
        await this.logMessage({
            provider: provider.name,
            recipient: to,
            status: result.success ? MessageStatus.SENT : MessageStatus.FAILED,
            externalId: result.messageId,
            errorMessage: result.error,
        })

        return result
    }

    /**
     * Send SMS to multiple recipients
     */
    async sendBulk(recipients: string[], message: string, providerName?: string): Promise<SmsResult[]> {
        const provider = this.provider(providerName)
        const results = await provider.sendBulk(recipients, message)

        // Log each message
        await Promise.all(
            results.map((result, index) =>
                this.logMessage({
                    provider: provider.name,
                    recipient: recipients[index],
                    status: result.success ? MessageStatus.SENT : MessageStatus.FAILED,
                    externalId: result.messageId,
                    errorMessage: result.error,
                })
            )
        )

        return results
    }

    /**
     * Send verification code SMS
     */
    async sendVerificationCode(to: string, code: string, providerName?: string): Promise<SmsResult> {
        const message = `Your verification code is: ${code}`
        return this.send(to, message, providerName)
    }

    /**
     * Log message to database
     */
    private async logMessage(data: {
        provider: string
        recipient: string
        status: MessageStatus
        externalId?: string
        errorMessage?: string
        userId?: number
    }): Promise<void> {
        try {
            await MessageLog.logMessage({
                type: MessageType.SMS,
                ...data,
            })
        } catch (error) {
            console.error('[SmsService] Failed to log message:', error)
        }
    }
}
