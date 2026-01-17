import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk'
import { IPushProvider, PushResult, PushMessage, PushOptions } from './IPushProvider'

export interface ExpoConfig {
    accessToken?: string
}

export class ExpoProvider implements IPushProvider {
    readonly name = 'expo'
    private expo: Expo

    constructor(config: ExpoConfig = {}) {
        this.expo = new Expo({
            accessToken: config.accessToken,
        })
    }

    async send(pushToken: string, message: PushMessage, options?: PushOptions): Promise<PushResult> {
        const results = await this.sendMultiple([pushToken], message, options)
        return results[0]
    }

    async sendMultiple(pushTokens: string[], message: PushMessage, options?: PushOptions): Promise<PushResult[]> {
        // Filter valid Expo push tokens
        const validTokens = pushTokens.filter(token => Expo.isExpoPushToken(token))

        if (validTokens.length === 0) {
            return pushTokens.map(() => ({
                success: false,
                error: 'Invalid Expo push token',
            }))
        }

        const messages: ExpoPushMessage[] = validTokens.map(token => ({
            to: token,
            sound: message.sound || 'default',
            title: message.title,
            body: message.body,
            data: message.data,
            badge: message.badge,
            channelId: message.channelId,
            priority: options?.priority,
            ttl: options?.ttl,
        }))

        const results: PushResult[] = []
        const chunks = this.expo.chunkPushNotifications(messages)

        for (const chunk of chunks) {
            try {
                const tickets = await this.expo.sendPushNotificationsAsync(chunk)

                for (const ticket of tickets) {
                    if (ticket.status === 'ok') {
                        results.push({
                            success: true,
                            ticketId: ticket.id,
                        })
                    } else {
                        results.push({
                            success: false,
                            error: ticket.message,
                        })
                    }
                }
            } catch (error: any) {
                // If the whole chunk fails, mark all as failed
                chunk.forEach(() => {
                    results.push({
                        success: false,
                        error: error.message || 'Failed to send push notification',
                    })
                })
            }
        }

        return results
    }

    /**
     * Check receipts for previously sent notifications
     */
    async checkReceipts(ticketIds: string[]): Promise<Map<string, { status: string; error?: string }>> {
        const receiptResults = new Map<string, { status: string; error?: string }>()
        const receiptIdChunks = this.expo.chunkPushNotificationReceiptIds(ticketIds)

        for (const chunk of receiptIdChunks) {
            try {
                const receipts = await this.expo.getPushNotificationReceiptsAsync(chunk)

                for (const [receiptId, receipt] of Object.entries(receipts)) {
                    if (receipt.status === 'ok') {
                        receiptResults.set(receiptId, { status: 'ok' })
                    } else if (receipt.status === 'error') {
                        receiptResults.set(receiptId, {
                            status: 'error',
                            error: receipt.message,
                        })
                    }
                }
            } catch (error: any) {
                chunk.forEach(id => {
                    receiptResults.set(id, {
                        status: 'error',
                        error: error.message,
                    })
                })
            }
        }

        return receiptResults
    }
}
