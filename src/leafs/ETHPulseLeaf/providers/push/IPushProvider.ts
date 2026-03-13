/**
 * Push Notification Provider Interface
 * All push providers must implement this interface
 */

export interface PushResult {
    success: boolean
    messageId?: string
    ticketId?: string
    error?: string
}

export interface PushMessage {
    title?: string
    body: string
    data?: Record<string, any>
    sound?: 'default' | string
    badge?: number
    channelId?: string
}

export interface PushOptions {
    priority?: 'default' | 'normal' | 'high'
    ttl?: number // Time to live in seconds
}

export interface IPushProvider {
    readonly name: string

    /**
     * Send push notification to a single device
     */
    send(pushToken: string, message: PushMessage, options?: PushOptions): Promise<PushResult>

    /**
     * Send push notification to multiple devices
     */
    sendMultiple(pushTokens: string[], message: PushMessage, options?: PushOptions): Promise<PushResult[]>
}
