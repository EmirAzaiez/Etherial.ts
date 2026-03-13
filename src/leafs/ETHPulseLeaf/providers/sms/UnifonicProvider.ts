import { ISmsProvider, SmsResult, SmsOptions } from './ISmsProvider.js'

export interface UnifonicConfig {
    appSid: string
    senderId: string
}

export class UnifonicProvider implements ISmsProvider {
    readonly name = 'unifonic'
    private appSid: string
    private senderId: string
    private baseUrl = 'https://el.cloud.unifonic.com/rest/SMS/messages'

    constructor(config: UnifonicConfig) {

        console.log(config)

        if (!config.appSid || !config.senderId) {
            throw new Error('UnifonicProvider: appSid and senderId are required')
        }

        this.appSid = config.appSid
        this.senderId = config.senderId
    }

    async send(params: { phone: string; message: string }): Promise<SmsResult> {
        return this.sendWithOptions({ to: params.phone, message: params.message })
    }

    async sendBulk(recipients: string[], message: string): Promise<SmsResult[]> {
        const results = await Promise.allSettled(
            recipients.map(recipient => this.send({ phone: recipient, message }))
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
            // Format recipient: remove + or 00 prefix
            const formattedRecipient = options.to.replace(/^(\+|00)/, '')

            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    AppSid: this.appSid,
                    SenderID: options.from || this.senderId,
                    Recipient: formattedRecipient,
                    Body: options.message,
                    responseType: 'JSON',
                    baseEncode: true,
                }),
            })

            const data = await response.json()

            // Unifonic returns success when status code is 0
            if (data.success === true || data.errorCode === 'ER-00') {
                return {
                    success: true,
                    messageId: data.data?.MessageID || data.MessageID,
                    provider: this.name,
                    timestamp: new Date(),
                }
            }

            return {
                success: false,
                error: data.message || data.errorMessage || 'Failed to send SMS',
                provider: this.name,
                timestamp: new Date(),
            }
        } catch (error: any) {
            console.error(`[UnifonicProvider] Failed to send SMS to ${options.to}:`, error.message)

            return {
                success: false,
                error: error.message || 'Failed to send SMS',
                provider: this.name,
                timestamp: new Date(),
            }
        }
    }
}
