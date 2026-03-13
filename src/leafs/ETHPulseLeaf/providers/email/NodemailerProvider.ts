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

export interface NodemailerConfig {
    host: string
    port: number
    secure: boolean
    auth: {
        user: string
        pass: string
    }
    from: string
}

export interface EmailTemplateConfig {
    path: string
    config?: TemplateConfig
}

export class NodemailerProvider implements IEmailProvider {
    readonly name = 'nodemailer'
    private transporter: Transporter
    private defaultFrom: string
    private templatesPath: string
    private templateConfig: TemplateConfig

    constructor(
        config: NodemailerConfig,
        templateConfig: EmailTemplateConfig
    ) {
        if (!config.auth?.user || !config.auth?.pass) {
            throw new Error('NodemailerProvider: host, auth.user, and auth.pass are required')
        }

        if (!templateConfig.path) {
            throw new Error('NodemailerProvider: template.path is required in config')
        }

        let localTransporter = {
            auth: {
                user: config.auth.user,
                pass: config.auth.pass,
            },
        }

        if (config.host) {
            // @ts-ignore
            localTransporter.host = config.host
        }

        if (config.port && !isNaN(config.port)) {
            // @ts-ignore
            localTransporter.port = config.port
        }

        if (config.secure) {
            // @ts-ignore
            localTransporter.secure = config.secure
        }

        this.transporter = nodemailer.createTransport(localTransporter)

        this.defaultFrom = config.from || config.auth.user
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
            console.error(`[NodemailerProvider] Failed to send email:`, error.message)

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
        // Use base/transactional.ejs from the configured templates path
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
