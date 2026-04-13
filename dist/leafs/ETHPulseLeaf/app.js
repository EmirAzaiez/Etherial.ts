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
import { NodemailerProvider, GmailOAuthProvider } from './providers/email/index.js';
import { ExpoProvider } from './providers/push/index.js';
// Services
import { SmsService } from './services/sms.service.js';
import { EmailService } from './services/email.service.js';
import { PushService } from './services/push.service.js';
// Seeds
import { getDefaultContent } from './seeds/email-template-defaults.js';
import { UnifonicProvider } from './providers/sms/UnifonicProvider.js';
/**
 * ETHPulseLeaf - Unified Messaging System
 *
 * Handles SMS, Email, and Push Notifications with a provider-based architecture.
 */
export default class ETHPulseLeaf {
    constructor(config) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        this.etherial_module_name = 'eth_pulse_leaf';
        this.smsProviders = new Map();
        this.emailProviders = new Map();
        this.pushProviders = new Map();
        this.routes = [];
        this.config = config;
        // Initialize SMS providers
        if ((_a = config.sms) === null || _a === void 0 ? void 0 : _a.providers) {
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
        if ((_b = config.email) === null || _b === void 0 ? void 0 : _b.providers) {
            if (!((_c = config.email.template) === null || _c === void 0 ? void 0 : _c.path)) {
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
                else if (name === 'gmail_oauth') {
                    this.emailProviders.set(name, new GmailOAuthProvider(providerConfig, config.email.template));
                }
                // Add more Email providers here as needed
            }
        }
        // Initialize Push providers
        if ((_d = config.push) === null || _d === void 0 ? void 0 : _d.providers) {
            for (const [name, providerConfig] of Object.entries(config.push.providers)) {
                if (name === 'expo') {
                    this.pushProviders.set(name, new ExpoProvider(providerConfig));
                }
                // Add more Push providers here as needed
            }
        }
        // Initialize services
        if (this.smsProviders.size > 0) {
            const defaultSmsProvider = ((_e = config.sms) === null || _e === void 0 ? void 0 : _e.default) || this.smsProviders.keys().next().value;
            this._smsService = new SmsService(this.smsProviders, defaultSmsProvider);
        }
        if (this.emailProviders.size > 0) {
            const defaultEmailProvider = ((_f = config.email) === null || _f === void 0 ? void 0 : _f.default) || this.emailProviders.keys().next().value;
            this._emailService = new EmailService(this.emailProviders, defaultEmailProvider);
        }
        if (this.pushProviders.size > 0) {
            const defaultPushProvider = ((_g = config.push) === null || _g === void 0 ? void 0 : _g.default) || this.pushProviders.keys().next().value;
            this._pushService = new PushService(this.pushProviders, defaultPushProvider);
        }
        // Initialize device routes
        if (((_h = config.routes) === null || _h === void 0 ? void 0 : _h.devices) && config.routes.devices.length > 0) {
            this.routes.push({ route: path.join(__dirname, 'routes/devices'), methods: config.routes.devices });
        }
        // Register email template sync route (always available when templates are configured)
        if ((_j = config.email) === null || _j === void 0 ? void 0 : _j.templates) {
            this.routes.push({
                route: path.join(__dirname, 'routes/email-templates-sync'),
                methods: ['getSync', 'createMissing', 'removeOrphan'],
            });
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
                description: 'Install email templates: copy EJS files + seed database with declared templates for all configured locales',
                action: () => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b;
                    // ── Step 1: Copy EJS template files ──
                    const sourceDir = this.getTemplatesSourcePath();
                    const targetDir = path.join(process.cwd(), 'resources', 'emails');
                    if (!fs.existsSync(sourceDir)) {
                        console.error(`[ETHPulseLeaf] Source templates not found at: ${sourceDir}`);
                        return { success: false, message: 'Source templates not found' };
                    }
                    if (fs.existsSync(targetDir)) {
                        console.log(`[ETHPulseLeaf] Templates directory already exists — overwriting...`);
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
                    console.log(`[ETHPulseLeaf] EJS templates installed to: ${targetDir}`);
                    for (const f of files) {
                        console.log(`    ${f}`);
                    }
                    // ── Step 2: Seed database with email templates ──
                    const templatesConfig = (_a = this.config.email) === null || _a === void 0 ? void 0 : _a.templates;
                    if (!templatesConfig || Object.keys(templatesConfig.emails).length === 0) {
                        console.log('\n[ETHPulseLeaf] No email templates declared in config — skipping database seed.');
                        console.log('  Set your config: email.template.path = path.join(process.cwd(), \'resources/emails\')');
                        return { success: true, message: `Installed ${files.length} template files (no DB seed)` };
                    }
                    const etherial_import = (yield import('etherial')).default;
                    const EmailTemplate = (_b = etherial_import.database) === null || _b === void 0 ? void 0 : _b.sequelize.models.EmailTemplate;
                    if (!EmailTemplate) {
                        console.log('\n[ETHPulseLeaf] EmailTemplate model not found — skipping database seed.');
                        console.log('  Make sure you have an EmailTemplate model extending BaseEmailTemplate.');
                        return { success: true, message: `Installed ${files.length} template files (no DB seed)` };
                    }
                    const locales = templatesConfig.locales;
                    const keys = Object.keys(templatesConfig.emails);
                    let created = 0;
                    let skipped = 0;
                    console.log(`\n[ETHPulseLeaf] Seeding email templates (${locales.join(', ')})...\n`);
                    for (const key of keys) {
                        const expectedVars = templatesConfig.emails[key];
                        for (const locale of locales) {
                            const existing = yield EmailTemplate.findOne({ where: { key, locale } });
                            if (existing) {
                                console.log(`  [skip] ${key} (${locale}) — already exists`);
                                skipped++;
                                continue;
                            }
                            const content = getDefaultContent(key, locale);
                            yield EmailTemplate.create({
                                key,
                                locale,
                                subject: content.subject,
                                title: content.title || null,
                                greeting: content.greeting || null,
                                body: content.body,
                                button_text: content.button_text || null,
                                button_url: content.button_url || null,
                                footer: content.footer || null,
                                enabled: true,
                            });
                            console.log(`  [created] ${key} (${locale})`);
                            if (expectedVars.length > 0) {
                                console.log(`            variables: {{${expectedVars.join('}}, {{')}}}`);
                            }
                            created++;
                        }
                    }
                    console.log(`\n[ETHPulseLeaf] Done: ${files.length} files, ${created} templates created, ${skipped} skipped`);
                    console.log(`  Customize content from the admin panel (Email Templates) or directly in the database.`);
                    return { success: true, message: `${files.length} files, ${created} created, ${skipped} skipped` };
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
export { BaseEmailTemplate, EmailTemplate } from './models/EmailTemplate.js';
export { registerPulseCollections } from './admin/features.js';
