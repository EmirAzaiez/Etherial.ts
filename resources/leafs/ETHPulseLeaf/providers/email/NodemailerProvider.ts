import nodemailer, { Transporter } from 'nodemailer'
import * as path from 'path'
import * as fs from 'fs'
import * as ejs from 'ejs'
import {
    IEmailProvider,
    EmailResult,
    EmailOptions,
    TransactionalContent,
} from './IEmailProvider'
import { TemplateConfig } from '../../templates/TemplateEngine'

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

export class NodemailerProvider implements IEmailProvider {
    readonly name = 'nodemailer'
    private transporter: Transporter
    private defaultFrom: string
    private templateConfig?: TemplateConfig
    private customTemplatesPath?: string

    constructor(
        config: NodemailerConfig,
        templateConfig?: TemplateConfig,
        customTemplatesPath?: string
    ) {
        if (!config.host || !config.auth?.user || !config.auth?.pass) {
            throw new Error('NodemailerProvider: host, auth.user, and auth.pass are required')
        }

        this.transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port || 587,
            secure: config.secure || false,
            auth: {
                user: config.auth.user,
                pass: config.auth.pass,
            },
        })

        this.defaultFrom = config.from || config.auth.user
        this.templateConfig = templateConfig
        this.customTemplatesPath = customTemplatesPath
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
        to: string | string[],
        subject: string,
        content: TransactionalContent
    ): Promise<EmailResult> {
        const templatePath = path.join(__dirname, '../../templates/base/transactional.ejs')

        const html = await this.renderTemplate(templatePath, {
            ...content,
            config: this.templateConfig || {},
        })

        return this.send({
            to,
            subject,
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
