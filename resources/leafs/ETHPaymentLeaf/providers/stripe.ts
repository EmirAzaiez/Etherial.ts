import Stripe from 'stripe'
import { Request } from 'etherial/components/http/provider'

import {
    PaymentProvider,
    registerProvider,
    CreateCustomerOptions,
    CustomerResult,
    CreateCheckoutOptions,
    CheckoutResult,
    PaymentResult,
    PaymentStatus,
    CreateSubscriptionOptions,
    SubscriptionResult,
    SubscriptionStatus,
    UpdateSubscriptionOptions,
    RefundOptions,
    RefundResult,
    SetupPaymentMethodOptions,
    SetupPaymentMethodResult,
    PaymentMethodResult,
    WebhookEvent,
    WebhookEventType,
    MobilePaymentInitOptions,
    MobilePaymentInitResult,
    MobileSubscriptionInitOptions,
    MobilePaymentConfirmOptions,
    MobilePaymentConfirmResult,
} from './base'

export interface StripeConfig {
    secret_key: string
    publishable_key?: string            // Needed for mobile
    webhook_secret?: string
    api_version?: string
}

export class StripeProvider implements PaymentProvider {
    readonly name = 'stripe'
    private stripe!: Stripe
    private config!: StripeConfig

    async initialize(config: StripeConfig): Promise<void> {
        this.config = config
        this.stripe = new Stripe(config.secret_key, {
            apiVersion: (config.api_version as any) || '2023-10-16',
        })
    }

    // ==================== Helpers ====================

    private mapPaymentStatus(status: string): PaymentStatus {
        const mapping: Record<string, PaymentStatus> = {
            'requires_payment_method': 'pending',
            'requires_confirmation': 'pending',
            'requires_action': 'pending',
            'processing': 'processing',
            'requires_capture': 'processing',
            'succeeded': 'succeeded',
            'canceled': 'cancelled',
        }
        return mapping[status] || 'pending'
    }

    private mapSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
        const mapping: Record<string, SubscriptionStatus> = {
            'active': 'active',
            'canceled': 'cancelled',
            'past_due': 'past_due',
            'paused': 'paused',
            'trialing': 'trialing',
            'unpaid': 'unpaid',
            'incomplete': 'pending' as any,
            'incomplete_expired': 'expired',
        }
        return mapping[status] || 'active'
    }

    // ==================== Customers ====================

    async createCustomer(options: CreateCustomerOptions): Promise<CustomerResult> {
        const customer = await this.stripe.customers.create({
            email: options.email,
            name: options.name,
            phone: options.phone,
            address: options.address ? {
                line1: options.address.line1,
                line2: options.address.line2,
                city: options.address.city,
                state: options.address.state,
                postal_code: options.address.postal_code,
                country: options.address.country,
            } : undefined,
            metadata: options.metadata,
        })

        return {
            id: customer.id,
            provider: this.name,
            email: customer.email!,
            name: customer.name || undefined,
            metadata: customer.metadata as Record<string, string>,
            raw: customer,
        }
    }

    async getCustomer(customerId: string): Promise<CustomerResult | null> {
        try {
            const customer = await this.stripe.customers.retrieve(customerId)
            if (customer.deleted) return null

            return {
                id: customer.id,
                provider: this.name,
                email: (customer as Stripe.Customer).email!,
                name: (customer as Stripe.Customer).name || undefined,
                metadata: (customer as Stripe.Customer).metadata as Record<string, string>,
                raw: customer,
            }
        } catch {
            return null
        }
    }

    async updateCustomer(customerId: string, options: Partial<CreateCustomerOptions>): Promise<CustomerResult> {
        const customer = await this.stripe.customers.update(customerId, {
            email: options.email,
            name: options.name,
            phone: options.phone,
            address: options.address ? {
                line1: options.address.line1,
                line2: options.address.line2,
                city: options.address.city,
                state: options.address.state,
                postal_code: options.address.postal_code,
                country: options.address.country,
            } : undefined,
            metadata: options.metadata,
        })

        return {
            id: customer.id,
            provider: this.name,
            email: customer.email!,
            name: customer.name || undefined,
            metadata: customer.metadata as Record<string, string>,
            raw: customer,
        }
    }

    async deleteCustomer(customerId: string): Promise<void> {
        await this.stripe.customers.del(customerId)
    }

    // ==================== Checkout / Payments ====================

    async createCheckout(options: CreateCheckoutOptions): Promise<CheckoutResult> {
        const session = await this.stripe.checkout.sessions.create({
            mode: 'payment',
            customer: options.customer_id,
            customer_email: options.customer_id ? undefined : options.customer_email,
            line_items: options.line_items.map(item => ({
                price_data: {
                    currency: item.unit_amount.currency,
                    unit_amount: item.unit_amount.amount,
                    product_data: {
                        name: item.name,
                        description: item.description,
                        images: item.image_url ? [item.image_url] : undefined,
                    },
                },
                quantity: item.quantity,
            })),
            success_url: options.success_url,
            cancel_url: options.cancel_url,
            metadata: options.metadata,
            expires_at: options.expires_in
                ? Math.floor(Date.now() / 1000) + options.expires_in
                : undefined,
            allow_promotion_codes: options.allow_promotion_codes,
            locale: options.locale as any,
        })

        return {
            id: session.id,
            provider: this.name,
            url: session.url!,
            expires_at: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
            metadata: session.metadata as Record<string, string>,
            raw: session,
        }
    }

    async getPayment(paymentId: string): Promise<PaymentResult | null> {
        try {
            const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentId)

            return {
                id: paymentIntent.id,
                provider: this.name,
                status: this.mapPaymentStatus(paymentIntent.status),
                amount: {
                    amount: paymentIntent.amount,
                    currency: paymentIntent.currency,
                },
                customer_id: typeof paymentIntent.customer === 'string'
                    ? paymentIntent.customer
                    : paymentIntent.customer?.id,
                metadata: paymentIntent.metadata as Record<string, string>,
                paid_at: paymentIntent.status === 'succeeded' && paymentIntent.created
                    ? new Date(paymentIntent.created * 1000)
                    : undefined,
                raw: paymentIntent,
            }
        } catch {
            return null
        }
    }

    async listPayments(customerId: string, limit = 10): Promise<PaymentResult[]> {
        const paymentIntents = await this.stripe.paymentIntents.list({
            customer: customerId,
            limit,
        })

        return paymentIntents.data.map(pi => ({
            id: pi.id,
            provider: this.name,
            status: this.mapPaymentStatus(pi.status),
            amount: {
                amount: pi.amount,
                currency: pi.currency,
            },
            customer_id: typeof pi.customer === 'string' ? pi.customer : pi.customer?.id,
            metadata: pi.metadata as Record<string, string>,
            paid_at: pi.status === 'succeeded' && pi.created
                ? new Date(pi.created * 1000)
                : undefined,
            raw: pi,
        }))
    }

    // ==================== Subscriptions ====================

    async createSubscription(options: CreateSubscriptionOptions): Promise<SubscriptionResult> {
        // If success_url is provided, create a checkout session for subscription
        if (options.success_url) {
            const session = await this.stripe.checkout.sessions.create({
                mode: 'subscription',
                customer: options.customer_id,
                line_items: [{
                    price: options.price_id,
                    quantity: 1,
                }],
                success_url: options.success_url,
                cancel_url: options.cancel_url,
                metadata: options.metadata,
                subscription_data: options.trial_days ? {
                    trial_period_days: options.trial_days,
                    metadata: options.metadata,
                } : {
                    metadata: options.metadata,
                },
            })

            return {
                id: session.id,
                provider: this.name,
                status: 'pending' as any,
                customer_id: options.customer_id,
                price_id: options.price_id,
                current_period_start: new Date(),
                current_period_end: new Date(),
                cancel_at_period_end: false,
                metadata: options.metadata,
                checkout_url: session.url!,
                raw: session,
            }
        }

        // Direct subscription creation (requires payment method already attached)
        const subscription = await this.stripe.subscriptions.create({
            customer: options.customer_id,
            items: [{ price: options.price_id }],
            trial_period_days: options.trial_days,
            metadata: options.metadata,
            cancel_at_period_end: options.cancel_at_period_end,
        })

        return this.mapSubscription(subscription)
    }

    private mapSubscription(subscription: Stripe.Subscription): SubscriptionResult {
        return {
            id: subscription.id,
            provider: this.name,
            status: this.mapSubscriptionStatus(subscription.status),
            customer_id: typeof subscription.customer === 'string'
                ? subscription.customer
                : subscription.customer.id,
            price_id: subscription.items.data[0]?.price.id || '',
            current_period_start: new Date(subscription.current_period_start * 1000),
            current_period_end: new Date(subscription.current_period_end * 1000),
            cancel_at_period_end: subscription.cancel_at_period_end,
            cancelled_at: subscription.canceled_at
                ? new Date(subscription.canceled_at * 1000)
                : undefined,
            trial_start: subscription.trial_start
                ? new Date(subscription.trial_start * 1000)
                : undefined,
            trial_end: subscription.trial_end
                ? new Date(subscription.trial_end * 1000)
                : undefined,
            metadata: subscription.metadata as Record<string, string>,
            raw: subscription,
        }
    }

    async getSubscription(subscriptionId: string): Promise<SubscriptionResult | null> {
        try {
            const subscription = await this.stripe.subscriptions.retrieve(subscriptionId)
            return this.mapSubscription(subscription)
        } catch {
            return null
        }
    }

    async updateSubscription(subscriptionId: string, options: UpdateSubscriptionOptions): Promise<SubscriptionResult> {
        const updateData: Stripe.SubscriptionUpdateParams = {
            metadata: options.metadata,
            cancel_at_period_end: options.cancel_at_period_end,
            proration_behavior: options.proration_behavior,
        }

        if (options.price_id) {
            const subscription = await this.stripe.subscriptions.retrieve(subscriptionId)
            updateData.items = [{
                id: subscription.items.data[0].id,
                price: options.price_id,
            }]
        }

        const subscription = await this.stripe.subscriptions.update(subscriptionId, updateData)
        return this.mapSubscription(subscription)
    }

    async cancelSubscription(subscriptionId: string, immediate = false): Promise<SubscriptionResult> {
        if (immediate) {
            const subscription = await this.stripe.subscriptions.cancel(subscriptionId)
            return this.mapSubscription(subscription)
        }

        const subscription = await this.stripe.subscriptions.update(subscriptionId, {
            cancel_at_period_end: true,
        })
        return this.mapSubscription(subscription)
    }

    async resumeSubscription(subscriptionId: string): Promise<SubscriptionResult> {
        const subscription = await this.stripe.subscriptions.update(subscriptionId, {
            cancel_at_period_end: false,
        })
        return this.mapSubscription(subscription)
    }

    async listSubscriptions(customerId: string, status?: SubscriptionStatus): Promise<SubscriptionResult[]> {
        const stripeStatus = status === 'cancelled' ? 'canceled' : status

        const subscriptions = await this.stripe.subscriptions.list({
            customer: customerId,
            status: stripeStatus as any,
        })

        return subscriptions.data.map(sub => this.mapSubscription(sub))
    }

    // ==================== Refunds ====================

    async refund(options: RefundOptions): Promise<RefundResult> {
        const refund = await this.stripe.refunds.create({
            payment_intent: options.payment_id,
            amount: options.amount?.amount,
            reason: options.reason as any,
            metadata: options.metadata,
        })

        return {
            id: refund.id,
            provider: this.name,
            payment_id: options.payment_id,
            status: refund.status === 'succeeded' ? 'succeeded' : 'pending',
            amount: {
                amount: refund.amount,
                currency: refund.currency,
            },
            reason: refund.reason || undefined,
            raw: refund,
        }
    }

    async getRefund(refundId: string): Promise<RefundResult | null> {
        try {
            const refund = await this.stripe.refunds.retrieve(refundId)
            return {
                id: refund.id,
                provider: this.name,
                payment_id: typeof refund.payment_intent === 'string'
                    ? refund.payment_intent
                    : refund.payment_intent?.id || '',
                status: refund.status === 'succeeded' ? 'succeeded' : 'pending',
                amount: {
                    amount: refund.amount,
                    currency: refund.currency,
                },
                reason: refund.reason || undefined,
                raw: refund,
            }
        } catch {
            return null
        }
    }

    // ==================== Payment Methods ====================

    async setupPaymentMethod(options: SetupPaymentMethodOptions): Promise<SetupPaymentMethodResult> {
        const session = await this.stripe.checkout.sessions.create({
            mode: 'setup',
            customer: options.customer_id,
            success_url: options.success_url,
            cancel_url: options.cancel_url,
        })

        return {
            id: session.id,
            provider: this.name,
            url: session.url!,
            raw: session,
        }
    }

    async listPaymentMethods(customerId: string): Promise<PaymentMethodResult[]> {
        const paymentMethods = await this.stripe.paymentMethods.list({
            customer: customerId,
            type: 'card',
        })

        const customer = await this.stripe.customers.retrieve(customerId) as Stripe.Customer
        const defaultPm = customer.invoice_settings?.default_payment_method

        return paymentMethods.data.map(pm => ({
            id: pm.id,
            provider: this.name,
            type: pm.type,
            card: pm.card ? {
                brand: pm.card.brand,
                last4: pm.card.last4,
                exp_month: pm.card.exp_month,
                exp_year: pm.card.exp_year,
            } : undefined,
            is_default: pm.id === defaultPm || pm.id === (defaultPm as any)?.id,
            raw: pm,
        }))
    }

    async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
        await this.stripe.customers.update(customerId, {
            invoice_settings: {
                default_payment_method: paymentMethodId,
            },
        })
    }

    async deletePaymentMethod(paymentMethodId: string): Promise<void> {
        await this.stripe.paymentMethods.detach(paymentMethodId)
    }

    // ==================== Webhooks ====================

    async handleWebhook(req: Request, webhookSecret: string): Promise<WebhookEvent | null> {
        const sig = req.headers['stripe-signature'] as string

        try {
            const event = this.stripe.webhooks.constructEvent(
                (req as any).rawBody || JSON.stringify(req.body),
                sig,
                webhookSecret
            )

            return this.mapWebhookEvent(event)
        } catch (err) {
            console.error('Stripe webhook verification failed:', err)
            return null
        }
    }

    private mapWebhookEvent(event: Stripe.Event): WebhookEvent {
        const typeMapping: Record<string, WebhookEventType> = {
            'checkout.session.completed': 'checkout.completed',
            'checkout.session.expired': 'checkout.expired',
            'payment_intent.succeeded': 'payment.succeeded',
            'payment_intent.payment_failed': 'payment.failed',
            'customer.subscription.created': 'subscription.created',
            'customer.subscription.updated': 'subscription.updated',
            'customer.subscription.deleted': 'subscription.cancelled',
            'customer.subscription.trial_will_end': 'subscription.trial_ending',
            'invoice.paid': 'invoice.paid',
            'invoice.payment_failed': 'invoice.payment_failed',
            'charge.refunded': 'refund.created',
            'customer.created': 'customer.created',
            'customer.updated': 'customer.updated',
            'payment_method.attached': 'payment_method.attached',
            'payment_method.detached': 'payment_method.detached',
        }

        const webhookEvent: WebhookEvent = {
            id: event.id,
            provider: this.name,
            type: typeMapping[event.type] || event.type,
            data: {},
            created_at: new Date(event.created * 1000),
            raw: event,
        }

        // Map event data
        const obj = event.data.object as any

        if (event.type.startsWith('customer.subscription')) {
            webhookEvent.data.subscription = this.mapSubscription(obj)
        } else if (event.type.startsWith('payment_intent')) {
            webhookEvent.data.payment = {
                id: obj.id,
                provider: this.name,
                status: this.mapPaymentStatus(obj.status),
                amount: { amount: obj.amount, currency: obj.currency },
                customer_id: typeof obj.customer === 'string' ? obj.customer : obj.customer?.id,
                metadata: obj.metadata,
                raw: obj,
            }
        } else if (event.type === 'checkout.session.completed') {
            webhookEvent.data.payment = {
                id: obj.payment_intent || obj.id,
                provider: this.name,
                status: 'succeeded',
                amount: { amount: obj.amount_total, currency: obj.currency },
                customer_id: obj.customer,
                customer_email: obj.customer_email,
                metadata: obj.metadata,
                raw: obj,
            }
        }

        return webhookEvent
    }

    // ==================== Mobile Payments ====================

    /**
     * Create a PaymentIntent for mobile SDK
     * Returns client_secret and ephemeral_key for the Stripe mobile SDK
     */
    async initMobilePayment(options: MobilePaymentInitOptions): Promise<MobilePaymentInitResult> {
        // Create PaymentIntent
        const paymentIntent = await this.stripe.paymentIntents.create({
            amount: options.amount,
            currency: options.currency,
            customer: options.customer_id,
            automatic_payment_methods: { enabled: true },
            metadata: options.metadata,
        })

        // Create ephemeral key for the customer (required for mobile SDK)
        const ephemeralKey = await this.stripe.ephemeralKeys.create(
            { customer: options.customer_id },
            { apiVersion: this.config.api_version || '2023-10-16' }
        )

        return {
            provider: this.name,
            payment_id: paymentIntent.id,
            customer_id: options.customer_id,
            client_secret: paymentIntent.client_secret!,
            ephemeral_key: ephemeralKey.secret,
            publishable_key: this.config.publishable_key,
            raw: { paymentIntent, ephemeralKey },
        }
    }

    /**
     * Create a Subscription for mobile SDK
     * Uses payment_behavior: 'default_incomplete' to get a PaymentIntent
     */
    async initMobileSubscription(options: MobileSubscriptionInitOptions): Promise<MobilePaymentInitResult> {
        // Create subscription with incomplete status to get PaymentIntent
        const subscription = await this.stripe.subscriptions.create({
            customer: options.customer_id,
            items: [{ price: options.price_id }],
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            trial_period_days: options.trial_days,
            metadata: options.metadata,
            expand: ['latest_invoice.payment_intent'],
        })

        const invoice = subscription.latest_invoice as Stripe.Invoice
        const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent

        // Create ephemeral key
        const ephemeralKey = await this.stripe.ephemeralKeys.create(
            { customer: options.customer_id },
            { apiVersion: this.config.api_version || '2023-10-16' }
        )

        return {
            provider: this.name,
            payment_id: paymentIntent.id,
            customer_id: options.customer_id,
            client_secret: paymentIntent.client_secret!,
            ephemeral_key: ephemeralKey.secret,
            publishable_key: this.config.publishable_key,
            raw: { subscription, paymentIntent, ephemeralKey },
        }
    }

    /**
     * Confirm/check status of a mobile payment
     * For Stripe, webhooks handle confirmation, but this can be used to check status
     */
    async confirmMobilePayment(options: MobilePaymentConfirmOptions): Promise<MobilePaymentConfirmResult> {
        const paymentIntent = await this.stripe.paymentIntents.retrieve(options.payment_id)

        return {
            success: paymentIntent.status === 'succeeded',
            status: paymentIntent.status,
            raw: paymentIntent,
        }
    }
}

// Register the provider
registerProvider('stripe', StripeProvider)

