import nodemailer, { Transporter } from 'nodemailer'
import * as path from 'path'
import * as fs from 'fs'
import * as ejs from 'ejs'
import {
    IEmailProvider,
    EmailResult,
    EmailOptions,
    TransactionalContent,
} from './IEmailProvider.js'
import { TemplateConfig } from '../../templates/TemplateEngine.js'
import { EmailTemplateConfig } from './NodemailerProvider.js'

export interface GmailOAuthConfig {
    user: string
    clientId: string
    clientSecret: string
    refreshToken: string
    from?: string
}

export class GmailOAuthProvider implements IEmailProvider {
    readonly name = 'gmail_oauth'
    private transporter: Transporter
    private defaultFrom: string
    private templatesPath: string
    private templateConfig: TemplateConfig

    constructor(
        config: GmailOAuthConfig,
        templateConfig: EmailTemplateConfig
    ) {
        if (!config.user || !config.clientId || !config.clientSecret || !config.refreshToken) {
            throw new Error('GmailOAuthProvider: user, clientId, clientSecret, and refreshToken are required')
        }

        if (!templateConfig.path) {
            throw new Error('GmailOAuthProvider: template.path is required in config')
        }

        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: config.user,
                clientId: config.clientId,
                clientSecret: config.clientSecret,
                refreshToken: config.refreshToken,
            },
        })

        this.defaultFrom = config.from || config.user
        this.templatesPath = templateConfig.path
        this.templateConfig = templateConfig.config || {}
    }

    async send(options: EmailOptions): Promise<EmailResult> {
        try {
            const info = await this.transporter.sendMail({
                from: options.from || this.defaultFrom,
                to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
                subject: options.subject,
                text: options.text,
                html: options.html,
                replyTo: options.replyTo,
                cc: options.cc,
                bcc: options.bcc,
                attachments: options.attachments,
            })

            return {
                success: true,
                messageId: info.messageId,
                provider: this.name,
                timestamp: new Date(),
            }
        } catch (error: any) {
            console.error(`[GmailOAuthProvider] Failed to send email:`, error.message)

            return {
                success: false,
                error: error.message || 'Failed to send email',
                provider: this.name,
                timestamp: new Date(),
            }
        }
    }

    async sendTransactional(
        params: {
            email: string | string[];
            subject: string;
            content: TransactionalContent;
        }
    ): Promise<EmailResult> {
        const templatePath = path.join(this.templatesPath, 'base', 'transactional.ejs')

        if (!fs.existsSync(templatePath)) {
            return {
                success: false,
                error: `Transactional template not found at ${templatePath}`,
                provider: this.name,
                timestamp: new Date(),
            }
        }

        const html = await this.renderTemplate(templatePath, {
            ...params.content,
            config: this.templateConfig,
        })

        return this.send({
            to: params.email,
            subject: params.subject,
            html,
        })
    }

    private async renderTemplate(templatePath: string, data: Record<string, any>): Promise<string> {
        const template = await fs.promises.readFile(templatePath, 'utf-8')
        return ejs.render(template, data, {
            filename: templatePath,
            async: false
        })
    }
}
