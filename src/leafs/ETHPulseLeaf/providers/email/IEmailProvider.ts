/**
 * Email Provider Interface
 * All Email providers must implement this interface
 */

export interface EmailResult {
    success: boolean
    messageId?: string
    error?: string
    provider: string
    timestamp: Date
}

export interface EmailAttachment {
    filename: string
    content?: string | Buffer
    path?: string
    contentType?: string
}

export interface EmailOptions {
    to: string | string[]
    subject: string
    text?: string
    html?: string
    from?: string
    replyTo?: string
    cc?: string | string[]
    bcc?: string | string[]
    attachments?: EmailAttachment[]
}

export interface TransactionalContent {
    title?: string
    greeting?: string
    body: string
    buttonText?: string
    buttonUrl?: string
    additionalContent?: string
}

export interface IEmailProvider {
    readonly name: string

    /**
     * Send a raw email
     */
    send(options: EmailOptions): Promise<EmailResult>

    /**
     * Send email using transactional template with configured branding
     */
    sendTransactional(
        params: {
            email: string | string[];
            subject: string;
            content: TransactionalContent;
        }
    ): Promise<EmailResult>
}
