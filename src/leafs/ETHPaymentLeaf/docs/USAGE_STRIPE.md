# ETHPaymentLeaf - Stripe Usage Guide

This guide explains how to configure and use ETHPaymentLeaf with Stripe.

## 📦 Installation

```bash
# Install the leaf
etherial leaf:add ETHPaymentLeaf

# Install Stripe dependency
npm install stripe
```

## ⚙️ Configuration

### 1. Environment Variables

Add these variables to your `.env` file:

```env
# Stripe API Keys (get from https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx

# Stripe Webhook Secret (create in Dashboard > Developers > Webhooks)
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### 2. Configuration in `Config.ts`

```typescript
import ETHPaymentLeaf, { ETHPaymentLeafConfig } from './ETHPaymentLeaf/app'

export default {
    // ... other modules

    eth_payment_leaf: {
        module: ETHPaymentLeaf,
        config: {
            // Default provider
            default_provider: 'stripe',

            // Provider configuration
            providers: {
                stripe: {
                    enabled: true,
                    config: {
                        secret_key: process.env.STRIPE_SECRET_KEY!,
                        publishable_key: process.env.STRIPE_PUBLISHABLE_KEY!, // Required for mobile
                        // api_version: '2023-10-16', // Optional
                    },
                    webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
                },
            },

            // Routes to enable
            routes: {
                payments: [
                    'createCheckout',
                    'getPayment',
                    'createSubscription',
                    'getSubscription',
                    'cancelSubscription',
                    'resumeSubscription',
                    'refundPayment',
                    'setupPaymentMethod',
                    'listPaymentMethods',
                    'deletePaymentMethod',
                    'webhook',
                    // Mobile routes
                    'initMobilePayment',
                    'initMobileSubscription',
                    'confirmMobilePayment',
                ],
            },

            // Callbacks (optional)
            onPaymentCompleted: async (payment, localPayment) => {
                console.log(`✅ Payment received: ${payment.id}`)
                // Send email, unlock feature, etc.
            },

            onSubscriptionUpdated: async (subscription, localSubscription) => {
                console.log(`📋 Subscription updated: ${subscription.id} - ${subscription.status}`)
                // Update user permissions
            },
        } as ETHPaymentLeafConfig,
    },
}
```

## 🚀 Usage

### One-time Payment (Checkout)

> [!NOTE]
> This section covers Stripe-specific details. For the general Unified API usage (which works for all providers), see the [General Usage Guide](./USAGE_GENERAL.md).

#### Backend

```typescript
// In your controller or service
import etherial from 'etherial'

// Create a checkout
const checkout = await etherial.eth_payment_leaf.createCheckout({
    customer_id: 'cus_xxxxx', // Optional if customer_email provided
    customer_email: 'user@example.com',
    line_items: [
        {
            name: 'Premium Plan',
            description: '1 month premium access',
            quantity: 1,
            unit_amount: {
                amount: 2999, // $29.99 in cents
                currency: 'usd',
            },
        },
    ],
    success_url: 'https://myapp.com/payment/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://myapp.com/payment/cancel',
    metadata: {
        order_id: '12345',
        user_id: '67890',
    },
})

// Redirect user to checkout.url
console.log('Redirect to:', checkout.url)
```

#### Frontend (React)

```typescript
// Call your API
const response = await fetch('/api/payments/checkout', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
        line_items: [
            {
                name: 'Premium Plan',
                quantity: 1,
                amount: 2999,
                currency: 'usd',
            },
        ],
        success_url: window.location.origin + '/payment/success',
        cancel_url: window.location.origin + '/payment/cancel',
    }),
})

const { data } = await response.json()

// Redirect to Stripe Checkout
window.location.href = data.checkout_url
```

### Subscriptions

#### Create a Subscription

```typescript
// Create subscription with checkout
const subscription = await etherial.eth_payment_leaf.createSubscription({
    customer_id: 'cus_xxxxx',
    price_id: 'price_xxxxx', // Stripe Price ID
    trial_days: 14,
    success_url: 'https://myapp.com/subscription/success',
    cancel_url: 'https://myapp.com/subscription/cancel',
    metadata: {
        plan: 'premium',
    },
})

// Redirect to subscription checkout
console.log('Redirect to:', subscription.checkout_url)
```

#### Get Subscription Status

```typescript
const subscription = await etherial.eth_payment_leaf.getSubscription('sub_xxxxx')

console.log('Status:', subscription?.status)
console.log('Current period ends:', subscription?.current_period_end)
console.log('Will cancel:', subscription?.cancel_at_period_end)
```

#### Cancel Subscription

```typescript
// Cancel at period end (recommended)
await etherial.eth_payment_leaf.cancelSubscription('sub_xxxxx', false)

// Cancel immediately
await etherial.eth_payment_leaf.cancelSubscription('sub_xxxxx', true)
```

#### Resume Cancelled Subscription

```typescript
// If cancelled but not yet expired
await etherial.eth_payment_leaf.resumeSubscription('sub_xxxxx')
```

### Refunds

```typescript
// Full refund
const refund = await etherial.eth_payment_leaf.refund({
    payment_id: 'pi_xxxxx',
    reason: 'requested_by_customer',
})

// Partial refund
const partialRefund = await etherial.eth_payment_leaf.refund({
    payment_id: 'pi_xxxxx',
    amount: { amount: 1000, currency: 'usd' }, // $10.00
    reason: 'requested_by_customer',
})
```

### Payment Methods

#### Setup a New Card

```typescript
const setup = await etherial.eth_payment_leaf.setupPaymentMethod({
    customer_id: 'cus_xxxxx',
    success_url: 'https://myapp.com/payment-methods/success',
    cancel_url: 'https://myapp.com/payment-methods/cancel',
})

// Redirect user to add card
window.location.href = setup.url
```

#### List Saved Cards

```typescript
const methods = await etherial.eth_payment_leaf.listPaymentMethods('cus_xxxxx')

methods.forEach(method => {
    console.log(`${method.card?.brand} •••• ${method.card?.last4}`)
    console.log(`Expires: ${method.card?.exp_month}/${method.card?.exp_year}`)
    console.log(`Default: ${method.is_default}`)
})
```

## 🪝 Webhooks

Webhooks are automatically handled by the leaf. Just configure the endpoint in Stripe Dashboard.

### Stripe Dashboard Setup

1. Go to [Stripe Dashboard > Developers > Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. URL: `https://yourapp.com/payments/webhooks/stripe`
4. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Copy the webhook secret to your `.env`

### Handling Events

The callbacks in your config handle the events:

```typescript
onPaymentCompleted: async (payment, localPayment) => {
    // Payment succeeded
    const userId = payment.metadata?.user_id
    const orderId = payment.metadata?.order_id

    // Update order status
    await Order.update({ status: 'paid' }, { where: { id: orderId } })

    // Send confirmation email
    await sendEmail(payment.customer_email, 'payment-success', {
        amount: formatMoney(payment.amount),
    })
},

onSubscriptionUpdated: async (subscription, localSubscription) => {
    const userId = localSubscription.user_id

    if (subscription.status === 'active') {
        // Grant premium access
        await User.update({ is_premium: true }, { where: { id: userId } })
    } else if (subscription.status === 'cancelled' || subscription.status === 'expired') {
        // Revoke premium access
        await User.update({ is_premium: false }, { where: { id: userId } })
    }
},
```

## 📱 Mobile (React Native with Expo)

For mobile payments, see [USAGE_MOBILE.md](./USAGE_MOBILE.md).

Quick example:

```tsx
// Initialize payment
const response = await fetch('/payments/mobile/init', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
        provider: 'stripe',
        amount: 2999,
        currency: 'usd',
    }),
})

const { data } = await response.json()

// Use Stripe SDK
await initPaymentSheet({
    paymentIntentClientSecret: data.client_secret,
    customerEphemeralKeySecret: data.ephemeral_key,
    customerId: data.customer_id,
    merchantDisplayName: 'Your App',
})

await presentPaymentSheet()
```

## 🧪 Testing

### Test Cards

| Number | Result |
|--------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0025 0000 3155` | Requires 3D Secure |
| `4000 0000 0000 9995` | Declined |

### Test Webhook Locally

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to your local server
stripe listen --forward-to localhost:3000/payments/webhooks/stripe

# Copy the webhook secret shown and use it in your .env
```

## 🚀 Production Checklist

- [ ] Replace test keys with live keys
- [ ] Set up production webhook endpoint
- [ ] Enable relevant webhook events
- [ ] Test with small real payments
- [ ] Set up monitoring for failed payments

## 📚 Available Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/payments/checkout` | POST | Create checkout session |
| `/payments/:id(\\d+)` | GET | Get payment details |
| `/payments/:id(\\d+)/refund` | POST | Refund a payment |
| `/payments/subscriptions` | POST | Create subscription |
| `/payments/subscriptions/:id` | GET | Get subscription |
| `/payments/subscriptions/:id` | DELETE | Cancel subscription |
| `/payments/subscriptions/:id/resume` | POST | Resume subscription |
| `/payments/methods/setup` | POST | Setup payment method |
| `/payments/methods` | GET | List payment methods |
| `/payments/methods/:id` | DELETE | Delete payment method |
| `/payments/webhooks/:provider` | POST | Webhook handler |
| `/payments/mobile/init` | POST | Initialize mobile payment |
| `/payments/mobile/subscription` | POST | Initialize mobile subscription |
| `/payments/mobile/confirm` | POST | Confirm mobile payment |
