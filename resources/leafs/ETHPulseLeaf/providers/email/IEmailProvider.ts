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
    preheader?: string
    greeting?: string
    body: string
    buttonText?: string
    buttonUrl?: string
    footer?: string
    additionalContent?: string
}

export interface TemplateEmailOptions {
    to: string | string[]
    subject: string
    data: Record<string, any>
    from?: string
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
        to: string | string[],
        subject: string,
        content: TransactionalContent
    ): Promise<EmailResult>

    /**
     * Send email using a custom EJS template
     */
    sendFromTemplate(
        templateName: string,
        options: TemplateEmailOptions
    ): Promise<EmailResult>
}
