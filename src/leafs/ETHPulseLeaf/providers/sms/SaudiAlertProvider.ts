import { ISmsProvider, SmsResult, SmsOptions } from './ISmsProvider.js'

export interface SaudiAlertConfig {
    username: string
    apiPassword: string
    sender: string
    /** Delivery priority passed to the gateway. Defaults to '8'. */
    priority?: string
}

/**
 * Saudi Alert SMS provider (saudialert.com).
 *
 * Simple HTTP GET gateway, KSA numbers only: the recipient is normalised to
 * the 12-digit `966XXXXXXXXX` form before being sent.
 */
export class SaudiAlertProvider implements ISmsProvider {
    readonly name = 'saudialert'
    private username: string
    private apiPassword: string
    private sender: string
    private priority: string
    private baseUrl = 'http://saudialert.com/pushsms.php'

    constructor(config: SaudiAlertConfig) {
        if (!config.username || !config.apiPassword || !config.sender) {
            throw new Error('SaudiAlertProvider: username, apiPassword, and sender are required')
        }

        this.username = config.username
        this.apiPassword = config.apiPassword
        this.sender = config.sender
        this.priority = config.priority || '8'
    }

    private formatNumber(number: string): string {
        const numberStr = number.replace(/[^0-9]/g, '')

        if (numberStr.startsWith('966') && numberStr.length === 12) {
            return numberStr
        }

        if (numberStr.length === 9) {
            return '966' + numberStr
        }

        throw new Error('Invalid number format: expected 9 digits or 12 digits starting with 966')
    }

    async send(params: { phone: string; message: string }): Promise<SmsResult> {
        return this.sendWithOptions({ to: params.phone, message: params.message })
    }

    async sendBulk(recipients: string[], message: string): Promise<SmsResult[]> {
        const results = await Promise.allSettled(recipients.map((recipient) => this.send({ phone: recipient, message })))

        return results.map((result) => {
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
            const formattedNumber = this.formatNumber(options.to)

            const query = new URLSearchParams({
                username: this.username,
                api_password: this.apiPassword,
                sender: options.from || this.sender,
                to: formattedNumber,
                message: options.message,
                priority: this.priority,
            })

            const response = await fetch(`${this.baseUrl}?${query}`)
            const body = (await response.text()).trim()

            // The gateway answers 200 with a plain-text body: an id on success,
            // an error label otherwise. Anything non-2xx is a hard failure.
            if (!response.ok) {
                return {
                    success: false,
                    error: `HTTP ${response.status}: ${body || response.statusText}`,
                    provider: this.name,
                    timestamp: new Date(),
                }
            }

            return {
                success: true,
                messageId: body || undefined,
                provider: this.name,
                timestamp: new Date(),
            }
        } catch (error: any) {
            console.error(`[SaudiAlertProvider] Failed to send SMS to ${options.to}:`, error.message)

            return {
                success: false,
                error: error.message || 'Failed to send SMS',
                provider: this.name,
                timestamp: new Date(),
            }
        }
    }
}
