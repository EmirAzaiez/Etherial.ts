# ETHPaymentLeaf - General Usage Guide

This guide explains how to use the **Unified API** of `ETHPaymentLeaf`. The power of this leaf lies in its ability to abstract away the differences between payment providers (Stripe, PayPal, etc.), allowing you to switch providers with minimal code changes.

## 🌟 Concept: The Unified API

Instead of calling provider-specific SDKs directly, you use the helper methods exposed by the leaf. The leaf handles the translation to the specific provider's API.

**Advantages:**
- Write code once, support multiple providers.
- Switch `default_provider` in config to migrate instantly.
- Consistent data structures for Payments, Customers, and Subscriptions.

---

## ⚙️ Usage

You can access the leaf methods anywhere in your application (controllers, services, scripts) via the `etherial` global or import.

```typescript
import etherial from 'etherial'

// Access the leaf
const payments = etherial.eth_payment_leaf
```

### 1. Payments (Checkout)

The `createCheckout` method creates a payment session (e.g., Stripe Checkout Session) and returns a URL to redirect the user to.

```typescript
const checkout = await payments.createCheckout({
    // User info
    customer_email: 'john@example.com',
    // Optional: Only if you already have a customer ID associated with this user
    customer_id: 'cus_123456', 
    
    // Items to purchase
    line_items: [
        {
            name: 'Premium Subscription',
            description: 'Monthly access to pro features',
            quantity: 1,
            unit_amount: {
                amount: 2999, // 29.99 (in smallest currency unit, e.g., cents)
                currency: 'usd',
            },
        },
    ],
    
    // Redirects
    success_url: 'https://myapp.com/payment/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://myapp.com/payment/cancel',
    
    // Metadata (will be saved with the payment)
    metadata: {
        order_id: 'ORDER-789',
        user_id: 'USER-123',
    },
})

// Returns { id: '...', url: 'https://checkout.stripe.com/...', provider: 'stripe' }
return res.redirect(checkout.url)
```

### 2. Subscriptions

Handle recurring payments easily.

```typescript
const subscription = await payments.createSubscription({
    customer_id: 'cus_123456',
    price_id: 'price_H5ggY...', // The Plan/Price ID from your provider
    
    // Optional
    trial_days: 14,
    success_url: 'https://myapp.com/sub/success',
    cancel_url: 'https://myapp.com/sub/cancel',
    
    metadata: {
        plan_type: 'pro',
    },
})

// Returns { id: 'sub_...', status: 'active', client_secret: '...', ... }
```

#### Managing Subscriptions

```typescript
// Get details
const sub = await payments.getSubscription('sub_123')

// Cancel (at end of period)
await payments.cancelSubscription('sub_123', false)

// Cancel (immediately)
await payments.cancelSubscription('sub_123', true)

// Resume (if cancelled but not expired)
await payments.resumeSubscription('sub_123')
```

### 3. Refunds

Refund a payment partially or in full.

```typescript
// Full refund
await payments.refund({
    payment_id: 'pi_3Md...',
    reason: 'requested_by_customer',
})

// Partial refund ($10.00)
await payments.refund({
    payment_id: 'pi_3Md...',
    amount: {
        amount: 1000,
        currency: 'usd',
    },
})
```

### 4. Customers

Manage customer identities across providers.

```typescript
// Create
const customer = await payments.createCustomer({
    email: 'jane@example.com',
    name: 'Jane Doe',
    phone: '+1234567890',
})

// Get
const existingCustomer = await payments.getCustomer('cus_123')
```

---

## 📱 Mobile & Web Native

For **Mobile Apps (React Native)** or **Custom Web UIs** where you don't want to redirect to a hosted checkout page.

See [USAGE_MOBILE.md](./USAGE_MOBILE.md) for full details, but the core backend methods are:

```typescript
// 1. Initialize Payment
// Returns client_secret (Stripe) or order_id (PayPal) for the frontend SDK
const initResult = await payments.initMobilePayment(
    {
        amount: 5000, // $50.00
        currency: 'usd',
        metadata: { product: 't-shirt' }
    },
    user.id,
    user.email,
    user.name
)

// 2. Initialize Subscription
const subResult = await payments.initMobileSubscription(
    {
        price_id: 'price_123',
        trial_days: 7,
    },
    user.id,
    user.email
)
```

---

## 🔌 Using a Specific Provider

By default, all methods use the `default_provider` set in your `Config.ts`. However, you can force a specific provider for any call by passing the provider name as the last argument.

```typescript
// Force PayPal for this specific transaction
await payments.createCheckout({ ... }, 'paypal')

// Force Stripe
await payments.getCustomer('cus_123', 'stripe')
```

## ⚠️ Error Handling

The leaf throws standardized errors to help you handle failures gracefully.

```typescript
import { ProviderNotFoundError, ProviderNotEnabledError } from './ETHPaymentLeaf/app'

try {
    await payments.createCheckout({ ... })
} catch (error) {
    if (error instanceof ProviderNotFoundError) {
        // The provider setup is missing
    } else if (error instanceof ProviderNotEnabledError) {
        // The provider is configured but 'enabled: false'
    } else {
        // API Error (e.g., declined card, invalid keys)
        console.error(error.message)
    }
}
```

## 📦 Using Provider-Specific Features

If you need to access raw data or features not covered by the Unified API, the results always contain a `raw` field with the original response from the provider.

```typescript
const payment = await payments.getPayment('pi_123')

if (payment.provider === 'stripe') {
    // Access Stripe-specific fields
    const stripeCharge = payment.raw as Stripe.PaymentIntent
    console.log(stripeCharge.payment_method_options?.card?.installments)
}
```
