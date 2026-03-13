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
export class NodemailerProvider {
    constructor(config, templateConfig) {
        var _a, _b;
        this.name = 'nodemailer';
        if (!((_a = config.auth) === null || _a === void 0 ? void 0 : _a.user) || !((_b = config.auth) === null || _b === void 0 ? void 0 : _b.pass)) {
            throw new Error('NodemailerProvider: host, auth.user, and auth.pass are required');
        }
        if (!templateConfig.path) {
            throw new Error('NodemailerProvider: template.path is required in config');
        }
        let localTransporter = {
            auth: {
                user: config.auth.user,
                pass: config.auth.pass,
            },
        };
        if (config.host) {
            // @ts-ignore
            localTransporter.host = config.host;
        }
        if (config.port && !isNaN(config.port)) {
            // @ts-ignore
            localTransporter.port = config.port;
        }
        if (config.secure) {
            // @ts-ignore
            localTransporter.secure = config.secure;
        }
        this.transporter = nodemailer.createTransport(localTransporter);
        this.defaultFrom = config.from || config.auth.user;
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
                console.error(`[NodemailerProvider] Failed to send email:`, error.message);
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
            // Use base/transactional.ejs from the configured templates path
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
