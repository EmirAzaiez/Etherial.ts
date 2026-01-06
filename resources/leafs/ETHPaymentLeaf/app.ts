import etherial, { Etherial } from 'etherial'
import * as path from 'path'

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
    WebhookEvent,
    MobilePaymentInitOptions,
    MobilePaymentInitResult,
    MobileSubscriptionInitOptions,
    MobilePaymentConfirmOptions,
    MobilePaymentConfirmResult,
    Currency,
} from './providers/base'

import { Payment } from './models/Payment'
import { Subscription } from './models/Subscription'
import { PaymentCustomer } from './models/Customer'

// Import providers to register them
import './providers/stripe'
import './providers/paypal'

// Re-export types for consumers
export * from './providers/base'

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
     * Provider configurations
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
     * Callback when a payment is completed (via webhook)
     */
    onPaymentCompleted?: (payment: PaymentResult, localPayment: Payment) => Promise<void> | void

    /**
     * Callback when a subscription status changes
     */
    onSubscriptionUpdated?: (subscription: SubscriptionResult, localSubscription: Subscription) => Promise<void> | void
}

export default class EthPaymentLeaf {
    private routes: { route: string; methods: string[] }[] = []
    private providers: Map<string, PaymentProvider> = new Map()
    config: ETHPaymentLeafConfig

    constructor(config: ETHPaymentLeafConfig) {
        this.config = config

        if (config.routes?.payments?.length > 0) {
            this.routes.push({
                route: path.join(__dirname, 'routes/payments'),
                methods: config.routes.payments,
            })
        }
    }

    async beforeRun({ database }: Etherial): Promise<void> {
        database?.addModels([
            path.join(__dirname, 'models/Payment'),
            path.join(__dirname, 'models/Subscription'),
            path.join(__dirname, 'models/Customer'),
        ])

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
     * Use this in routes to validate provider before using it
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
                    code: 'PROVIDER_NOT_ENABLED',
                }
            }

            return {
                error: `Provider "${providerName}" not found. Available: ${this.getEnabledProviders().join(', ') || 'none'}`,
                code: 'PROVIDER_NOT_FOUND',
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

    // ==================== Unified API (delegates to default provider) ====================

    // --- Customers ---

    async createCustomer(options: CreateCustomerOptions, providerName?: string): Promise<CustomerResult> {
        const provider = providerName ? this.getProvider(providerName) : this.getDefaultProvider()
        if (!provider) throw new Error(`Provider "${providerName}" not found`)
        return provider.createCustomer(options)
    }

    async getCustomer(customerId: string, providerName?: string): Promise<CustomerResult | null> {
        const provider = providerName ? this.getProvider(providerName) : this.getDefaultProvider()
        if (!provider) throw new Error(`Provider "${providerName}" not found`)
        return provider.getCustomer(customerId)
    }

    // --- Checkout ---

    async createCheckout(options: CreateCheckoutOptions, providerName?: string): Promise<CheckoutResult> {
        const provider = providerName ? this.getProvider(providerName) : this.getDefaultProvider()
        if (!provider) throw new Error(`Provider "${providerName}" not found`)
        return provider.createCheckout(options)
    }

    async getPayment(paymentId: string, providerName?: string): Promise<PaymentResult | null> {
        const provider = providerName ? this.getProvider(providerName) : this.getDefaultProvider()
        if (!provider) throw new Error(`Provider "${providerName}" not found`)
        return provider.getPayment(paymentId)
    }

    // --- Subscriptions ---

    async createSubscription(options: CreateSubscriptionOptions, providerName?: string): Promise<SubscriptionResult> {
        const provider = providerName ? this.getProvider(providerName) : this.getDefaultProvider()
        if (!provider) throw new Error(`Provider "${providerName}" not found`)
        return provider.createSubscription(options)
    }

    async getSubscription(subscriptionId: string, providerName?: string): Promise<SubscriptionResult | null> {
        const provider = providerName ? this.getProvider(providerName) : this.getDefaultProvider()
        if (!provider) throw new Error(`Provider "${providerName}" not found`)
        return provider.getSubscription(subscriptionId)
    }

    async updateSubscription(subscriptionId: string, options: UpdateSubscriptionOptions, providerName?: string): Promise<SubscriptionResult> {
        const provider = providerName ? this.getProvider(providerName) : this.getDefaultProvider()
        if (!provider) throw new Error(`Provider "${providerName}" not found`)
        return provider.updateSubscription(subscriptionId, options)
    }

    async cancelSubscription(subscriptionId: string, immediate = false, providerName?: string): Promise<SubscriptionResult> {
        const provider = providerName ? this.getProvider(providerName) : this.getDefaultProvider()
        if (!provider) throw new Error(`Provider "${providerName}" not found`)
        return provider.cancelSubscription(subscriptionId, immediate)
    }

    async resumeSubscription(subscriptionId: string, providerName?: string): Promise<SubscriptionResult> {
        const provider = providerName ? this.getProvider(providerName) : this.getDefaultProvider()
        if (!provider) throw new Error(`Provider "${providerName}" not found`)
        return provider.resumeSubscription(subscriptionId)
    }

    // --- Refunds ---

    async refund(options: RefundOptions, providerName?: string): Promise<RefundResult> {
        const provider = providerName ? this.getProvider(providerName) : this.getDefaultProvider()
        if (!provider) throw new Error(`Provider "${providerName}" not found`)
        return provider.refund(options)
    }

    // --- Payment Methods ---

    async setupPaymentMethod(options: SetupPaymentMethodOptions, providerName?: string): Promise<SetupPaymentMethodResult> {
        const provider = providerName ? this.getProvider(providerName) : this.getDefaultProvider()
        if (!provider) throw new Error(`Provider "${providerName}" not found`)
        return provider.setupPaymentMethod(options)
    }

    async listPaymentMethods(customerId: string, providerName?: string): Promise<PaymentMethodResult[]> {
        const provider = providerName ? this.getProvider(providerName) : this.getDefaultProvider()
        if (!provider) throw new Error(`Provider "${providerName}" not found`)
        return provider.listPaymentMethods(customerId)
    }

    // --- Mobile Payments ---

    /**
     * Initialize a mobile payment
     * Returns provider-specific data for the mobile SDK (Stripe or PayPal)
     */
    async initMobilePayment(
        options: { amount: number; currency: Currency; metadata?: Record<string, string> },
        userId: number,
        email: string,
        name?: string,
        providerName?: string
    ): Promise<MobilePaymentInitResult & { local_payment: Payment }> {
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
                ...options.metadata,
            },
        })

        // Save to database
        const localPayment = await Payment.create({
            provider: providerKey,
            provider_payment_id: result.payment_id,
            provider_customer_id: customer.id,
            status: 'pending',
            amount: options.amount,
            currency: options.currency,
            metadata: options.metadata,
            user_id: userId,
        })

        return { ...result, local_payment: localPayment }
    }

    /**
     * Initialize a mobile subscription
     * Returns provider-specific data for the mobile SDK
     */
    async initMobileSubscription(
        options: { price_id: string; trial_days?: number; metadata?: Record<string, string> },
        userId: number,
        email: string,
        name?: string,
        providerName?: string
    ): Promise<MobilePaymentInitResult & { local_subscription?: Subscription }> {
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
                ...options.metadata,
            },
        })

        return result
    }

    /**
     * Confirm a mobile payment (mainly for PayPal)
     * For Stripe, this just checks the status (webhooks handle confirmation)
     */
    async confirmMobilePayment(
        paymentId: string,
        providerName?: string
    ): Promise<MobilePaymentConfirmResult> {
        const provider = this.getProviderOrThrow(providerName)
        return provider.confirmMobilePayment({ payment_id: paymentId })
    }

    // --- Database Helpers ---

    /**
     * Save a payment to the local database
     */
    async savePayment(result: PaymentResult, userId?: number, metadata?: Record<string, any>): Promise<Payment> {
        const existing = await Payment.findOne({
            where: {
                provider: result.provider,
                provider_payment_id: result.id,
            },
        })

        if (existing) {
            await existing.update({
                status: result.status,
                amount_refunded: result.status === 'refunded' ? existing.amount : existing.amount_refunded,
                paid_at: result.paid_at || existing.paid_at,
                provider_data: result.raw,
            })
            return existing
        }

        return Payment.create({
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
            user_id: userId,
        })
    }

    /**
     * Save a subscription to the local database
     */
    async saveSubscription(result: SubscriptionResult, userId?: number, planName?: string): Promise<Subscription> {
        const existing = await Subscription.findOne({
            where: {
                provider: result.provider,
                provider_subscription_id: result.id,
            },
        })

        if (existing) {
            await existing.update({
                status: result.status,
                current_period_start: result.current_period_start,
                current_period_end: result.current_period_end,
                cancel_at_period_end: result.cancel_at_period_end,
                cancelled_at: result.cancelled_at,
                provider_data: result.raw,
            })
            return existing
        }

        return Subscription.create({
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
            user_id: userId,
        })
    }

    /**
     * Get or create a customer for a user
     */
    async getOrCreateCustomer(
        userId: number,
        email: string,
        name?: string,
        providerName?: string
    ): Promise<{ customer: CustomerResult; local: PaymentCustomer }> {
        const provider = providerName || this.config.default_provider

        // Check if we already have a customer for this user/provider
        let local = await PaymentCustomer.findOne({
            where: { user_id: userId, provider },
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

        local = await PaymentCustomer.findOrCreateForUser(
            userId,
            provider,
            customer.id,
            email,
            name
        )

        return { customer, local }
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
                        data: providers,
                    }
                },
            },
        ]
    }
}

export const AvailableRouteMethods = {
    payments: [
        'createCheckout',           // POST /payments/checkout
        'getPayment',               // GET /payments/:id
        'createSubscription',       // POST /payments/subscriptions
        'getSubscription',          // GET /payments/subscriptions/:id
        'cancelSubscription',       // DELETE /payments/subscriptions/:id
        'resumeSubscription',       // POST /payments/subscriptions/:id/resume
        'refundPayment',            // POST /payments/:id/refund
        'setupPaymentMethod',       // POST /payments/methods/setup
        'listPaymentMethods',       // GET /payments/methods
        'deletePaymentMethod',      // DELETE /payments/methods/:id
        'webhook',                  // POST /payments/webhooks/:provider
        // Mobile
        'initMobilePayment',        // POST /payments/mobile/init
        'initMobileSubscription',   // POST /payments/mobile/subscription
        'confirmMobilePayment',     // POST /payments/mobile/confirm
    ],
} as const

export type PaymentMethods = (typeof AvailableRouteMethods.payments)[number]

