# ETHPaymentLeaf - Adding a New Payment Provider

This guide explains how to add a new payment provider to ETHPaymentLeaf.

## 📁 Architecture

```
ETHPaymentLeaf/
├── providers/
│   ├── base.ts        ← Interfaces and types
│   ├── stripe.ts      ← Stripe implementation
│   ├── paypal.ts      ← PayPal implementation
│   └── square.ts      ← Your new provider
├── app.ts
└── ...
```

## 🚀 Step 1: Create the Provider File

Create a new file `providers/square.ts` (example with Square):

```typescript
// providers/square.ts
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

// Configuration interface for your provider
export interface SquareConfig {
    access_token: string
    location_id: string
    environment: 'sandbox' | 'production'
    webhook_signature_key?: string
}

export class SquareProvider implements PaymentProvider {
    readonly name = 'square'
    private config!: SquareConfig

    // ==================== Initialization ====================

    async initialize(config: SquareConfig): Promise<void> {
        this.config = config
        // Initialize SDK, validate credentials, etc.
    }

    // ==================== Helpers ====================

    private get baseUrl(): string {
        return this.config.environment === 'production'
            ? 'https://connect.squareup.com'
            : 'https://connect.squareupsandbox.com'
    }

    private async request<T>(method: string, path: string, body?: any): Promise<T> {
        const response = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers: {
                'Authorization': `Bearer ${this.config.access_token}`,
                'Content-Type': 'application/json',
                'Square-Version': '2024-01-01',
            },
            body: body ? JSON.stringify(body) : undefined,
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(`Square API error: ${JSON.stringify(error)}`)
        }

        return response.json()
    }

    private mapPaymentStatus(status: string): PaymentStatus {
        const mapping: Record<string, PaymentStatus> = {
            'PENDING': 'pending',
            'COMPLETED': 'succeeded',
            'FAILED': 'failed',
            'CANCELED': 'cancelled',
        }
        return mapping[status] || 'pending'
    }

    // ==================== Customers ====================

    async createCustomer(options: CreateCustomerOptions): Promise<CustomerResult> {
        const response = await this.request<any>('POST', '/v2/customers', {
            email_address: options.email,
            given_name: options.name?.split(' ')[0],
            family_name: options.name?.split(' ').slice(1).join(' '),
            phone_number: options.phone,
        })

        return {
            id: response.customer.id,
            provider: this.name,
            email: response.customer.email_address,
            name: `${response.customer.given_name} ${response.customer.family_name}`.trim(),
            raw: response.customer,
        }
    }

    async getCustomer(customerId: string): Promise<CustomerResult | null> {
        try {
            const response = await this.request<any>('GET', `/v2/customers/${customerId}`)
            return {
                id: response.customer.id,
                provider: this.name,
                email: response.customer.email_address,
                name: `${response.customer.given_name} ${response.customer.family_name}`.trim(),
                raw: response.customer,
            }
        } catch {
            return null
        }
    }

    async updateCustomer(customerId: string, options: Partial<CreateCustomerOptions>): Promise<CustomerResult> {
        const response = await this.request<any>('PUT', `/v2/customers/${customerId}`, {
            email_address: options.email,
            given_name: options.name?.split(' ')[0],
            family_name: options.name?.split(' ').slice(1).join(' '),
        })

        return {
            id: response.customer.id,
            provider: this.name,
            email: response.customer.email_address,
            name: `${response.customer.given_name} ${response.customer.family_name}`.trim(),
            raw: response.customer,
        }
    }

    async deleteCustomer(customerId: string): Promise<void> {
        await this.request('DELETE', `/v2/customers/${customerId}`)
    }

    // ==================== Checkout / Payments ====================

    async createCheckout(options: CreateCheckoutOptions): Promise<CheckoutResult> {
        const response = await this.request<any>('POST', '/v2/online-checkout/payment-links', {
            checkout_options: {
                redirect_url: options.success_url,
            },
            quick_pay: {
                name: options.line_items[0]?.name || 'Payment',
                price_money: {
                    amount: options.line_items.reduce((sum, item) => 
                        sum + (item.unit_amount.amount * item.quantity), 0
                    ),
                    currency: options.line_items[0]?.unit_amount.currency.toUpperCase() || 'USD',
                },
                location_id: this.config.location_id,
            },
        })

        return {
            id: response.payment_link.id,
            provider: this.name,
            url: response.payment_link.url,
            raw: response.payment_link,
        }
    }

    async getPayment(paymentId: string): Promise<PaymentResult | null> {
        try {
            const response = await this.request<any>('GET', `/v2/payments/${paymentId}`)
            const payment = response.payment

            return {
                id: payment.id,
                provider: this.name,
                status: this.mapPaymentStatus(payment.status),
                amount: {
                    amount: payment.amount_money.amount,
                    currency: payment.amount_money.currency.toLowerCase(),
                },
                customer_id: payment.customer_id,
                paid_at: payment.created_at ? new Date(payment.created_at) : undefined,
                raw: payment,
            }
        } catch {
            return null
        }
    }

    async listPayments(customerId: string, limit = 10): Promise<PaymentResult[]> {
        // Implement based on provider capabilities
        return []
    }

    // ==================== Subscriptions ====================

    async createSubscription(options: CreateSubscriptionOptions): Promise<SubscriptionResult> {
        const response = await this.request<any>('POST', '/v2/subscriptions', {
            location_id: this.config.location_id,
            customer_id: options.customer_id,
            plan_variation_id: options.price_id,
        })

        const sub = response.subscription
        return {
            id: sub.id,
            provider: this.name,
            status: sub.status.toLowerCase() as SubscriptionStatus,
            customer_id: sub.customer_id,
            price_id: sub.plan_variation_id,
            current_period_start: new Date(sub.start_date),
            current_period_end: new Date(sub.charged_through_date),
            cancel_at_period_end: sub.canceled_date !== undefined,
            raw: sub,
        }
    }

    async getSubscription(subscriptionId: string): Promise<SubscriptionResult | null> {
        try {
            const response = await this.request<any>('GET', `/v2/subscriptions/${subscriptionId}`)
            const sub = response.subscription

            return {
                id: sub.id,
                provider: this.name,
                status: sub.status.toLowerCase() as SubscriptionStatus,
                customer_id: sub.customer_id,
                price_id: sub.plan_variation_id,
                current_period_start: new Date(sub.start_date),
                current_period_end: new Date(sub.charged_through_date),
                cancel_at_period_end: sub.canceled_date !== undefined,
                raw: sub,
            }
        } catch {
            return null
        }
    }

    async updateSubscription(subscriptionId: string, options: UpdateSubscriptionOptions): Promise<SubscriptionResult> {
        // Implement update logic
        const subscription = await this.getSubscription(subscriptionId)
        return subscription!
    }

    async cancelSubscription(subscriptionId: string, immediate = false): Promise<SubscriptionResult> {
        await this.request('POST', `/v2/subscriptions/${subscriptionId}/cancel`)
        const subscription = await this.getSubscription(subscriptionId)
        return subscription!
    }

    async resumeSubscription(subscriptionId: string): Promise<SubscriptionResult> {
        await this.request('POST', `/v2/subscriptions/${subscriptionId}/resume`)
        const subscription = await this.getSubscription(subscriptionId)
        return subscription!
    }

    async listSubscriptions(customerId: string, status?: SubscriptionStatus): Promise<SubscriptionResult[]> {
        return []
    }

    // ==================== Refunds ====================

    async refund(options: RefundOptions): Promise<RefundResult> {
        const response = await this.request<any>('POST', '/v2/refunds', {
            payment_id: options.payment_id,
            amount_money: options.amount ? {
                amount: options.amount.amount,
                currency: options.amount.currency.toUpperCase(),
            } : undefined,
            reason: options.reason,
        })

        return {
            id: response.refund.id,
            provider: this.name,
            payment_id: options.payment_id,
            status: response.refund.status === 'COMPLETED' ? 'succeeded' : 'pending',
            amount: {
                amount: response.refund.amount_money.amount,
                currency: response.refund.amount_money.currency.toLowerCase(),
            },
            raw: response.refund,
        }
    }

    async getRefund(refundId: string): Promise<RefundResult | null> {
        try {
            const response = await this.request<any>('GET', `/v2/refunds/${refundId}`)
            return {
                id: response.refund.id,
                provider: this.name,
                payment_id: response.refund.payment_id,
                status: response.refund.status === 'COMPLETED' ? 'succeeded' : 'pending',
                amount: {
                    amount: response.refund.amount_money.amount,
                    currency: response.refund.amount_money.currency.toLowerCase(),
                },
                raw: response.refund,
            }
        } catch {
            return null
        }
    }

    // ==================== Payment Methods ====================

    async setupPaymentMethod(options: SetupPaymentMethodOptions): Promise<SetupPaymentMethodResult> {
        // Square uses a different flow for saving cards
        throw new Error('Use Square Web Payments SDK for card setup')
    }

    async listPaymentMethods(customerId: string): Promise<PaymentMethodResult[]> {
        const response = await this.request<any>('GET', `/v2/customers/${customerId}/cards`)
        
        return (response.cards || []).map((card: any) => ({
            id: card.id,
            provider: this.name,
            type: 'card',
            card: {
                brand: card.card_brand.toLowerCase(),
                last4: card.last_4,
                exp_month: card.exp_month,
                exp_year: card.exp_year,
            },
            is_default: false,
            raw: card,
        }))
    }

    async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
        // Implement if supported
    }

    async deletePaymentMethod(paymentMethodId: string): Promise<void> {
        await this.request('DELETE', `/v2/cards/${paymentMethodId}`)
    }

    // ==================== Webhooks ====================

    async handleWebhook(req: Request, signatureKey: string): Promise<WebhookEvent | null> {
        // Verify webhook signature
        const signature = req.headers['x-square-hmacsha256-signature'] as string
        
        // Implement signature verification
        // ...

        const event = req.body

        return {
            id: event.event_id,
            provider: this.name,
            type: this.mapEventType(event.type),
            data: {
                // Map event data
            },
            created_at: new Date(event.created_at),
            raw: event,
        }
    }

    private mapEventType(type: string): WebhookEventType {
        const mapping: Record<string, WebhookEventType> = {
            'payment.completed': 'payment.succeeded',
            'payment.failed': 'payment.failed',
            'subscription.created': 'subscription.created',
            'subscription.updated': 'subscription.updated',
            // Add more mappings
        }
        return mapping[type] || type
    }

    // ==================== Mobile Payments ====================

    async initMobilePayment(options: MobilePaymentInitOptions): Promise<MobilePaymentInitResult> {
        // Square uses a different approach for mobile
        // You might use Square Mobile SDK or create a payment link
        
        const response = await this.request<any>('POST', '/v2/payments', {
            source_id: 'PENDING', // Will be filled by mobile SDK
            amount_money: {
                amount: options.amount,
                currency: options.currency.toUpperCase(),
            },
            location_id: this.config.location_id,
            customer_id: options.customer_id,
        })

        return {
            provider: this.name,
            payment_id: response.payment.id,
            customer_id: options.customer_id,
            // Square-specific data for mobile SDK
            raw: response.payment,
        }
    }

    async initMobileSubscription(options: MobileSubscriptionInitOptions): Promise<MobilePaymentInitResult> {
        const subscription = await this.createSubscription({
            customer_id: options.customer_id,
            price_id: options.price_id,
            trial_days: options.trial_days,
            metadata: options.metadata,
        })

        return {
            provider: this.name,
            payment_id: subscription.id,
            customer_id: options.customer_id,
            raw: subscription.raw,
        }
    }

    async confirmMobilePayment(options: MobilePaymentConfirmOptions): Promise<MobilePaymentConfirmResult> {
        const payment = await this.getPayment(options.payment_id)

        return {
            success: payment?.status === 'succeeded',
            status: payment?.status || 'failed',
            raw: payment?.raw,
        }
    }
}

// IMPORTANT: Register the provider
registerProvider('square', SquareProvider)
```

## 🚀 Step 2: Import in providers/index.ts

```typescript
// providers/index.ts
export * from './base'
export * from './stripe'
export * from './paypal'
export * from './square'  // Add this
```

## 🚀 Step 3: Use in Configuration

```typescript
// Config.ts
eth_payment_leaf: {
    module: ETHPaymentLeaf,
    config: {
        default_provider: 'stripe',

        providers: {
            stripe: { /* ... */ },
            paypal: { /* ... */ },
            
            // Your new provider
            square: {
                enabled: true,
                config: {
                    access_token: process.env.SQUARE_ACCESS_TOKEN!,
                    location_id: process.env.SQUARE_LOCATION_ID!,
                    environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
                },
                webhook_secret: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY,
            },
        },

        routes: {
            payments: [
                'createCheckout',
                'webhook',
                // ...
            ],
        },
    },
},
```

## 📋 PaymentProvider Interface Reference

Your provider must implement all these methods:

```typescript
interface PaymentProvider {
    readonly name: string

    // Initialization
    initialize(config: Record<string, any>): Promise<void>

    // Customers
    createCustomer(options: CreateCustomerOptions): Promise<CustomerResult>
    getCustomer(customerId: string): Promise<CustomerResult | null>
    updateCustomer(customerId: string, options: Partial<CreateCustomerOptions>): Promise<CustomerResult>
    deleteCustomer(customerId: string): Promise<void>

    // Checkout / Payments
    createCheckout(options: CreateCheckoutOptions): Promise<CheckoutResult>
    getPayment(paymentId: string): Promise<PaymentResult | null>
    listPayments(customerId: string, limit?: number): Promise<PaymentResult[]>

    // Subscriptions
    createSubscription(options: CreateSubscriptionOptions): Promise<SubscriptionResult>
    getSubscription(subscriptionId: string): Promise<SubscriptionResult | null>
    updateSubscription(subscriptionId: string, options: UpdateSubscriptionOptions): Promise<SubscriptionResult>
    cancelSubscription(subscriptionId: string, immediate?: boolean): Promise<SubscriptionResult>
    resumeSubscription(subscriptionId: string): Promise<SubscriptionResult>
    listSubscriptions(customerId: string, status?: SubscriptionStatus): Promise<SubscriptionResult[]>

    // Refunds
    refund(options: RefundOptions): Promise<RefundResult>
    getRefund(refundId: string): Promise<RefundResult | null>

    // Payment Methods
    setupPaymentMethod(options: SetupPaymentMethodOptions): Promise<SetupPaymentMethodResult>
    listPaymentMethods(customerId: string): Promise<PaymentMethodResult[]>
    setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void>
    deletePaymentMethod(paymentMethodId: string): Promise<void>

    // Webhooks
    handleWebhook(req: Request, webhookSecret: string): Promise<WebhookEvent | null>

    // Mobile
    initMobilePayment(options: MobilePaymentInitOptions): Promise<MobilePaymentInitResult>
    initMobileSubscription(options: MobileSubscriptionInitOptions): Promise<MobilePaymentInitResult>
    confirmMobilePayment(options: MobilePaymentConfirmOptions): Promise<MobilePaymentConfirmResult>
}
```

## ✅ Checklist

- [ ] Implement all required methods
- [ ] Register provider with `registerProvider('name', Provider)`
- [ ] Export from `providers/index.ts`
- [ ] Add environment variables
- [ ] Configure in `Config.ts`
- [ ] Test all methods
- [ ] Add webhook endpoint in provider dashboard
- [ ] Document any provider-specific behavior

## 💡 Tips

1. **Use `throw new Error()`** for unsupported features
2. **Map statuses** consistently to the unified types
3. **Store raw responses** in the `raw` field for debugging
4. **Handle rate limits** appropriately
5. **Log errors** for debugging in development
