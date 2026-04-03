import { IEmailProvider, EmailResult, EmailOptions, TransactionalContent } from '../providers/email/IEmailProvider.js';
export declare class EmailService {
    private providers;
    private defaultProvider;
    constructor(providers: Map<string, IEmailProvider>, defaultProvider: string);
    /**
     * Get a specific provider or the default one
     */
    provider(name?: string): IEmailProvider;
    /**
     * Send raw email using the default or specified provider
     */
    send(options: EmailOptions, providerName?: string): Promise<EmailResult>;
    /**
     * Send transactional email with built-in template
     */
    sendTransactional(params: {
        email: string | string[];
        subject: string;
        content: TransactionalContent;
    }, providerName?: string): Promise<EmailResult>;
    /**
     * Send email using a template stored in the database.
     *
     * ```typescript
     * await emailService.sendFromTemplate('password_reset', {
     *     to: 'john@example.com',
     *     locale: 'fr',
     *     variables: { firstname: 'John', token: 'abc123', resetUrl: 'https://app.com/reset/abc123' }
     * })
     * ```
     */
    sendFromTemplate(key: string, params: {
        to: string | string[];
        locale?: string;
        variables?: Record<string, string>;
    }, providerName?: string): Promise<EmailResult>;
    /**
     * Log message to database
     */
    private logMessage;
}
