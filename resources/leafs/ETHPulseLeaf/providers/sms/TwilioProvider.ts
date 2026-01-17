import Twilio from 'twilio'
import { ISmsProvider, SmsResult, SmsOptions } from './ISmsProvider'

export interface TwilioConfig {
    accountSid: string
    authToken: string
    fromNumber: string
}

export class TwilioProvider implements ISmsProvider {
    readonly name = 'twilio'
    private client: Twilio.Twilio
    private fromNumber: string

    constructor(config: TwilioConfig) {
        if (!config.accountSid || !config.authToken || !config.fromNumber) {
            throw new Error('TwilioProvider: accountSid, authToken, and fromNumber are required')
        }

        this.client = Twilio(config.accountSid, config.authToken)
        this.fromNumber = config.fromNumber
    }

    async send(to: string, message: string): Promise<SmsResult> {
        return this.sendWithOptions({ to, message })
    }

    async sendBulk(recipients: string[], message: string): Promise<SmsResult[]> {
        const results = await Promise.allSettled(
            recipients.map(recipient => this.send(recipient, message))
        )

        return results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value
            }
            return {
                success: false,
                error: result.reason?.message || 'Unknown error',
                provider: this.name,
                timestamp: new Date(),
            }
        })
    }

    async sendWithOptions(options: SmsOptions): Promise<SmsResult> {
        try {
            const messageResponse = await this.client.messages.create({
                to: options.to,
                from: options.from || this.fromNumber,
                body: options.message,
            })

            return {
                success: true,
                messageId: messageResponse.sid,
                provider: this.name,
                timestamp: new Date(),
            }
        } catch (error: any) {
            console.error(`[TwilioProvider] Failed to send SMS to ${options.to}:`, error.message)

            return {
                success: false,
                error: error.message || 'Failed to send SMS',
                provider: this.name,
                timestamp: new Date(),
            }
        }
    }
}
