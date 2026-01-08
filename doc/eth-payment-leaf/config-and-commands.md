# ETHPaymentLeaf Configuration & Commands

## Installation

```bash
etherial leaf:add ETHPaymentLeaf
```

## Configuration

The module is configured in your `src/Config.ts` file.

```typescript
import { ETHPaymentLeafConfig } from 'resources/leafs/ETHPaymentLeaf/app'
import EthPaymentLeaf from 'resources/leafs/ETHPaymentLeaf/app'

export default {
    eth_payment_leaf: {
        module: EthPaymentLeaf,
        config: {
            default_provider: 'stripe',
            providers: {
                stripe: {
                    enabled: true,
                    config: {
                        secret_key: process.env.STRIPE_SECRET_KEY!,
                        publishable_key: process.env.STRIPE_PUBLISHABLE_KEY!
                    },
                    webhook_secret: process.env.STRIPE_WEBHOOK_SECRET
                },
                paypal: {
                    enabled: true,
                    config: {
                        client_id: process.env.PAYPAL_CLIENT_ID!,
                        client_secret: process.env.PAYPAL_CLIENT_SECRET!,
                        mode: process.env.PAYPAL_MODE || 'sandbox'
                    },
                    webhook_secret: process.env.PAYPAL_WEBHOOK_ID
                }
            },
            routes: {
                payments: [
                    'createCheckout', 'getPayment',
                    'createSubscription', 'getSubscription', 'cancelSubscription', 'resumeSubscription',
                    'refundPayment',
                    'setupPaymentMethod', 'listPaymentMethods', 'deletePaymentMethod',
                    'webhook',
                    'initMobilePayment', 'confirmMobilePayment'
                ]
            },
            // Callbacks
            onPaymentCompleted: async (paymentResult, localPayment) => {
                // e.g. await User.update({ is_premium: true })
            },
            onSubscriptionUpdated: async (subResult, localSub) => {
                // e.g. await User.update({ premium_until: subResult.current_period_end })
            }
        } satisfies ETHPaymentLeafConfig
    }
}
```

### Environment Variables

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe Secret Key | If using Stripe | `sk_test_...` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe Public Key | If using Stripe | `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook Secret | Optional | `whsec_...` |
| `PAYPAL_CLIENT_ID` | PayPal Client ID | If using PayPal | `AaBb...` |
| `PAYPAL_CLIENT_SECRET` | PayPal Client Secret | If using PayPal | `EeFf...` |
| `PAYPAL_MODE` | PayPal Mode (`sandbox` or `live`) | No | `sandbox` |

## Commands

- `etherial eth_payment_leaf:providers`: List all enabled payment providers.
