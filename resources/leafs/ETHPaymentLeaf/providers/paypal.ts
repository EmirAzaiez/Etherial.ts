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
    Money,
    MobilePaymentInitOptions,
    MobilePaymentInitResult,
    MobileSubscriptionInitOptions,
    MobilePaymentConfirmOptions,
    MobilePaymentConfirmResult,
    ZERO_DECIMAL_CURRENCIES,
    THREE_DECIMAL_CURRENCIES,
} from './base'

export interface PayPalConfig {
    client_id: string
    client_secret: string
    mode: 'sandbox' | 'live'
    webhook_id?: string
}

interface PayPalTokenResponse {
    access_token: string
    token_type: string
    expires_in: number
}

export class PayPalProvider implements PaymentProvider {
    readonly name = 'paypal'
    private config!: PayPalConfig
    private accessToken: string = ''
    private tokenExpiresAt: number = 0

    async initialize(config: PayPalConfig): Promise<void> {
        this.config = config
    }

    // ==================== API Helpers ====================

    private get baseUrl(): string {
        return this.config.mode === 'live'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com'
    }

    private async getAccessToken(): Promise<string> {
        // Return cached token if still valid
        if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
            return this.accessToken
        }

        const auth = Buffer.from(`${this.config.client_id}:${this.config.client_secret}`).toString('base64')

        const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'grant_type=client_credentials',
        })

        if (!response.ok) {
            throw new Error(`PayPal auth failed: ${response.statusText}`)
        }

        const data: PayPalTokenResponse = await response.json()
        this.accessToken = data.access_token
        this.tokenExpiresAt = Date.now() + (data.expires_in * 1000)

        return this.accessToken
    }

    private async request<T>(method: string, path: string, body?: any): Promise<T> {
        const token = await this.getAccessToken()

        const response = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation',
            },
            body: body ? JSON.stringify(body) : undefined,
        })

        if (!response.ok) {
            const error = await response.json().catch(() => ({}))
            throw new Error(`PayPal API error: ${JSON.stringify(error)}`)
        }

        if (response.status === 204) {
            return {} as T
        }

        return response.json()
    }

    private mapPaymentStatus(status: string): PaymentStatus {
        const mapping: Record<string, PaymentStatus> = {
            'CREATED': 'pending',
            'SAVED': 'pending',
            'APPROVED': 'processing',
            'VOIDED': 'cancelled',
            'COMPLETED': 'succeeded',
            'PAYER_ACTION_REQUIRED': 'pending',
        }
        return mapping[status] || 'pending'
    }

    private mapSubscriptionStatus(status: string): SubscriptionStatus {
        const mapping: Record<string, SubscriptionStatus> = {
            'APPROVAL_PENDING': 'pending' as any,
            'APPROVED': 'active',
            'ACTIVE': 'active',
            'SUSPENDED': 'paused',
            'CANCELLED': 'cancelled',
            'EXPIRED': 'expired',
        }
        return mapping[status] || 'active'
    }

    private formatMoney(money: Money): { currency_code: string; value: string } {
        // PayPal uses full currency amounts, not cents
        const value = money.currency.toLowerCase() === 'jpy'
            ? money.amount.toString()
            : (money.amount / 100).toFixed(2)

        return {
            currency_code: money.currency.toUpperCase(),
            value,
        }
    }

    private parseMoney(amount: { currency_code: string; value: string }): Money {
        const currency = amount.currency_code.toLowerCase()
        // Convert to cents for consistency
        const value = currency === 'jpy'
            ? parseInt(amount.value, 10)
            : Math.round(parseFloat(amount.value) * 100)

        return { amount: value, currency }
    }

    // ==================== Customers ====================
    // PayPal doesn't have a traditional customer API, we store metadata locally

    async createCustomer(options: CreateCustomerOptions): Promise<CustomerResult> {
        // PayPal doesn't have customer creation - return a pseudo-customer
        // In practice, you'd store this in your database
        const id = `paypal_${Date.now()}_${Math.random().toString(36).substring(7)}`

        return {
            id,
            provider: this.name,
            email: options.email,
            name: options.name,
            metadata: options.metadata,
        }
    }

    async getCustomer(customerId: string): Promise<CustomerResult | null> {
        // PayPal doesn't have customer retrieval
        // Return null - implement with your database
        return null
    }

    async updateCustomer(customerId: string, options: Partial<CreateCustomerOptions>): Promise<CustomerResult> {
        // PayPal doesn't have customer update
        return {
            id: customerId,
            provider: this.name,
            email: options.email || '',
            name: options.name,
            metadata: options.metadata,
        }
    }

    async deleteCustomer(customerId: string): Promise<void> {
        // PayPal doesn't have customer deletion
        // Implement with your database
    }

    // ==================== Checkout / Payments ====================

    async createCheckout(options: CreateCheckoutOptions): Promise<CheckoutResult> {
        const items = options.line_items.map(item => ({
            name: item.name,
            description: item.description,
            quantity: item.quantity.toString(),
            unit_amount: this.formatMoney(item.unit_amount),
        }))

        const totalAmount = options.line_items.reduce((sum, item) => {
            return sum + (item.unit_amount.amount * item.quantity)
        }, 0)

        const order = await this.request<any>('POST', '/v2/checkout/orders', {
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: options.line_items[0]?.unit_amount.currency.toUpperCase() || 'USD',
                    value: (totalAmount / 100).toFixed(2),
                    breakdown: {
                        item_total: {
                            currency_code: options.line_items[0]?.unit_amount.currency.toUpperCase() || 'USD',
                            value: (totalAmount / 100).toFixed(2),
                        },
                    },
                },
                items,
                custom_id: options.metadata ? JSON.stringify(options.metadata) : undefined,
            }],
            application_context: {
                return_url: options.success_url,
                cancel_url: options.cancel_url,
                user_action: 'PAY_NOW',
                locale: options.locale,
            },
        })

        const approveLink = order.links?.find((l: any) => l.rel === 'approve')?.href

        return {
            id: order.id,
            provider: this.name,
            url: approveLink || '',
            metadata: options.metadata,
            raw: order,
        }
    }

    async getPayment(paymentId: string): Promise<PaymentResult | null> {
        try {
            const order = await this.request<any>('GET', `/v2/checkout/orders/${paymentId}`)

            const capture = order.purchase_units?.[0]?.payments?.captures?.[0]
            const amount = capture?.amount || order.purchase_units?.[0]?.amount

            return {
                id: order.id,
                provider: this.name,
                status: this.mapPaymentStatus(order.status),
                amount: this.parseMoney(amount),
                customer_email: order.payer?.email_address,
                metadata: order.purchase_units?.[0]?.custom_id
                    ? JSON.parse(order.purchase_units[0].custom_id)
                    : undefined,
                paid_at: capture?.create_time ? new Date(capture.create_time) : undefined,
                raw: order,
            }
        } catch {
            return null
        }
    }

    async listPayments(customerId: string, limit = 10): Promise<PaymentResult[]> {
        // PayPal doesn't support listing orders by customer
        // You'd need to implement this with your database
        return []
    }

    // ==================== Subscriptions ====================

    async createSubscription(options: CreateSubscriptionOptions): Promise<SubscriptionResult> {
        const subscription = await this.request<any>('POST', '/v1/billing/subscriptions', {
            plan_id: options.price_id,
            custom_id: options.metadata ? JSON.stringify(options.metadata) : undefined,
            application_context: {
                return_url: options.success_url,
                cancel_url: options.cancel_url,
                user_action: 'SUBSCRIBE_NOW',
            },
        })

        const approveLink = subscription.links?.find((l: any) => l.rel === 'approve')?.href

        return {
            id: subscription.id,
            provider: this.name,
            status: this.mapSubscriptionStatus(subscription.status),
            customer_id: options.customer_id,
            price_id: options.price_id,
            current_period_start: subscription.start_time ? new Date(subscription.start_time) : new Date(),
            current_period_end: subscription.billing_info?.next_billing_time
                ? new Date(subscription.billing_info.next_billing_time)
                : new Date(),
            cancel_at_period_end: false,
            metadata: options.metadata,
            checkout_url: approveLink,
            raw: subscription,
        }
    }

    async getSubscription(subscriptionId: string): Promise<SubscriptionResult | null> {
        try {
            const subscription = await this.request<any>('GET', `/v1/billing/subscriptions/${subscriptionId}`)

            return {
                id: subscription.id,
                provider: this.name,
                status: this.mapSubscriptionStatus(subscription.status),
                customer_id: subscription.subscriber?.payer_id || '',
                price_id: subscription.plan_id,
                current_period_start: subscription.start_time ? new Date(subscription.start_time) : new Date(),
                current_period_end: subscription.billing_info?.next_billing_time
                    ? new Date(subscription.billing_info.next_billing_time)
                    : new Date(),
                cancel_at_period_end: false,
                metadata: subscription.custom_id ? JSON.parse(subscription.custom_id) : undefined,
                raw: subscription,
            }
        } catch {
            return null
        }
    }

    async updateSubscription(subscriptionId: string, options: UpdateSubscriptionOptions): Promise<SubscriptionResult> {
        if (options.price_id) {
            // Revise the subscription to change plan
            await this.request('POST', `/v1/billing/subscriptions/${subscriptionId}/revise`, {
                plan_id: options.price_id,
            })
        }

        const subscription = await this.getSubscription(subscriptionId)
        return subscription!
    }

    async cancelSubscription(subscriptionId: string, immediate = false): Promise<SubscriptionResult> {
        await this.request('POST', `/v1/billing/subscriptions/${subscriptionId}/cancel`, {
            reason: 'User requested cancellation',
        })

        const subscription = await this.getSubscription(subscriptionId)
        return subscription!
    }

    async resumeSubscription(subscriptionId: string): Promise<SubscriptionResult> {
        await this.request('POST', `/v1/billing/subscriptions/${subscriptionId}/activate`, {
            reason: 'User requested reactivation',
        })

        const subscription = await this.getSubscription(subscriptionId)
        return subscription!
    }

    async listSubscriptions(customerId: string, status?: SubscriptionStatus): Promise<SubscriptionResult[]> {
        // PayPal doesn't support listing subscriptions by customer easily
        // You'd need to implement this with your database
        return []
    }

    // ==================== Refunds ====================

    async refund(options: RefundOptions): Promise<RefundResult> {
        // First, get the capture ID from the order
        const order = await this.request<any>('GET', `/v2/checkout/orders/${options.payment_id}`)
        const captureId = order.purchase_units?.[0]?.payments?.captures?.[0]?.id

        if (!captureId) {
            throw new Error('No capture found for this payment')
        }

        const refundBody: any = {}
        if (options.amount) {
            refundBody.amount = this.formatMoney(options.amount)
        }
        if (options.reason) {
            refundBody.note_to_payer = options.reason
        }

        const refund = await this.request<any>('POST', `/v2/payments/captures/${captureId}/refund`, refundBody)

        return {
            id: refund.id,
            provider: this.name,
            payment_id: options.payment_id,
            status: refund.status === 'COMPLETED' ? 'succeeded' : 'pending',
            amount: this.parseMoney(refund.amount),
            reason: options.reason,
            raw: refund,
        }
    }

    async getRefund(refundId: string): Promise<RefundResult | null> {
        try {
            const refund = await this.request<any>('GET', `/v2/payments/refunds/${refundId}`)

            return {
                id: refund.id,
                provider: this.name,
                payment_id: '', // PayPal doesn't include this in refund details
                status: refund.status === 'COMPLETED' ? 'succeeded' : 'pending',
                amount: this.parseMoney(refund.amount),
                raw: refund,
            }
        } catch {
            return null
        }
    }

    // ==================== Payment Methods ====================
    // PayPal handles payment methods differently - through vault

    async setupPaymentMethod(options: SetupPaymentMethodOptions): Promise<SetupPaymentMethodResult> {
        // PayPal uses vault tokens - this creates a setup token
        const token = await this.request<any>('POST', '/v3/vault/setup-tokens', {
            payment_source: {
                paypal: {
                    usage_type: 'MERCHANT',
                    experience_context: {
                        return_url: options.success_url,
                        cancel_url: options.cancel_url,
                    },
                },
            },
        })

        const approveLink = token.links?.find((l: any) => l.rel === 'approve')?.href

        return {
            id: token.id,
            provider: this.name,
            url: approveLink || '',
            raw: token,
        }
    }

    async listPaymentMethods(customerId: string): Promise<PaymentMethodResult[]> {
        // PayPal vault tokens are customer-specific
        // Implementation depends on how you store customer vault tokens
        return []
    }

    async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
        // Implement with your database
    }

    async deletePaymentMethod(paymentMethodId: string): Promise<void> {
        await this.request('DELETE', `/v3/vault/payment-tokens/${paymentMethodId}`)
    }

    // ==================== Webhooks ====================

    async handleWebhook(req: Request, webhookId: string): Promise<WebhookEvent | null> {
        // Verify webhook signature
        const headers = {
            'PAYPAL-AUTH-ALGO': req.headers['paypal-auth-algo'] as string,
            'PAYPAL-CERT-URL': req.headers['paypal-cert-url'] as string,
            'PAYPAL-TRANSMISSION-ID': req.headers['paypal-transmission-id'] as string,
            'PAYPAL-TRANSMISSION-SIG': req.headers['paypal-transmission-sig'] as string,
            'PAYPAL-TRANSMISSION-TIME': req.headers['paypal-transmission-time'] as string,
        }

        try {
            const verification = await this.request<any>('POST', '/v1/notifications/verify-webhook-signature', {
                auth_algo: headers['PAYPAL-AUTH-ALGO'],
                cert_url: headers['PAYPAL-CERT-URL'],
                transmission_id: headers['PAYPAL-TRANSMISSION-ID'],
                transmission_sig: headers['PAYPAL-TRANSMISSION-SIG'],
                transmission_time: headers['PAYPAL-TRANSMISSION-TIME'],
                webhook_id: webhookId,
                webhook_event: req.body,
            })

            if (verification.verification_status !== 'SUCCESS') {
                console.error('PayPal webhook verification failed')
                return null
            }

            return this.mapWebhookEvent(req.body)
        } catch (err) {
            console.error('PayPal webhook error:', err)
            return null
        }
    }

    private mapWebhookEvent(event: any): WebhookEvent {
        const typeMapping: Record<string, WebhookEventType> = {
            'CHECKOUT.ORDER.APPROVED': 'checkout.completed',
            'PAYMENT.CAPTURE.COMPLETED': 'payment.succeeded',
            'PAYMENT.CAPTURE.DENIED': 'payment.failed',
            'BILLING.SUBSCRIPTION.CREATED': 'subscription.created',
            'BILLING.SUBSCRIPTION.UPDATED': 'subscription.updated',
            'BILLING.SUBSCRIPTION.CANCELLED': 'subscription.cancelled',
            'BILLING.SUBSCRIPTION.SUSPENDED': 'subscription.past_due',
            'PAYMENT.CAPTURE.REFUNDED': 'refund.created',
        }

        const webhookEvent: WebhookEvent = {
            id: event.id,
            provider: this.name,
            type: typeMapping[event.event_type] || event.event_type,
            data: {},
            created_at: new Date(event.create_time),
            raw: event,
        }

        const resource = event.resource

        if (event.event_type.startsWith('BILLING.SUBSCRIPTION')) {
            webhookEvent.data.subscription = {
                id: resource.id,
                provider: this.name,
                status: this.mapSubscriptionStatus(resource.status),
                customer_id: resource.subscriber?.payer_id || '',
                price_id: resource.plan_id,
                current_period_start: resource.start_time ? new Date(resource.start_time) : new Date(),
                current_period_end: resource.billing_info?.next_billing_time
                    ? new Date(resource.billing_info.next_billing_time)
                    : new Date(),
                cancel_at_period_end: false,
                raw: resource,
            }
        } else if (event.event_type.includes('PAYMENT.CAPTURE')) {
            webhookEvent.data.payment = {
                id: resource.id,
                provider: this.name,
                status: this.mapPaymentStatus(resource.status),
                amount: this.parseMoney(resource.amount),
                raw: resource,
            }
        } else if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
            const amount = resource.purchase_units?.[0]?.amount
            webhookEvent.data.payment = {
                id: resource.id,
                provider: this.name,
                status: 'processing',
                amount: amount ? this.parseMoney(amount) : { amount: 0, currency: 'usd' },
                customer_email: resource.payer?.email_address,
                raw: resource,
            }
        }

        return webhookEvent
    }

    // ==================== Mobile Payments ====================

    /**
     * Convert amount from smallest unit to PayPal format
     */
    private toPayPalAmount(amount: number, currency: string): string {
        const curr = currency.toLowerCase()
        if (ZERO_DECIMAL_CURRENCIES.includes(curr)) {
            return amount.toString()
        } else if (THREE_DECIMAL_CURRENCIES.includes(curr)) {
            return (amount / 1000).toFixed(3)
        }
        return (amount / 100).toFixed(2)
    }

    /**
     * Create a PayPal Order for mobile SDK
     * Returns order_id for the PayPal mobile SDK
     */
    async initMobilePayment(options: MobilePaymentInitOptions): Promise<MobilePaymentInitResult> {
        const currency = options.currency.toUpperCase()
        const amountValue = this.toPayPalAmount(options.amount, options.currency)

        const order = await this.request<any>('POST', '/v2/checkout/orders', {
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: currency,
                    value: amountValue,
                },
                custom_id: options.metadata ? JSON.stringify(options.metadata) : undefined,
            }],
            application_context: {
                brand_name: 'App',
                user_action: 'PAY_NOW',
                shipping_preference: 'NO_SHIPPING',
            },
        })

        return {
            provider: this.name,
            payment_id: order.id,
            customer_id: options.customer_id,
            order_id: order.id,
            paypal_client_id: this.config.client_id,
            environment: this.config.mode === 'live' ? 'live' : 'sandbox',
            raw: order,
        }
    }

    /**
     * Create a PayPal Subscription for mobile SDK
     */
    async initMobileSubscription(options: MobileSubscriptionInitOptions): Promise<MobilePaymentInitResult> {
        const subscription = await this.request<any>('POST', '/v1/billing/subscriptions', {
            plan_id: options.price_id,
            custom_id: options.metadata ? JSON.stringify(options.metadata) : undefined,
            application_context: {
                brand_name: 'App',
                user_action: 'SUBSCRIBE_NOW',
                shipping_preference: 'NO_SHIPPING',
            },
        })

        return {
            provider: this.name,
            payment_id: subscription.id,
            customer_id: options.customer_id,
            order_id: subscription.id,
            paypal_client_id: this.config.client_id,
            environment: this.config.mode === 'live' ? 'live' : 'sandbox',
            raw: subscription,
        }
    }

    /**
     * Capture a PayPal Order after mobile SDK approval
     * This is REQUIRED for PayPal - the payment is not completed until captured
     */
    async confirmMobilePayment(options: MobilePaymentConfirmOptions): Promise<MobilePaymentConfirmResult> {
        try {
            // Capture the order
            const capture = await this.request<any>('POST', `/v2/checkout/orders/${options.payment_id}/capture`)

            const captureResult = capture.purchase_units?.[0]?.payments?.captures?.[0]

            return {
                success: capture.status === 'COMPLETED',
                status: capture.status,
                capture_id: captureResult?.id,
                raw: capture,
            }
        } catch (error: any) {
            // Check if already captured
            const order = await this.request<any>('GET', `/v2/checkout/orders/${options.payment_id}`)
            
            if (order.status === 'COMPLETED') {
                const captureResult = order.purchase_units?.[0]?.payments?.captures?.[0]
                return {
                    success: true,
                    status: 'COMPLETED',
                    capture_id: captureResult?.id,
                    raw: order,
                }
            }

            return {
                success: false,
                status: order.status || 'FAILED',
                raw: { error, order },
            }
        }
    }
}

// Register the provider
registerProvider('paypal', PayPalProvider)

