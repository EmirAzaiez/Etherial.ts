import { IPushProvider, PushResult, PushMessage, PushOptions } from '../providers/push/IPushProvider'
import { MessageLog, MessageType, MessageStatus } from '../models/MessageLog'
import { Device } from '../models/Device'

export class PushService {
    private providers: Map<string, IPushProvider> = new Map()
    private defaultProvider: string

    constructor(providers: Map<string, IPushProvider>, defaultProvider: string) {
        this.providers = providers
        this.defaultProvider = defaultProvider
    }

    /**
     * Get a specific provider or the default one
     */
    provider(name?: string): IPushProvider {
        const providerName = name || this.defaultProvider
        const provider = this.providers.get(providerName)

        if (!provider) {
            throw new Error(`Push provider "${providerName}" not found. Available: ${Array.from(this.providers.keys()).join(', ')}`)
        }

        return provider
    }

    /**
     * Send push notification to a single device
     */
    async send(
        pushToken: string,
        message: PushMessage,
        options?: PushOptions & { userId?: number; providerName?: string }
    ): Promise<PushResult> {
        const provider = this.provider(options?.providerName)
        const result = await provider.send(pushToken, message, options)

        await this.logMessage({
            provider: provider.name,
            recipient: pushToken,
            subject: message.title,
            content: message.body,
            status: result.success ? MessageStatus.SENT : MessageStatus.FAILED,
            externalId: result.ticketId,
            errorMessage: result.error,
            userId: options?.userId,
        })

        return result
    }

    /**
     * Send push notification to multiple devices
     */
    async sendMultiple(
        pushTokens: string[],
        message: PushMessage,
        options?: PushOptions & { userIds?: number[]; providerName?: string }
    ): Promise<PushResult[]> {
        const provider = this.provider(options?.providerName)
        const results = await provider.sendMultiple(pushTokens, message, options)

        // Log each message
        await Promise.all(
            results.map((result, index) =>
                this.logMessage({
                    provider: provider.name,
                    recipient: pushTokens[index],
                    subject: message.title,
                    content: message.body,
                    status: result.success ? MessageStatus.SENT : MessageStatus.FAILED,
                    externalId: result.ticketId,
                    errorMessage: result.error,
                    userId: options?.userIds?.[index],
                })
            )
        )

        return results
    }

    /**
     * Send push notification to a Device model instance
     */
    async sendToDevice(
        device: Device,
        message: PushMessage,
        options?: PushOptions & { providerName?: string }
    ): Promise<PushResult> {
        if (!device.push_token) {
            return { success: false, error: 'Device has no push token' }
        }

        return this.send(device.push_token, message, {
            ...options,
            userId: device.user_id,
        })
    }

    /**
     * Send push notification to multiple Device model instances
     */
    async sendToDevices(
        devices: Device[],
        message: PushMessage,
        options?: PushOptions & { providerName?: string }
    ): Promise<PushResult[]> {
        const validDevices = devices.filter(d => d.push_token)

        if (validDevices.length === 0) {
            return devices.map(() => ({ success: false, error: 'Device has no push token' }))
        }

        return this.sendMultiple(
            validDevices.map(d => d.push_token),
            message,
            {
                ...options,
                userIds: validDevices.map(d => d.user_id),
            }
        )
    }

    /**
     * Log message to database
     */
    private async logMessage(data: {
        provider: string
        recipient: string
        subject?: string
        content?: string
        status: MessageStatus
        externalId?: string
        errorMessage?: string
        userId?: number
    }): Promise<void> {
        try {
            await MessageLog.logMessage({
                type: MessageType.PUSH,
                ...data,
            })
        } catch (error) {
            console.error('[PushService] Failed to log message:', error)
        }
    }
}
