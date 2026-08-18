import { IEmailProvider, EmailResult, EmailOptions, TransactionalOptions } from './IEmailProvider.js';
import { TemplateConfig } from '../../templates/TemplateEngine.js';
export interface NodemailerConfig {
    host: string;
    port: number;
    secure: boolean;
    auth: {
        user: string;
        pass: string;
    };
    from: string;
}
export interface EmailTemplateConfig {
    path: string;
    config?: TemplateConfig;
}
export declare class NodemailerProvider implements IEmailProvider {
    readonly name = "nodemailer";
    private transporter;
    private defaultFrom;
    private templatesPath;
    private templateConfig;
    constructor(config: NodemailerConfig, templateConfig: EmailTemplateConfig);
    send(options: EmailOptions): Promise<EmailResult>;
    sendTransactional(params: TransactionalOptions): Promise<EmailResult>;
    private renderTemplate;
}
