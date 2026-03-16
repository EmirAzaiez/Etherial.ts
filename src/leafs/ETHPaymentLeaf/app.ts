import etherial, { Etherial } from 'etherial'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

import {
    PaymentProvider,
    getProvider,
    CreateCustomerOptions,
    CustomerResult,
    CreateCheckoutOptions,
    CheckoutResult,
    PaymentResult,
    CreateSubscriptionOptions,
    SubscriptionResult,
    UpdateSubscriptionOptions,
    RefundOptions,
    RefundResult,
    SetupPaymentMethodOptions,
    SetupPaymentMethodResult,
    PaymentMethodResult,
    MobileSetupResult,
    WebhookEvent,
    MobilePaymentInitOptions,
    MobilePaymentInitResult,
    MobileSubscriptionInitOptions,
    MobilePaymentConfirmOptions,
    MobilePaymentConfirmResult,
    Currency
} from './providers/base.js'

import { BasePayment } from './models/Payment.js'
import { BaseSubscription } from './models/Subscription.js'
import { BasePaymentCustomer } from './models/Customer.js'
import { generateInvoice, generateCreditNote, InvoiceData, CreditNoteData, InvoiceCompanyInfo } from './services/invoice_generator.js'
import { PutObjectCommand } from '@aws-sdk/client-s3'

// Import providers to register them
import './providers/stripe'
import './providers/paypal'

// Re-export types and base models for consumers
export * from './providers/base.js'
export { BasePayment } from './models/Payment.js'
export { BaseSubscription } from './models/Subscription.js'
export { BasePaymentCustomer } from './models/Customer.js'

// ============================================
// Custom Errors
// ============================================

export class ProviderNotFoundError extends Error {
    code = 'PROVIDER_NOT_FOUND'
    constructor(providerName: string) {
        super(`Provider "${providerName}" not found`)
        this.name = 'ProviderNotFoundError'
    }
}

export class ProviderNotEnabledError extends Error {
    code = 'PROVIDER_NOT_ENABLED'
    constructor(providerName: string) {
        super(`Provider "${providerName}" is configured but not enabled`)
        this.name = 'ProviderNotEnabledError'
    }
}

export interface ProviderConfig {
    enabled: boolean
    config: Record<string, any>
    webhook_secret?: string
}

export interface ETHPaymentLeafConfig {
    /**
     * Default provider to use when not specified
     */
    default_provider: string

    /**
     * Provider configurations.
     * Only providers with `enabled: true` will be initialized.
     * You can configure providers without enabling them.
     */
    providers: {
        [providerName: string]: ProviderConfig
    }

    /**
     * Routes to enable
     */
    routes: {
        payments: PaymentMethods[]
    }

    /**
     * Invoice generation configuration (optional)
     */
    invoices?: {
        enabled: boolean
        s3_folder?: string
        number_prefix?: string
        credit_note_prefix?: string
        locale?: 'fr' | 'en'
        company?: InvoiceCompanyInfo
        /**
         * Custom EJS template paths. If not provided, the leaf's default templates are used.
         * Paths should be absolute (use path.join(__dirname, ...)).
         */
        templates?: {
            invoice?: string
            credit_note?: string
        }
    }
}

// ============================================
// Webhook callback types
// ============================================

type OnPaymentCompletedCallback = (payment: PaymentResult, localPayment: BasePayment) => Promise<void> | void
type OnSubscriptionUpdatedCallback = (subscription: SubscriptionResult, localSubscription: BaseSubscription) => Promise<void> | void
type OnPaymentFailedCallback = (payment: PaymentResult, localPayment: BasePayment | null) => Promise<void> | void
type OnRefundCreatedCallback = (refund: RefundResult, localPayment: BasePayment | null) => Promise<void> | void

export default class EthPaymentLeaf {
    etherial_module_name = 'eth_payment_leaf'

    private routes: { route: string; methods: string[] }[] = []
    private providers: Map<string, PaymentProvider> = new Map()
    config: ETHPaymentLeafConfig

    // Webhook callbacks — set via setter methods in app.ts
    private _onPaymentCompleted?: OnPaymentCompletedCallback
    private _onSubscriptionUpdated?: OnSubscriptionUpdatedCallback
    private _onPaymentFailed?: OnPaymentFailedCallback
    private _onRefundCreated?: OnRefundCreatedCallback

    constructor(config: ETHPaymentLeafConfig) {
        this.config = config

        if (config.routes?.payments?.length > 0) {
            this.routes.push({
                route: path.join(__dirname, 'routes/payments'),
                methods: config.routes.payments
            })
        }
    }

    async beforeRun({ database }: Etherial): Promise<void> {
        // Verify ETHMediaLeaf is registered (mandatory dependency)
        if (!(etherial as any).eth_media_leaf) {
            throw new Error('[ETHPaymentLeaf] ETHMediaLeaf is required. Please register eth_media_leaf in your Config.ts before eth_payment_leaf.')
        }

        // Initialize enabled providers
        for (const [name, providerConfig] of Object.entries(this.config.providers)) {
            if (!providerConfig.enabled) continue

            const ProviderClass = getProvider(name)
            if (!ProviderClass) {
                console.warn(`[ETHPaymentLeaf] Unknown provider: ${name}`)
                continue
            }

            const provider = new ProviderClass()
            await provider.initialize(providerConfig.config)
            this.providers.set(name, provider)

            console.log(`[ETHPaymentLeaf] Initialized provider: ${name}`)
        }

        if (this.providers.size === 0) {
            console.warn('[ETHPaymentLeaf] No payment providers enabled!')
        }
    }

    run({ http }: Etherial): void {
        http?.routes_leafs?.push(...this.routes)
    }

    // ==================== Webhook Callback Setters ====================
    // Set these in your app.ts run() method, just like setCustomAuthentificationChecker

    /**
     * Called when a payment succeeds (via webhook)
     */
    onPaymentCompleted(fn: OnPaymentCompletedCallback): void {
        this._onPaymentCompleted = fn
    }

    /**
     * Called when a subscription status changes (via webhook)
     */
    onSubscriptionUpdated(fn: OnSubscriptionUpdatedCallback): void {
        this._onSubscriptionUpdated = fn
    }

    /**
     * Called when a payment fails (via webhook)
     */
    onPaymentFailed(fn: OnPaymentFailedCallback): void {
        this._onPaymentFailed = fn
    }

    /**
     * Called when a refund is created (via webhook)
     */
    onRefundCreated(fn: OnRefundCreatedCallback): void {
        this._onRefundCreated = fn
    }

    /** @internal — used by routes */
    get callbacks() {
        return {
            onPaymentCompleted: this._onPaymentCompleted,
            onSubscriptionUpdated: this._onSubscriptionUpdated,
            onPaymentFailed: this._onPaymentFailed,
            onRefundCreated: this._onRefundCreated
        }
    }

    // ==================== Dynamic Model Access ====================
    // Uses sequelize.models to find the consumer's concrete models at runtime

    /** Get the Payment model (consumer's concrete class) */
    get Payment(): typeof BasePayment {
        return (etherial as any).database?.sequelize?.models?.Payment || BasePayment
    }

    /** Get the Subscription model (consumer's concrete class) */
    get Subscription(): typeof BaseSubscription {
        return (etherial as any).database?.sequelize?.models?.Subscription || BaseSubscription
    }

    /** Get the PaymentCustomer model (consumer's concrete class) */
    get PaymentCustomer(): typeof BasePaymentCustomer {
        return (etherial as any).database?.sequelize?.models?.PaymentCustomer || BasePaymentCustomer
    }

    // ==================== Provider Access ====================

    /**
     * Get the default provider
     */
    getDefaultProvider(): PaymentProvider {
        const provider = this.providers.get(this.config.default_provider)
        if (!provider) {
            throw new Error(`Default provider "${this.config.default_provider}" not found or not enabled`)
        }
        return provider
    }

    /**
     * Get a specific provider by name
     */
    getProvider(name: string): PaymentProvider | undefined {
        return this.providers.get(name)
    }

    /**
     * Get a provider or throw an error if not found/enabled
     */
    getProviderOrThrow(name?: string): PaymentProvider {
        const providerName = name || this.config.default_provider
        const provider = this.providers.get(providerName)

        if (!provider) {
            const isConfigured = this.config.providers[providerName] !== undefined
            if (isConfigured && !this.config.providers[providerName].enabled) {
                throw new ProviderNotEnabledError(providerName)
            }
            throw new ProviderNotFoundError(providerName)
        }

        return provider
    }

    /**
     * Check if a provider is enabled
     */
    isProviderEnabled(name: string): boolean {
        return this.providers.has(name)
    }

    /**
     * Validate that a provider exists and is enabled
     * Returns an error object if invalid, null if valid
     */
    validateProvider(name?: string): { error: string; code: string } | null {
        const providerName = name || this.config.default_provider

        if (!this.providers.has(providerName)) {
            const isConfigured = this.config.providers[providerName] !== undefined

            if (isConfigured && !this.config.providers[providerName].enabled) {
                return {
                    error: `Provider "${providerName}" is configured but not enabled`,
                    code: 'PROVIDER_NOT_ENABLED'
                }
            }

            return {
                error: `Provider "${providerName}" not found. Available: ${this.getEnabledProviders().join(', ') || 'none'}`,
                code: 'PROVIDER_NOT_FOUND'
            }
        }

        return null
    }

    /**
     * Get all enabled providers
     */
    getEnabledProviders(): string[] {
        return Array.from(this.providers.keys())
    }

    /**
     * Get webhook secret for a provider
     */
    getWebhookSecret(provider: string): string | undefined {
        return this.config.providers[provider]?.webhook_secret
    }

    // ==================== Unified API (delegates to provider) ====================

    // --- Customers ---

    async createCustomer(options: CreateCustomerOptions, providerName?: string): Promise<CustomerResult> {
        return this.getProviderOrThrow(providerName).createCustomer(options)
    }

    async getCustomer(customerId: string, providerName?: string): Promise<CustomerResult | null> {
        return this.getProviderOrThrow(providerName).getCustomer(customerId)
    }

    // --- Checkout ---

    async createCheckout(options: CreateCheckoutOptions, providerName?: string): Promise<CheckoutResult> {
        return this.getProviderOrThrow(providerName).createCheckout(options)
    }

    async getPayment(paymentId: string, providerName?: string): Promise<PaymentResult | null> {
        return this.getProviderOrThrow(providerName).getPayment(paymentId)
    }

    // --- Subscriptions ---

    async createSubscription(options: CreateSubscriptionOptions, providerName?: string): Promise<SubscriptionResult> {
        return this.getProviderOrThrow(providerName).createSubscription(options)
    }

    async getSubscription(subscriptionId: string, providerName?: string): Promise<SubscriptionResult | null> {
        return this.getProviderOrThrow(providerName).getSubscription(subscriptionId)
    }

    async updateSubscription(subscriptionId: string, options: UpdateSubscriptionOptions, providerName?: string): Promise<SubscriptionResult> {
        return this.getProviderOrThrow(providerName).updateSubscription(subscriptionId, options)
    }

    async cancelSubscription(subscriptionId: string, immediate = false, providerName?: string): Promise<SubscriptionResult> {
        return this.getProviderOrThrow(providerName).cancelSubscription(subscriptionId, immediate)
    }

    async resumeSubscription(subscriptionId: string, providerName?: string): Promise<SubscriptionResult> {
        return this.getProviderOrThrow(providerName).resumeSubscription(subscriptionId)
    }

    // --- Refunds ---

    async refund(options: RefundOptions, providerName?: string): Promise<RefundResult> {
        return this.getProviderOrThrow(providerName).refund(options)
    }

    // --- Payment Methods ---

    async setupPaymentMethod(options: SetupPaymentMethodOptions, providerName?: string): Promise<SetupPaymentMethodResult> {
        return this.getProviderOrThrow(providerName).setupPaymentMethod(options)
    }

    async listPaymentMethods(customerId: string, providerName?: string): Promise<PaymentMethodResult[]> {
        return this.getProviderOrThrow(providerName).listPaymentMethods(customerId)
    }

    async setDefaultPaymentMethod(customerId: string, paymentMethodId: string, providerName?: string): Promise<void> {
        return this.getProviderOrThrow(providerName).setDefaultPaymentMethod(customerId, paymentMethodId)
    }

    async initMobileSetup(userId: number, email: string, name?: string, providerName?: string): Promise<MobileSetupResult> {
        const provider = this.getProviderOrThrow(providerName)
        const providerKey = providerName || this.config.default_provider

        if (!provider.initMobileSetup) {
            throw new Error(`Provider "${providerKey}" does not support mobile setup`)
        }

        const { customer } = await this.getOrCreateCustomer(userId, email, name, providerKey)
        return provider.initMobileSetup(customer.id)
    }

    // --- Mobile Payments ---

    /**
     * Initialize a mobile payment
     * Returns provider-specific data for the mobile SDK (Stripe or PayPal)
     */
    async initMobilePayment(
        options: { amount: number; currency: Currency; metadata?: Record<string, string>; idempotency_key?: string },
        userId: number,
        email: string,
        name?: string,
        providerName?: string
    ): Promise<MobilePaymentInitResult & { local_payment: BasePayment }> {
        const provider = this.getProviderOrThrow(providerName)
        const providerKey = providerName || this.config.default_provider

        // Get or create customer
        const { customer } = await this.getOrCreateCustomer(userId, email, name, providerKey)

        // Initialize payment with provider
        const result = await provider.initMobilePayment({
            customer_id: customer.id,
            amount: options.amount,
            currency: options.currency,
            metadata: {
                user_id: userId.toString(),
                ...options.metadata
            },
            idempotency_key: options.idempotency_key
        })

        // Save to database
        const PaymentModel = this.Payment as any
        const localPayment = await PaymentModel.create({
            provider: providerKey,
            provider_payment_id: result.payment_id,
            provider_customer_id: customer.id,
            status: 'pending',
            amount: options.amount,
            currency: options.currency,
            metadata: options.metadata,
            user_id: userId
        })

        return { ...result, local_payment: localPayment }
    }

    /**
     * Initialize a mobile subscription
     * Returns provider-specific data for the mobile SDK
     */
    async initMobileSubscription(
        options: { price_id: string; trial_days?: number; metadata?: Record<string, string>; idempotency_key?: string },
        userId: number,
        email: string,
        name?: string,
        providerName?: string
    ): Promise<MobilePaymentInitResult & { local_subscription?: BaseSubscription }> {
        const provider = this.getProviderOrThrow(providerName)
        const providerKey = providerName || this.config.default_provider

        // Get or create customer
        const { customer } = await this.getOrCreateCustomer(userId, email, name, providerKey)

        // Initialize subscription with provider
        const result = await provider.initMobileSubscription({
            customer_id: customer.id,
            price_id: options.price_id,
            trial_days: options.trial_days,
            metadata: {
                user_id: userId.toString(),
                ...options.metadata
            },
            idempotency_key: options.idempotency_key
        })

        return result
    }

    /**
     * Confirm a mobile payment (mainly for PayPal)
     * For Stripe, this just checks the status (webhooks handle confirmation)
     */
    async confirmMobilePayment(paymentId: string, providerName?: string): Promise<MobilePaymentConfirmResult> {
        const provider = this.getProviderOrThrow(providerName)
        return provider.confirmMobilePayment({ payment_id: paymentId })
    }

    // --- Database Helpers ---

    /**
     * Save a payment to the local database
     */
    async savePayment(result: PaymentResult, userId?: number, metadata?: Record<string, any>): Promise<BasePayment> {
        const PaymentModel = this.Payment as any

        const existing = await PaymentModel.findOne({
            where: {
                provider: result.provider,
                provider_payment_id: result.id
            }
        })

        if (existing) {
            await existing.update({
                status: result.status,
                amount_refunded: result.status === 'refunded' ? existing.amount : existing.amount_refunded,
                paid_at: result.paid_at || existing.paid_at,
                provider_data: result.raw
            })
            return existing
        }

        return PaymentModel.create({
            provider: result.provider,
            provider_payment_id: result.id,
            provider_customer_id: result.customer_id,
            status: result.status,
            amount: result.amount.amount,
            currency: result.amount.currency,
            customer_email: result.customer_email,
            metadata: { ...result.metadata, ...metadata },
            provider_data: result.raw,
            paid_at: result.paid_at,
            user_id: userId
        })
    }

    /**
     * Save a subscription to the local database
     */
    async saveSubscription(result: SubscriptionResult, userId?: number, planName?: string): Promise<BaseSubscription> {
        const SubscriptionModel = this.Subscription as any

        const existing = await SubscriptionModel.findOne({
            where: {
                provider: result.provider,
                provider_subscription_id: result.id
            }
        })

        if (existing) {
            await existing.update({
                status: result.status,
                current_period_start: result.current_period_start,
                current_period_end: result.current_period_end,
                cancel_at_period_end: result.cancel_at_period_end,
                cancelled_at: result.cancelled_at,
                provider_data: result.raw
            })
            return existing
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
        })
    }

    /**
     * Get or create a customer for a user
     */
    async getOrCreateCustomer(userId: number, email: string, name?: string, providerName?: string): Promise<{ customer: CustomerResult; local: BasePaymentCustomer }> {
        const provider = providerName || this.config.default_provider
        const CustomerModel = this.PaymentCustomer as any

        // Check if we already have a customer for this user/provider
        let local = await CustomerModel.findOne({
            where: { user_id: userId, provider }
        })

        if (local) {
            const customer = await this.getCustomer(local.provider_customer_id, provider)
            if (customer) {
                return { customer, local }
            }
            // Customer deleted in provider, create new one
        }

        // Create new customer
        const customer = await this.createCustomer({ email, name }, provider)

        local = await CustomerModel.findOrCreateForUser(userId, provider, customer.id, email, name)

        return { customer, local }
    }

    // ==================== Invoice Generation ====================

    private get mediaLeaf() {
        return (etherial as any).eth_media_leaf
    }

    private async uploadToS3(buffer: Buffer, folder: string, fileName: string): Promise<string> {
        const media = this.mediaLeaf
        const key = `${folder}/${fileName}`

        await media.s3.send(
            new PutObjectCommand({
                Bucket: media.bucket,
                Key: key,
                Body: buffer,
                ContentType: 'application/pdf',
                ACL: 'public-read'
            })
        )

        if (media.config.cdn_url) {
            return `${media.config.cdn_url.replace(/\/$/, '')}/${key}`
        }
        const endpoint = media.config.server.replace(/\/$/, '')
        return `${endpoint}/${media.bucket}/${key}`
    }

    private getInvoiceNumber(paymentId: number): string {
        const prefix = this.config.invoices?.number_prefix || 'INV'
        const year = new Date().getFullYear()
        return `${prefix}-${year}-${String(paymentId).padStart(6, '0')}`
    }

    private getCreditNoteNumber(paymentId: number): string {
        const prefix = this.config.invoices?.credit_note_prefix || 'CN'
        const year = new Date().getFullYear()
        return `${prefix}-${year}-${String(paymentId).padStart(6, '0')}`
    }

    async generateInvoiceForPayment(localPayment: BasePayment, paymentResult: PaymentResult): Promise<string> {
        const invoiceConfig = this.config.invoices
        const s3Folder = invoiceConfig?.s3_folder || 'payment-invoices'

        const data: InvoiceData = {
            invoice_number: this.getInvoiceNumber(localPayment.id),
            date: localPayment.paid_at || new Date(),
            customer_email: localPayment.customer_email || paymentResult.customer_email || '',
            customer_name: paymentResult.metadata?.customer_name,
            amount: localPayment.amount,
            currency: localPayment.currency,
            payment_method: paymentResult.metadata?.payment_method,
            provider: localPayment.provider,
            status: localPayment.status,
            metadata: localPayment.metadata,
            company: invoiceConfig?.company,
            locale: invoiceConfig?.locale || 'fr'
        }

        const pdfBuffer = await generateInvoice(data, invoiceConfig?.templates?.invoice)
        const fileName = `${data.invoice_number}.pdf`
        const url = await this.uploadToS3(pdfBuffer, s3Folder, fileName)

        await localPayment.update({ invoice_url: url })
        console.log(`[ETHPaymentLeaf] Invoice generated: ${data.invoice_number} → ${url}`)

        return url
    }

    async generateCreditNoteForPayment(localPayment: BasePayment, refundResult: RefundResult): Promise<string> {
        const invoiceConfig = this.config.invoices
        const s3Folder = invoiceConfig?.s3_folder || 'payment-invoices'

        const data: CreditNoteData = {
            credit_note_number: this.getCreditNoteNumber(localPayment.id),
            date: new Date(),
            original_invoice_number: localPayment.invoice_url ? this.getInvoiceNumber(localPayment.id) : undefined,
            customer_email: localPayment.customer_email || '',
            customer_name: localPayment.metadata?.customer_name,
            amount: refundResult.amount.amount,
            currency: refundResult.amount.currency,
            reason: refundResult.reason,
            provider: localPayment.provider,
            company: invoiceConfig?.company,
            locale: invoiceConfig?.locale || 'fr'
        }

        const pdfBuffer = await generateCreditNote(data, invoiceConfig?.templates?.credit_note)
        const fileName = `${data.credit_note_number}.pdf`
        const url = await this.uploadToS3(pdfBuffer, s3Folder, fileName)

        await localPayment.update({ credit_note_url: url })
        console.log(`[ETHPaymentLeaf] Credit note generated: ${data.credit_note_number} → ${url}`)

        return url
    }

    // ==================== Commands ====================

    commands() {
        return [
            {
                command: 'providers',
                description: 'List enabled payment providers',
                action: async () => {
                    const providers = this.getEnabledProviders()
                    return {
                        success: true,
                        message: `Enabled providers: ${providers.join(', ') || 'none'}`,
                        data: providers
                    }
                }
            },
            {
                command: 'publish:invoice-templates',
                description: 'Copy default invoice templates to resources/pdf-templates/ for customization.',
                action: async () => {
                    const srcDir = path.join(__dirname, 'templates')
                    const destDir = path.resolve(process.cwd(), 'resources/pdf-templates')

                    if (!fs.existsSync(destDir)) {
                        fs.mkdirSync(destDir, { recursive: true })
                    }

                    const templates = [
                        { src: 'invoice.ejs', dest: 'invoice.ejs' },
                        { src: 'credit_note.ejs', dest: 'credit_note.ejs' }
                    ]

                    const results: string[] = []

                    for (const tpl of templates) {
                        const destPath = path.join(destDir, tpl.dest)

                        if (fs.existsSync(destPath)) {
                            results.push(`⚠ ${tpl.dest} already exists, skipped (delete it first to overwrite)`)
                            continue
                        }

                        fs.copyFileSync(path.join(srcDir, tpl.src), destPath)
                        results.push(`✓ ${tpl.dest} → ${destPath}`)
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
                    }
                }
            }
        ]
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
} as const

export type PaymentMethods = (typeof AvailableRouteMethods.payments)[number]
