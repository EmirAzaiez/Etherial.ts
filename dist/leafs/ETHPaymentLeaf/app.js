var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import etherial from 'etherial';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { getProvider } from './providers/base.js';
import { BasePayment } from './models/Payment.js';
import { BaseSubscription } from './models/Subscription.js';
import { BasePaymentCustomer } from './models/Customer.js';
import { generateInvoice, generateCreditNote } from './services/invoice_generator.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
// Import providers to register them
import './providers/stripe';
import './providers/paypal';
// Re-export types and base models for consumers
export * from './providers/base.js';
export { BasePayment } from './models/Payment.js';
export { BaseSubscription } from './models/Subscription.js';
export { BasePaymentCustomer } from './models/Customer.js';
// ============================================
// Custom Errors
// ============================================
export class ProviderNotFoundError extends Error {
    constructor(providerName) {
        super(`Provider "${providerName}" not found`);
        this.code = 'PROVIDER_NOT_FOUND';
        this.name = 'ProviderNotFoundError';
    }
}
export class ProviderNotEnabledError extends Error {
    constructor(providerName) {
        super(`Provider "${providerName}" is configured but not enabled`);
        this.code = 'PROVIDER_NOT_ENABLED';
        this.name = 'ProviderNotEnabledError';
    }
}
export default class EthPaymentLeaf {
    constructor(config) {
        var _a, _b;
        this.etherial_module_name = 'eth_payment_leaf';
        this.routes = [];
        this.providers = new Map();
        this.config = config;
        if (((_b = (_a = config.routes) === null || _a === void 0 ? void 0 : _a.payments) === null || _b === void 0 ? void 0 : _b.length) > 0) {
            this.routes.push({
                route: path.join(__dirname, 'routes/payments'),
                methods: config.routes.payments
            });
        }
    }
    beforeRun(_a) {
        return __awaiter(this, arguments, void 0, function* ({ database }) {
            // Verify ETHMediaLeaf is registered (mandatory dependency)
            if (!etherial.eth_media_leaf) {
                throw new Error('[ETHPaymentLeaf] ETHMediaLeaf is required. Please register eth_media_leaf in your Config.ts before eth_payment_leaf.');
            }
            // Initialize enabled providers
            for (const [name, providerConfig] of Object.entries(this.config.providers)) {
                if (!providerConfig.enabled)
                    continue;
                const ProviderClass = getProvider(name);
                if (!ProviderClass) {
                    console.warn(`[ETHPaymentLeaf] Unknown provider: ${name}`);
                    continue;
                }
                const provider = new ProviderClass();
                yield provider.initialize(providerConfig.config);
                this.providers.set(name, provider);
                console.log(`[ETHPaymentLeaf] Initialized provider: ${name}`);
            }
            if (this.providers.size === 0) {
                console.warn('[ETHPaymentLeaf] No payment providers enabled!');
            }
        });
    }
    run({ http }) {
        var _a;
        (_a = http === null || http === void 0 ? void 0 : http.routes_leafs) === null || _a === void 0 ? void 0 : _a.push(...this.routes);
    }
    // ==================== Webhook Callback Setters ====================
    // Set these in your app.ts run() method, just like setCustomAuthentificationChecker
    /**
     * Called when a payment succeeds (via webhook)
     */
    onPaymentCompleted(fn) {
        this._onPaymentCompleted = fn;
    }
    /**
     * Called when a subscription status changes (via webhook)
     */
    onSubscriptionUpdated(fn) {
        this._onSubscriptionUpdated = fn;
    }
    /**
     * Called when a payment fails (via webhook)
     */
    onPaymentFailed(fn) {
        this._onPaymentFailed = fn;
    }
    /**
     * Called when a refund is created (via webhook)
     */
    onRefundCreated(fn) {
        this._onRefundCreated = fn;
    }
    /** @internal — used by routes */
    get callbacks() {
        return {
            onPaymentCompleted: this._onPaymentCompleted,
            onSubscriptionUpdated: this._onSubscriptionUpdated,
            onPaymentFailed: this._onPaymentFailed,
            onRefundCreated: this._onRefundCreated
        };
    }
    // ==================== Dynamic Model Access ====================
    // Uses sequelize.models to find the consumer's concrete models at runtime
    /** Get the Payment model (consumer's concrete class) */
    get Payment() {
        var _a, _b, _c;
        return ((_c = (_b = (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize) === null || _b === void 0 ? void 0 : _b.models) === null || _c === void 0 ? void 0 : _c.Payment) || BasePayment;
    }
    /** Get the Subscription model (consumer's concrete class) */
    get Subscription() {
        var _a, _b, _c;
        return ((_c = (_b = (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize) === null || _b === void 0 ? void 0 : _b.models) === null || _c === void 0 ? void 0 : _c.Subscription) || BaseSubscription;
    }
    /** Get the PaymentCustomer model (consumer's concrete class) */
    get PaymentCustomer() {
        var _a, _b, _c;
        return ((_c = (_b = (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize) === null || _b === void 0 ? void 0 : _b.models) === null || _c === void 0 ? void 0 : _c.PaymentCustomer) || BasePaymentCustomer;
    }
    // ==================== Provider Access ====================
    /**
     * Get the default provider
     */
    getDefaultProvider() {
        const provider = this.providers.get(this.config.default_provider);
        if (!provider) {
            throw new Error(`Default provider "${this.config.default_provider}" not found or not enabled`);
        }
        return provider;
    }
    /**
     * Get a specific provider by name
     */
    getProvider(name) {
        return this.providers.get(name);
    }
    /**
     * Get a provider or throw an error if not found/enabled
     */
    getProviderOrThrow(name) {
        const providerName = name || this.config.default_provider;
        const provider = this.providers.get(providerName);
        if (!provider) {
            const isConfigured = this.config.providers[providerName] !== undefined;
            if (isConfigured && !this.config.providers[providerName].enabled) {
                throw new ProviderNotEnabledError(providerName);
            }
            throw new ProviderNotFoundError(providerName);
        }
        return provider;
    }
    /**
     * Check if a provider is enabled
     */
    isProviderEnabled(name) {
        return this.providers.has(name);
    }
    /**
     * Validate that a provider exists and is enabled
     * Returns an error object if invalid, null if valid
     */
    validateProvider(name) {
        const providerName = name || this.config.default_provider;
        if (!this.providers.has(providerName)) {
            const isConfigured = this.config.providers[providerName] !== undefined;
            if (isConfigured && !this.config.providers[providerName].enabled) {
                return {
                    error: `Provider "${providerName}" is configured but not enabled`,
                    code: 'PROVIDER_NOT_ENABLED'
                };
            }
            return {
                error: `Provider "${providerName}" not found. Available: ${this.getEnabledProviders().join(', ') || 'none'}`,
                code: 'PROVIDER_NOT_FOUND'
            };
        }
        return null;
    }
    /**
     * Get all enabled providers
     */
    getEnabledProviders() {
        return Array.from(this.providers.keys());
    }
    /**
     * Get webhook secret for a provider
     */
    getWebhookSecret(provider) {
        var _a;
        return (_a = this.config.providers[provider]) === null || _a === void 0 ? void 0 : _a.webhook_secret;
    }
    // ==================== Unified API (delegates to provider) ====================
    // --- Customers ---
    createCustomer(options, providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getProviderOrThrow(providerName).createCustomer(options);
        });
    }
    getCustomer(customerId, providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getProviderOrThrow(providerName).getCustomer(customerId);
        });
    }
    // --- Checkout ---
    createCheckout(options, providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getProviderOrThrow(providerName).createCheckout(options);
        });
    }
    getPayment(paymentId, providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getProviderOrThrow(providerName).getPayment(paymentId);
        });
    }
    // --- Subscriptions ---
    createSubscription(options, providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getProviderOrThrow(providerName).createSubscription(options);
        });
    }
    getSubscription(subscriptionId, providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getProviderOrThrow(providerName).getSubscription(subscriptionId);
        });
    }
    updateSubscription(subscriptionId, options, providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getProviderOrThrow(providerName).updateSubscription(subscriptionId, options);
        });
    }
    cancelSubscription(subscriptionId_1) {
        return __awaiter(this, arguments, void 0, function* (subscriptionId, immediate = false, providerName) {
            return this.getProviderOrThrow(providerName).cancelSubscription(subscriptionId, immediate);
        });
    }
    resumeSubscription(subscriptionId, providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getProviderOrThrow(providerName).resumeSubscription(subscriptionId);
        });
    }
    // --- Refunds ---
    refund(options, providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getProviderOrThrow(providerName).refund(options);
        });
    }
    // --- Payment Methods ---
    setupPaymentMethod(options, providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getProviderOrThrow(providerName).setupPaymentMethod(options);
        });
    }
    listPaymentMethods(customerId, providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getProviderOrThrow(providerName).listPaymentMethods(customerId);
        });
    }
    setDefaultPaymentMethod(customerId, paymentMethodId, providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getProviderOrThrow(providerName).setDefaultPaymentMethod(customerId, paymentMethodId);
        });
    }
    initMobileSetup(userId, email, name, providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            const provider = this.getProviderOrThrow(providerName);
            const providerKey = providerName || this.config.default_provider;
            if (!provider.initMobileSetup) {
                throw new Error(`Provider "${providerKey}" does not support mobile setup`);
            }
            const { customer } = yield this.getOrCreateCustomer(userId, email, name, providerKey);
            return provider.initMobileSetup(customer.id);
        });
    }
    // --- Mobile Payments ---
    /**
     * Initialize a mobile payment
     * Returns provider-specific data for the mobile SDK (Stripe or PayPal)
     */
    initMobilePayment(options, userId, email, name, providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            const provider = this.getProviderOrThrow(providerName);
            const providerKey = providerName || this.config.default_provider;
            // Get or create customer
            const { customer } = yield this.getOrCreateCustomer(userId, email, name, providerKey);
            // Initialize payment with provider
            const result = yield provider.initMobilePayment({
                customer_id: customer.id,
                amount: options.amount,
                currency: options.currency,
                metadata: Object.assign({ user_id: userId.toString() }, options.metadata),
                idempotency_key: options.idempotency_key
            });
            // Save to database
            const PaymentModel = this.Payment;
            const localPayment = yield PaymentModel.create({
                provider: providerKey,
                provider_payment_id: result.payment_id,
                provider_customer_id: customer.id,
                status: 'pending',
                amount: options.amount,
                currency: options.currency,
                metadata: options.metadata,
                user_id: userId
            });
            return Object.assign(Object.assign({}, result), { local_payment: localPayment });
        });
    }
    /**
     * Initialize a mobile subscription
     * Returns provider-specific data for the mobile SDK
     */
    initMobileSubscription(options, userId, email, name, providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            const provider = this.getProviderOrThrow(providerName);
            const providerKey = providerName || this.config.default_provider;
            // Get or create customer
            const { customer } = yield this.getOrCreateCustomer(userId, email, name, providerKey);
            // Initialize subscription with provider
            const result = yield provider.initMobileSubscription({
                customer_id: customer.id,
                price_id: options.price_id,
                trial_days: options.trial_days,
                metadata: Object.assign({ user_id: userId.toString() }, options.metadata),
                idempotency_key: options.idempotency_key
            });
            return result;
        });
    }
    /**
     * Confirm a mobile payment (mainly for PayPal)
     * For Stripe, this just checks the status (webhooks handle confirmation)
     */
    confirmMobilePayment(paymentId, providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            const provider = this.getProviderOrThrow(providerName);
            return provider.confirmMobilePayment({ payment_id: paymentId });
        });
    }
    // --- Database Helpers ---
    /**
     * Save a payment to the local database
     */
    savePayment(result, userId, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            const PaymentModel = this.Payment;
            const existing = yield PaymentModel.findOne({
                where: {
                    provider: result.provider,
                    provider_payment_id: result.id
                }
            });
            if (existing) {
                yield existing.update({
                    status: result.status,
                    amount_refunded: result.status === 'refunded' ? existing.amount : existing.amount_refunded,
                    paid_at: result.paid_at || existing.paid_at,
                    provider_data: result.raw
                });
                return existing;
            }
            return PaymentModel.create({
                provider: result.provider,
                provider_payment_id: result.id,
                provider_customer_id: result.customer_id,
                status: result.status,
                amount: result.amount.amount,
                currency: result.amount.currency,
                customer_email: result.customer_email,
                metadata: Object.assign(Object.assign({}, result.metadata), metadata),
                provider_data: result.raw,
                paid_at: result.paid_at,
                user_id: userId
            });
        });
    }
    /**
     * Save a subscription to the local database
     */
    saveSubscription(result, userId, planName) {
        return __awaiter(this, void 0, void 0, function* () {
            const SubscriptionModel = this.Subscription;
            const existing = yield SubscriptionModel.findOne({
                where: {
                    provider: result.provider,
                    provider_subscription_id: result.id
                }
            });
            if (existing) {
                yield existing.update({
                    status: result.status,
                    current_period_start: result.current_period_start,
                    current_period_end: result.current_period_end,
                    cancel_at_period_end: result.cancel_at_period_end,
                    cancelled_at: result.cancelled_at,
                    provider_data: result.raw
                });
                return existing;
            }
            return SubscriptionModel.create({
                provider: result.provider,
                provider_subscription_id: result.id,
                provider_customer_id: result.customer_id,
                provider_price_id: result.price_id,
                plan_name: planName,
                status: result.status,
                current_period_start: result.current_period_start,
                current_period_end: result.current_period_end,
                cancel_at_period_end: result.cancel_at_period_end,
                cancelled_at: result.cancelled_at,
                trial_start: result.trial_start,
                trial_end: result.trial_end,
                metadata: result.metadata,
                provider_data: result.raw,
                user_id: userId
            });
        });
    }
    /**
     * Get or create a customer for a user
     */
    getOrCreateCustomer(userId, email, name, providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            const provider = providerName || this.config.default_provider;
            const CustomerModel = this.PaymentCustomer;
            // Check if we already have a customer for this user/provider
            let local = yield CustomerModel.findOne({
                where: { user_id: userId, provider }
            });
            if (local) {
                const customer = yield this.getCustomer(local.provider_customer_id, provider);
                if (customer) {
                    return { customer, local };
                }
                // Customer deleted in provider, create new one
            }
            // Create new customer
            const customer = yield this.createCustomer({ email, name }, provider);
            local = yield CustomerModel.findOrCreateForUser(userId, provider, customer.id, email, name);
            return { customer, local };
        });
    }
    // ==================== Invoice Generation ====================
    get mediaLeaf() {
        return etherial.eth_media_leaf;
    }
    uploadToS3(buffer, folder, fileName) {
        return __awaiter(this, void 0, void 0, function* () {
            const media = this.mediaLeaf;
            const key = `${folder}/${fileName}`;
            yield media.s3.send(new PutObjectCommand({
                Bucket: media.bucket,
                Key: key,
                Body: buffer,
                ContentType: 'application/pdf',
                ACL: 'public-read'
            }));
            if (media.config.cdn_url) {
                return `${media.config.cdn_url.replace(/\/$/, '')}/${key}`;
            }
            const endpoint = media.config.server.replace(/\/$/, '');
            return `${endpoint}/${media.bucket}/${key}`;
        });
    }
    getInvoiceNumber(paymentId) {
        var _a;
        const prefix = ((_a = this.config.invoices) === null || _a === void 0 ? void 0 : _a.number_prefix) || 'INV';
        const year = new Date().getFullYear();
        return `${prefix}-${year}-${String(paymentId).padStart(6, '0')}`;
    }
    getCreditNoteNumber(paymentId) {
        var _a;
        const prefix = ((_a = this.config.invoices) === null || _a === void 0 ? void 0 : _a.credit_note_prefix) || 'CN';
        const year = new Date().getFullYear();
        return `${prefix}-${year}-${String(paymentId).padStart(6, '0')}`;
    }
    generateInvoiceForPayment(localPayment, paymentResult) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const invoiceConfig = this.config.invoices;
            const s3Folder = (invoiceConfig === null || invoiceConfig === void 0 ? void 0 : invoiceConfig.s3_folder) || 'payment-invoices';
            const data = {
                invoice_number: this.getInvoiceNumber(localPayment.id),
                date: localPayment.paid_at || new Date(),
                customer_email: localPayment.customer_email || paymentResult.customer_email || '',
                customer_name: (_a = paymentResult.metadata) === null || _a === void 0 ? void 0 : _a.customer_name,
                amount: localPayment.amount,
                currency: localPayment.currency,
                payment_method: (_b = paymentResult.metadata) === null || _b === void 0 ? void 0 : _b.payment_method,
                provider: localPayment.provider,
                status: localPayment.status,
                metadata: localPayment.metadata,
                company: invoiceConfig === null || invoiceConfig === void 0 ? void 0 : invoiceConfig.company,
                locale: (invoiceConfig === null || invoiceConfig === void 0 ? void 0 : invoiceConfig.locale) || 'fr'
            };
            const pdfBuffer = yield generateInvoice(data, (_c = invoiceConfig === null || invoiceConfig === void 0 ? void 0 : invoiceConfig.templates) === null || _c === void 0 ? void 0 : _c.invoice);
            const fileName = `${data.invoice_number}.pdf`;
            const url = yield this.uploadToS3(pdfBuffer, s3Folder, fileName);
            yield localPayment.update({ invoice_url: url });
            console.log(`[ETHPaymentLeaf] Invoice generated: ${data.invoice_number} → ${url}`);
            return url;
        });
    }
    generateCreditNoteForPayment(localPayment, refundResult) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const invoiceConfig = this.config.invoices;
            const s3Folder = (invoiceConfig === null || invoiceConfig === void 0 ? void 0 : invoiceConfig.s3_folder) || 'payment-invoices';
            const data = {
                credit_note_number: this.getCreditNoteNumber(localPayment.id),
                date: new Date(),
                original_invoice_number: localPayment.invoice_url ? this.getInvoiceNumber(localPayment.id) : undefined,
                customer_email: localPayment.customer_email || '',
                customer_name: (_a = localPayment.metadata) === null || _a === void 0 ? void 0 : _a.customer_name,
                amount: refundResult.amount.amount,
                currency: refundResult.amount.currency,
                reason: refundResult.reason,
                provider: localPayment.provider,
                company: invoiceConfig === null || invoiceConfig === void 0 ? void 0 : invoiceConfig.company,
                locale: (invoiceConfig === null || invoiceConfig === void 0 ? void 0 : invoiceConfig.locale) || 'fr'
            };
            const pdfBuffer = yield generateCreditNote(data, (_b = invoiceConfig === null || invoiceConfig === void 0 ? void 0 : invoiceConfig.templates) === null || _b === void 0 ? void 0 : _b.credit_note);
            const fileName = `${data.credit_note_number}.pdf`;
            const url = yield this.uploadToS3(pdfBuffer, s3Folder, fileName);
            yield localPayment.update({ credit_note_url: url });
            console.log(`[ETHPaymentLeaf] Credit note generated: ${data.credit_note_number} → ${url}`);
            return url;
        });
    }
    // ==================== Commands ====================
    commands() {
        return [
            {
                command: 'providers',
                description: 'List enabled payment providers',
                action: () => __awaiter(this, void 0, void 0, function* () {
                    const providers = this.getEnabledProviders();
                    return {
                        success: true,
                        message: `Enabled providers: ${providers.join(', ') || 'none'}`,
                        data: providers
                    };
                })
            },
            {
                command: 'publish:invoice-templates',
                description: 'Copy default invoice templates to resources/pdf-templates/ for customization.',
                action: () => __awaiter(this, void 0, void 0, function* () {
                    const srcDir = path.join(__dirname, 'templates');
                    const destDir = path.resolve(process.cwd(), 'resources/pdf-templates');
                    if (!fs.existsSync(destDir)) {
                        fs.mkdirSync(destDir, { recursive: true });
                    }
                    const templates = [
                        { src: 'invoice.ejs', dest: 'invoice.ejs' },
                        { src: 'credit_note.ejs', dest: 'credit_note.ejs' }
                    ];
                    const results = [];
                    for (const tpl of templates) {
                        const destPath = path.join(destDir, tpl.dest);
                        if (fs.existsSync(destPath)) {
                            results.push(`⚠ ${tpl.dest} already exists, skipped (delete it first to overwrite)`);
                            continue;
                        }
                        fs.copyFileSync(path.join(srcDir, tpl.src), destPath);
                        results.push(`✓ ${tpl.dest} → ${destPath}`);
                    }
                    return {
                        success: true,
                        message: [
                            'Invoice templates published to resources/pdf-templates/',
                            ...results,
                            '',
                            'To use them, add to your config:',
                            '  invoices: {',
                            '    templates: {',
                            "      invoice: path.join(__dirname, '../resources/pdf-templates/invoice.ejs'),",
                            "      credit_note: path.join(__dirname, '../resources/pdf-templates/credit_note.ejs'),",
                            '    }',
                            '  }'
                        ].join('\n')
                    };
                })
            }
        ];
    }
}
export const AvailableRouteMethods = {
    payments: [
        'createCheckout', // POST /payments/checkout
        'getPayment', // GET /payments/:id
        'createSubscription', // POST /payments/subscriptions
        'getSubscription', // GET /payments/subscriptions/:id
        'cancelSubscription', // DELETE /payments/subscriptions/:id
        'resumeSubscription', // POST /payments/subscriptions/:id/resume
        'refundPayment', // POST /payments/:id/refund
        'setupPaymentMethod', // POST /payments/methods/setup
        'listPaymentMethods', // GET /payments/methods
        'deletePaymentMethod', // DELETE /payments/methods/:id
        'setDefaultPaymentMethod', // PUT /payments/methods/:id/default
        'webhook', // POST /payments/webhooks/:provider
        // Mobile
        'initMobilePayment', // POST /payments/mobile/init
        'initMobileSubscription', // POST /payments/mobile/subscription
        'confirmMobilePayment', // POST /payments/mobile/confirm
        'initMobileSetup', // POST /payments/mobile/setup
        // Invoices
        'getInvoice', // GET /payments/:id/invoice
        'getCreditNote' // GET /payments/:id/credit-note
    ]
};
