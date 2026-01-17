/**
 * SMS Provider Interface
 * All SMS providers must implement this interface
 */

export interface SmsResult {
    success: boolean
    messageId?: string
    error?: string
    provider: string
    timestamp: Date
}

export interface SmsOptions {
    to: string
    message: string
    from?: string
}

export interface ISmsProvider {
    readonly name: string

    /**
     * Send a single SMS message
     */
    send(to: string, message: string): Promise<SmsResult>

    /**
     * Send SMS to multiple recipients
     */
    sendBulk(recipients: string[], message: string): Promise<SmsResult[]>

    /**
     * Send SMS with full options
     */
    sendWithOptions(options: SmsOptions): Promise<SmsResult>
}
