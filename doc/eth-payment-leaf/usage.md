# Using ETHPaymentLeaf

## Strategy: Why & When?

### Why use this Leaf?
Payment integration is the "final boss" of backend development. It involves:
- **Multiple Providers**: You often need Stripe for cards and PayPal for specific markets.
- **Webhooks**: Handling asynchronous events (recurrence, refunds, failed payments) is mandatory.
- **Data consistency**: Syncing the provider's state with your local DB.

`ETHPaymentLeaf` acts as an **Abstraction Layer**. You code against `ETHPaymentLeaf` (createCheckout, createSubscription), and it translates that to Stripe `checkout.sessions.create` or PayPal `v2/checkout/orders`.

**Key Benefit**: You can switch defaults or add providers without rewriting your entire billing logic.

### When NOT to use it?
- If you need **very advanced** Stripe features not yet mapped (e.g., Metered Billing with complex tiers, Connected Accounts/Marketplaces). This leaf covers standard SaaS B2C/B2B models (One-time + Fixed Subscriptions).

## Integration Guide

### 1. The "Product" Strategy
Do NOT store prices in your database. Store them in the Provider (Stripe Dashboard).
- Create a Product "Premium Plan".
- Create a Price "price_123456" ($10/month).
- In your frontend, pass this `price_id` to `POST /payments/subscriptions`.

This ensures you never have "price mismatch" errors between your DB and Stripe.

### 2. Handling Completion (The Callback Pattern)
Don't rely on the frontend success page to grant premium access (users can close the tab). Rely on the **Webhook**.

In `src/Config.ts`:

```typescript
onSubscriptionUpdated: async (subResult, localSub) => {
    // This runs SECURELY on the server when Stripe pings us
    if (subResult.status === 'active') {
        const user = await User.findByPk(localSub.user_id)
        await user.update({ plan: 'premium', premium_until: subResult.current_period_end })
    }
}
```

### 3. Mobile vs Web
- **Web**: Use `createCheckout`. It redirects the user to a secure Stripe/PayPal page. Zero UI work for you.
- **Mobile**: Use `initMobilePayment`. It gives you a `client_secret`. Pass this to `@stripe/stripe-react-native`'s `presentPaymentSheet()`.
