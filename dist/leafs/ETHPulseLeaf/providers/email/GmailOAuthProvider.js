var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import nodemailer from 'nodemailer';
import * as path from 'path';
import * as fs from 'fs';
import * as ejs from 'ejs';
export class GmailOAuthProvider {
    constructor(config, templateConfig) {
        this.name = 'gmail_oauth';
        if (!config.user || !config.clientId || !config.clientSecret || !config.refreshToken) {
            throw new Error('GmailOAuthProvider: user, clientId, clientSecret, and refreshToken are required');
        }
        if (!templateConfig.path) {
            throw new Error('GmailOAuthProvider: template.path is required in config');
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
        });
        this.defaultFrom = config.from || config.user;
        this.templatesPath = templateConfig.path;
        this.templateConfig = templateConfig.config || {};
    }
    send(options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const info = yield this.transporter.sendMail({
                    from: options.from || this.defaultFrom,
                    to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
                    subject: options.subject,
                    text: options.text,
                    html: options.html,
                    replyTo: options.replyTo,
                    cc: options.cc,
                    bcc: options.bcc,
                    attachments: options.attachments,
                });
                return {
                    success: true,
                    messageId: info.messageId,
                    provider: this.name,
                    timestamp: new Date(),
                };
            }
            catch (error) {
                console.error(`[GmailOAuthProvider] Failed to send email:`, error.message);
                return {
                    success: false,
                    error: error.message || 'Failed to send email',
                    provider: this.name,
                    timestamp: new Date(),
                };
            }
        });
    }
    sendTransactional(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const templatePath = path.join(this.templatesPath, 'base', 'transactional.ejs');
            if (!fs.existsSync(templatePath)) {
                return {
                    success: false,
                    error: `Transactional template not found at ${templatePath}`,
                    provider: this.name,
                    timestamp: new Date(),
                };
            }
            const html = yield this.renderTemplate(templatePath, Object.assign(Object.assign({}, params.content), { config: this.templateConfig }));
            return this.send({
                to: params.email,
                subject: params.subject,
                html,
            });
        });
    }
    renderTemplate(templatePath, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const template = yield fs.promises.readFile(templatePath, 'utf-8');
            return ejs.render(template, data, {
                filename: templatePath,
                async: false
            });
        });
    }
}
