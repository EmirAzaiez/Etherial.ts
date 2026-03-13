var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Providers
import { TwilioProvider } from './providers/sms/index.js';
import { NodemailerProvider } from './providers/email/index.js';
import { ExpoProvider } from './providers/push/index.js';
// Services
import { SmsService } from './services/sms.service.js';
import { EmailService } from './services/email.service.js';
import { PushService } from './services/push.service.js';
// Templates
import { defaultTemplateConfig } from './templates/TemplateEngine.js';
import { UnifonicProvider } from './providers/sms/UnifonicProvider.js';
/**
 * ETHPulseLeaf - Unified Messaging System
 *
 * Handles SMS, Email, and Push Notifications with a provider-based architecture.
 */
export default class ETHPulseLeaf {
    constructor(config) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        this.etherial_module_name = 'eth_pulse_leaf';
        this.smsProviders = new Map();
        this.emailProviders = new Map();
        this.pushProviders = new Map();
        this.routes = [];
        this.config = config;
        this.templateConfig = Object.assign(Object.assign({}, defaultTemplateConfig), (_b = (_a = config.email) === null || _a === void 0 ? void 0 : _a.template) === null || _b === void 0 ? void 0 : _b.config);
        // Initialize SMS providers
        if ((_c = config.sms) === null || _c === void 0 ? void 0 : _c.providers) {
            for (const [name, providerConfig] of Object.entries(config.sms.providers)) {
                if (name === 'twilio') {
                    this.smsProviders.set(name, new TwilioProvider(providerConfig));
                }
                if (name === 'unifonic') {
                    this.smsProviders.set(name, new UnifonicProvider(providerConfig));
                }
                // Add more SMS providers here as needed
            }
        }
        // Initialize Email providers
        if ((_d = config.email) === null || _d === void 0 ? void 0 : _d.providers) {
            if (!((_e = config.email.template) === null || _e === void 0 ? void 0 : _e.path)) {
                throw new Error(`[ETHPulseLeaf] email.template.path is required when email providers are configured. ` +
                    `Run 'etherial cmd eth_pulse_leaf:install-templates' to set up email templates, ` +
                    `then set email.template.path to the templates directory (e.g., path.join(process.cwd(), 'resources/emails')).`);
            }
            if (!fs.existsSync(config.email.template.path)) {
                throw new Error(`[ETHPulseLeaf] Email template path does not exist: ${config.email.template.path}. ` +
                    `Run 'etherial cmd eth_pulse_leaf:install-templates' to copy default templates to your project.`);
            }
            for (const [name, providerConfig] of Object.entries(config.email.providers)) {
                if (name === 'nodemailer') {
                    this.emailProviders.set(name, new NodemailerProvider(providerConfig, config.email.template));
                }
                // Add more Email providers here as needed
            }
        }
        // Initialize Push providers
        if ((_f = config.push) === null || _f === void 0 ? void 0 : _f.providers) {
            for (const [name, providerConfig] of Object.entries(config.push.providers)) {
                if (name === 'expo') {
                    this.pushProviders.set(name, new ExpoProvider(providerConfig));
                }
                // Add more Push providers here as needed
            }
        }
        // Initialize services
        if (this.smsProviders.size > 0) {
            const defaultSmsProvider = ((_g = config.sms) === null || _g === void 0 ? void 0 : _g.default) || this.smsProviders.keys().next().value;
            this._smsService = new SmsService(this.smsProviders, defaultSmsProvider);
        }
        if (this.emailProviders.size > 0) {
            const defaultEmailProvider = ((_h = config.email) === null || _h === void 0 ? void 0 : _h.default) || this.emailProviders.keys().next().value;
            this._emailService = new EmailService(this.emailProviders, defaultEmailProvider);
        }
        if (this.pushProviders.size > 0) {
            const defaultPushProvider = ((_j = config.push) === null || _j === void 0 ? void 0 : _j.default) || this.pushProviders.keys().next().value;
            this._pushService = new PushService(this.pushProviders, defaultPushProvider);
        }
        // Initialize device routes
        if (((_k = config.routes) === null || _k === void 0 ? void 0 : _k.devices) && config.routes.devices.length > 0) {
            this.routes.push({ route: path.join(__dirname, 'routes/devices'), methods: config.routes.devices });
        }
    }
    /**
     * Lifecycle: beforeRun - Register models
     */
    // beforeRun({ database }: Etherial) {
    //     database?.addModels([
    //         path.join(__dirname, 'models/MessageLog.js'),
    //         path.join(__dirname, 'models/Device.js'),
    //     ])
    // }
    /**
     * Lifecycle: run
     */
    run({ http }) {
        console.log('[ETHPulseLeaf] Initialized with providers:');
        console.log(`  SMS: ${Array.from(this.smsProviders.keys()).join(', ') || 'none'}`);
        console.log(`  Email: ${Array.from(this.emailProviders.keys()).join(', ') || 'none'}`);
        console.log(`  Push: ${Array.from(this.pushProviders.keys()).join(', ') || 'none'}`);
        // Register device routes
        if (this.routes.length > 0) {
            http.routes_leafs.push(...this.routes);
        }
    }
    /**
     * Get SMS service
     * @param providerName Optional provider name, uses default if not specified
     */
    sms(providerName) {
        if (!this._smsService) {
            throw new Error('[ETHPulseLeaf] No SMS providers configured');
        }
        // If a specific provider is requested, validate it exists
        if (providerName) {
            const provider = this.smsProviders.get(providerName);
            if (!provider) {
                throw new Error(`[ETHPulseLeaf] SMS provider "${providerName}" not found. Available: ${Array.from(this.smsProviders.keys()).join(', ')}`);
            }
        }
        return this._smsService;
    }
    /**
     * Get Email service
     * @param providerName Optional provider name, uses default if not specified
     */
    email(providerName) {
        if (!this._emailService) {
            throw new Error('[ETHPulseLeaf] No Email providers configured');
        }
        // If a specific provider is requested, validate it exists
        if (providerName) {
            const provider = this.emailProviders.get(providerName);
            if (!provider) {
                throw new Error(`[ETHPulseLeaf] Email provider "${providerName}" not found. Available: ${Array.from(this.emailProviders.keys()).join(', ')}`);
            }
        }
        return this._emailService;
    }
    /**
     * Get Push service
     * @param providerName Optional provider name, uses default if not specified
     */
    push(providerName) {
        if (!this._pushService) {
            throw new Error('[ETHPulseLeaf] No Push providers configured');
        }
        // If a specific provider is requested, validate it exists
        if (providerName) {
            const provider = this.pushProviders.get(providerName);
            if (!provider) {
                throw new Error(`[ETHPulseLeaf] Push provider "${providerName}" not found. Available: ${Array.from(this.pushProviders.keys()).join(', ')}`);
            }
        }
        return this._pushService;
    }
    /**
     * Available CLI commands
     */
    /**
     * Resolve the path to the bundled email templates shipped with the leaf
     */
    getTemplatesSourcePath() {
        // From dist/leafs/ETHPulseLeaf/ -> root/resources/leafs/ETHPulseLeaf/templates
        return path.resolve(__dirname, '..', '..', '..', 'resources', 'leafs', 'ETHPulseLeaf', 'templates');
    }
    /**
     * Recursively copy a directory
     */
    copyDirSync(src, dest) {
        fs.mkdirSync(dest, { recursive: true });
        for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
                this.copyDirSync(srcPath, destPath);
            }
            else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
    /**
     * Available CLI commands
     */
    commands() {
        return [
            {
                command: 'install-templates',
                description: 'Copy default email templates to your project (resources/emails/)',
                action: () => __awaiter(this, void 0, void 0, function* () {
                    const sourceDir = this.getTemplatesSourcePath();
                    const targetDir = path.join(process.cwd(), 'resources', 'emails');
                    if (!fs.existsSync(sourceDir)) {
                        console.error(`[ETHPulseLeaf] Source templates not found at: ${sourceDir}`);
                        return { success: false, message: 'Source templates not found' };
                    }
                    if (fs.existsSync(targetDir)) {
                        console.log(`[ETHPulseLeaf] Templates directory already exists at: ${targetDir}`);
                        console.log(`[ETHPulseLeaf] Overwriting with default templates...`);
                    }
                    this.copyDirSync(sourceDir, targetDir);
                    const files = [];
                    const listFiles = (dir, prefix = '') => {
                        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
                            if (entry.isDirectory()) {
                                listFiles(path.join(dir, entry.name), rel);
                            }
                            else {
                                files.push(rel);
                            }
                        }
                    };
                    listFiles(targetDir);
                    console.log(`[ETHPulseLeaf] Email templates installed to: ${targetDir}`);
                    console.log(`  Files copied:`);
                    for (const f of files) {
                        console.log(`    - ${f}`);
                    }
                    console.log(`\n  Set your config: email.template.path = path.join(process.cwd(), 'resources/emails')`);
                    return { success: true, message: `Installed ${files.length} template files` };
                }),
            },
            {
                command: 'test-email',
                description: 'Send a test email to verify configuration',
                action: (to) => __awaiter(this, void 0, void 0, function* () {
                    if (!to) {
                        console.error('Usage: eth_pulse_leaf:test-email <email>');
                        return;
                    }
                    try {
                        const result = yield this.email().sendTransactional({
                            email: to,
                            subject: 'Test Email from ETHPulseLeaf',
                            content: {
                                title: 'Test Email',
                                greeting: 'Hello!',
                                body: '<p>This is a test email from ETHPulseLeaf.</p><p>If you received this, your email configuration is working correctly!</p>',
                            }
                        });
                        if (result.success) {
                            console.log(`✅ Test email sent successfully to ${to}`);
                        }
                        else {
                            console.error(`❌ Failed to send test email: ${result.error}`);
                        }
                    }
                    catch (error) {
                        console.error(`❌ Error: ${error.message}`);
                    }
                }),
            },
            {
                command: 'test-sms',
                description: 'Send a test SMS to verify configuration',
                action: (to) => __awaiter(this, void 0, void 0, function* () {
                    if (!to) {
                        console.error('Usage: eth_pulse_leaf:test-sms <phone>');
                        return;
                    }
                    try {
                        const result = yield this.sms().send({
                            phone: to,
                            message: 'Test SMS from ETHPulseLeaf. Your configuration is working!'
                        });
                        if (result.success) {
                            console.log(`✅ Test SMS sent successfully to ${to}`);
                        }
                        else {
                            console.error(`❌ Failed to send test SMS: ${result.error}`);
                        }
                    }
                    catch (error) {
                        console.error(`❌ Error: ${error.message}`);
                    }
                }),
            },
            {
                command: 'test-push',
                description: 'Send a test push notification to verify configuration',
                action: (token) => __awaiter(this, void 0, void 0, function* () {
                    if (!token) {
                        console.error('Usage: eth_pulse_leaf:test-push <expo_push_token>');
                        return;
                    }
                    try {
                        const result = yield this.push().send(token, {
                            title: 'Test Push',
                            body: 'Test push notification from ETHPulseLeaf. Your configuration is working!',
                        });
                        if (result.success) {
                            console.log(`✅ Test push sent successfully`);
                        }
                        else {
                            console.error(`❌ Failed to send test push: ${result.error}`);
                        }
                    }
                    catch (error) {
                        console.error(`❌ Error: ${error.message}`);
                    }
                }),
            },
        ];
    }
}
export const AvailableRouteMethods = {
    devices: ['registerDevice', 'revokeDevice'],
};
export { MessageLog, MessageType, MessageStatus } from './models/MessageLog.js';
export { Device, DevicePlatform, DevicePushTokenType, DevicePushTokenStatus } from './models/Device.js';
export { ETHPulseLeafNotificationBaseModel } from './models/Notification.js';
