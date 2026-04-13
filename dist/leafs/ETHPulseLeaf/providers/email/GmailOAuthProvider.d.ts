import { IEmailProvider, EmailResult, EmailOptions, TransactionalContent } from './IEmailProvider.js';
import { EmailTemplateConfig } from './NodemailerProvider.js';
export interface GmailOAuthConfig {
    user: string;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    from?: string;
}
export declare class GmailOAuthProvider implements IEmailProvider {
    readonly name = "gmail_oauth";
    private transporter;
    private defaultFrom;
    private templatesPath;
    private templateConfig;
    constructor(config: GmailOAuthConfig, templateConfig: EmailTemplateConfig);
    send(options: EmailOptions): Promise<EmailResult>;
    sendTransactional(params: {
        email: string | string[];
        subject: string;
        content: TransactionalContent;
    }): Promise<EmailResult>;
    private renderTemplate;
}
