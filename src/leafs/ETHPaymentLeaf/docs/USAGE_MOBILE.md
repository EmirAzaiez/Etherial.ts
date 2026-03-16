# ETHPaymentLeaf - Mobile & Web Guide (Stripe + PayPal)

This guide explains how to use ETHPaymentLeaf on **React Native (Expo)** and **Web** with the built-in unified routes.

## 📱 Concept: Unified API

The Leaf provides ready-to-use mobile routes that return the appropriate data based on the provider:

| Provider | Data Returned | Mobile SDK |
|----------|--------------|------------|
| **Stripe** | `client_secret`, `ephemeral_key`, `customer_id` | `@stripe/stripe-react-native` |
| **PayPal** | `order_id`, `paypal_client_id`, `environment` | `react-native-paypal` |

## ⚙️ Backend Configuration

### 1. Enable mobile routes

```typescript
// Config.ts
eth_payment_leaf: {
    module: ETHPaymentLeaf,
    config: {
        default_provider: 'stripe',

        providers: {
            stripe: {
                enabled: true,
                config: {
                    secret_key: process.env.STRIPE_SECRET_KEY!,
                    publishable_key: process.env.STRIPE_PUBLISHABLE_KEY!, // Required for mobile!
                },
                webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
            },
            paypal: {
                enabled: true,
                config: {
                    client_id: process.env.PAYPAL_CLIENT_ID!,
                    client_secret: process.env.PAYPAL_CLIENT_SECRET!,
                    mode: process.env.NODE_ENV === 'production' ? 'live' : 'sandbox',
                },
            },
        },

        routes: {
            payments: [
                // Existing routes
                'createCheckout',
                'webhook',
                // Mobile routes (enable these!)
                'initMobilePayment',
                'initMobileSubscription',
                'confirmMobilePayment',
            ],
        },
    },
},
```

### 2. Available Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/payments/mobile/init` | POST | Initialize a mobile payment |
| `/payments/mobile/subscription` | POST | Initialize a mobile subscription |
| `/payments/mobile/confirm` | POST | Confirm payment (required for PayPal) |

## 🚀 API Reference

### Request: POST /payments/mobile/init

```json
{
    "provider": "stripe",
    "amount": 2999,
    "currency": "eur",
    "metadata": {
        "product_id": "premium"
    }
}
```

### Response for Stripe

```json
{
    "status": 200,
    "data": {
        "provider": "stripe",
        "payment_id": "pi_xxxxxxxxxxxxx",
        "customer_id": "cus_xxxxxxxxxxxxx",
        "client_secret": "pi_xxxxxxxxxxxxx_secret_xxxxxxxxxxxxx",
        "ephemeral_key": "ek_xxxxxxxxxxxxx",
        "publishable_key": "pk_xxxxxxxxxxxxx"
    }
}
```

### Response for PayPal

```json
{
    "status": 200,
    "data": {
        "provider": "paypal",
        "payment_id": "ORDER-xxxxxxxxxxxxx",
        "customer_id": "paypal_xxxxxxxxxxxxx",
        "order_id": "ORDER-xxxxxxxxxxxxx",
        "paypal_client_id": "xxxxxxxxxxxxx",
        "environment": "sandbox"
    }
}
```

---

## 📱 React Native (Expo)

### Installation

```bash
# Stripe
npx expo install @stripe/stripe-react-native

# PayPal (if needed)
npm install react-native-paypal
```

### Expo Config

```json
// app.json
{
    "expo": {
        "plugins": [
            [
                "@stripe/stripe-react-native",
                {
                    "merchantIdentifier": "merchant.com.yourapp",
                    "enableGooglePay": true
                }
            ]
        ]
    }
}
```

### App Setup

```tsx
// App.tsx
import { StripeProvider } from '@stripe/stripe-react-native'

const STRIPE_PUBLISHABLE_KEY = 'pk_test_xxxxx'

export default function App() {
    return (
        <StripeProvider
            publishableKey={STRIPE_PUBLISHABLE_KEY}
            merchantIdentifier="merchant.com.yourapp"
        >
            <Navigation />
        </StripeProvider>
    )
}
```

### Payment Hook

```tsx
// hooks/usePayment.ts
import { useState } from 'react'
import { Alert } from 'react-native'
import { useStripe } from '@stripe/stripe-react-native'

const API_URL = 'https://api.yourapp.com'

type Provider = 'stripe' | 'paypal'

interface PaymentConfig {
    provider: Provider
    amount: number
    currency?: string
    metadata?: Record<string, any>
}

interface PaymentResult {
    success: boolean
    paymentId?: string
    error?: string
}

export function usePayment() {
    const { initPaymentSheet, presentPaymentSheet } = useStripe()
    const [loading, setLoading] = useState(false)

    const getToken = async () => {
        // Return your auth token here
        return 'your-auth-token'
    }

    const pay = async (config: PaymentConfig): Promise<PaymentResult> => {
        setLoading(true)

        try {
            const token = await getToken()

            // 1. Call backend to initialize payment
            const response = await fetch(`${API_URL}/payments/mobile/init`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    provider: config.provider,
                    amount: config.amount,
                    currency: config.currency || 'eur',
                    metadata: config.metadata,
                }),
            })

            const { data } = await response.json()

            // 2. Handle based on provider
            if (data.provider === 'stripe') {
                return await handleStripePayment(data)
            } else if (data.provider === 'paypal') {
                return await handlePayPalPayment(data, token)
            }

            throw new Error('Unknown provider')
        } catch (error: any) {
            return { success: false, error: error.message }
        } finally {
            setLoading(false)
        }
    }

    const handleStripePayment = async (data: any): Promise<PaymentResult> => {
        // Initialize Payment Sheet
        const { error: initError } = await initPaymentSheet({
            paymentIntentClientSecret: data.client_secret,
            customerEphemeralKeySecret: data.ephemeral_key,
            customerId: data.customer_id,
            merchantDisplayName: 'Your App',
            // Apple Pay
            applePay: {
                merchantCountryCode: 'US',
            },
            // Google Pay
            googlePay: {
                merchantCountryCode: 'US',
                testEnv: __DEV__,
            },
            // Appearance (optional)
            appearance: {
                colors: {
                    primary: '#6366f1',
                },
            },
        })

        if (initError) {
            return { success: false, error: initError.message }
        }

        // Present Payment Sheet
        const { error: paymentError } = await presentPaymentSheet()

        if (paymentError) {
            if (paymentError.code === 'Canceled') {
                return { success: false, error: 'Payment cancelled' }
            }
            return { success: false, error: paymentError.message }
        }

        return { success: true, paymentId: data.payment_id }
    }

    const handlePayPalPayment = async (data: any, token: string): Promise<PaymentResult> => {
        // For PayPal, you would use a WebView or the PayPal SDK
        // This is a simplified example using a WebView approach

        // After PayPal approval, confirm the payment
        const confirmResponse = await fetch(`${API_URL}/payments/mobile/confirm`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                provider: 'paypal',
                payment_id: data.order_id,
            }),
        })

        const confirmData = await confirmResponse.json()

        if (confirmData.data.success) {
            return { success: true, paymentId: data.order_id }
        }

        return { success: false, error: 'PayPal payment failed' }
    }

    return { pay, loading }
}
```

### Checkout Screen

```tsx
// screens/CheckoutScreen.tsx
import React, { useState } from 'react'
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
} from 'react-native'
import { usePayment } from '../hooks/usePayment'

type Provider = 'stripe' | 'paypal'

export function CheckoutScreen() {
    const { pay, loading } = usePayment()
    const [selectedProvider, setSelectedProvider] = useState<Provider>('stripe')

    const handlePayment = async () => {
        const result = await pay({
            provider: selectedProvider,
            amount: 2999, // $29.99
            currency: 'usd',
            metadata: {
                product_id: 'premium_plan',
            },
        })

        if (result.success) {
            Alert.alert('Success', 'Payment completed!')
            // Navigate to success screen
        } else {
            Alert.alert('Error', result.error || 'Payment failed')
        }
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Choose Payment Method</Text>

            {/* Provider Selection */}
            <View style={styles.providers}>
                <TouchableOpacity
                    style={[
                        styles.providerButton,
                        selectedProvider === 'stripe' && styles.providerSelected,
                    ]}
                    onPress={() => setSelectedProvider('stripe')}
                >
                    <Text style={styles.providerIcon}>💳</Text>
                    <Text style={styles.providerText}>Card</Text>
                    <Text style={styles.providerSubtext}>
                        Visa, Mastercard, Apple Pay
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.providerButton,
                        selectedProvider === 'paypal' && styles.providerSelected,
                    ]}
                    onPress={() => setSelectedProvider('paypal')}
                >
                    <Text style={styles.providerIcon}>🅿️</Text>
                    <Text style={styles.providerText}>PayPal</Text>
                    <Text style={styles.providerSubtext}>PayPal Account</Text>
                </TouchableOpacity>
            </View>

            {/* Order Summary */}
            <View style={styles.summary}>
                <Text style={styles.summaryLabel}>Total</Text>
                <Text style={styles.summaryAmount}>$29.99</Text>
            </View>

            {/* Pay Button */}
            <TouchableOpacity
                style={[styles.payButton, loading && styles.payButtonDisabled]}
                onPress={handlePayment}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.payButtonText}>
                        Pay with {selectedProvider === 'stripe' ? 'Card' : 'PayPal'}
                    </Text>
                )}
            </TouchableOpacity>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#0f0f0f',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 24,
        color: '#fff',
    },
    providers: {
        gap: 12,
        marginBottom: 32,
    },
    providerButton: {
        backgroundColor: '#1a1a1a',
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#333',
    },
    providerSelected: {
        borderColor: '#6366f1',
        backgroundColor: '#1a1a2e',
    },
    providerIcon: {
        fontSize: 24,
        marginBottom: 4,
    },
    providerText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    providerSubtext: {
        fontSize: 14,
        color: '#888',
        marginTop: 2,
    },
    summary: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 20,
        borderTopWidth: 1,
        borderTopColor: '#333',
        marginBottom: 20,
    },
    summaryLabel: {
        fontSize: 18,
        color: '#888',
    },
    summaryAmount: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
    },
    payButton: {
        backgroundColor: '#6366f1',
        paddingVertical: 18,
        borderRadius: 12,
        alignItems: 'center',
    },
    payButtonDisabled: {
        opacity: 0.6,
    },
    payButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
})
```

---

## 🌐 Web (React)

For web, you can use either:
1. **Redirect to Checkout** (simpler) - Uses `/payments/checkout`
2. **Embedded Payment** (custom UI) - Uses Stripe Elements or PayPal JS SDK

### Option 1: Redirect to Checkout (Recommended)

```tsx
// hooks/useWebPayment.ts
const API_URL = 'https://api.yourapp.com'

export function useWebPayment() {
    const checkout = async (items: any[], provider = 'stripe') => {
        const response = await fetch(`${API_URL}/payments/checkout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                provider,
                line_items: items,
                success_url: `${window.location.origin}/success`,
                cancel_url: `${window.location.origin}/cancel`,
            }),
        })

        const { data } = await response.json()

        // Redirect to payment page
        window.location.href = data.checkout_url
    }

    return { checkout }
}
```

```tsx
// components/CheckoutButton.tsx
import { useWebPayment } from '../hooks/useWebPayment'

export function CheckoutButton() {
    const { checkout } = useWebPayment()

    const handleCheckout = () => {
        checkout([
            {
                name: 'Premium Plan',
                description: 'Monthly subscription',
                quantity: 1,
                amount: 2999, // $29.99
                currency: 'usd',
            },
        ])
    }

    return (
        <button onClick={handleCheckout}>
            Checkout
        </button>
    )
}
```

### Option 2: Embedded Stripe Elements

```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

```tsx
// components/StripeCheckout.tsx
import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
    Elements,
    PaymentElement,
    useStripe,
    useElements,
} from '@stripe/react-stripe-js'

const stripePromise = loadStripe('pk_test_xxxxx')

function CheckoutForm({ clientSecret }: { clientSecret: string }) {
    const stripe = useStripe()
    const elements = useElements()
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!stripe || !elements) return

        setLoading(true)

        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}/success`,
            },
        })

        if (error) {
            alert(error.message)
        }

        setLoading(false)
    }

    return (
        <form onSubmit={handleSubmit}>
            <PaymentElement />
            <button disabled={!stripe || loading}>
                {loading ? 'Processing...' : 'Pay Now'}
            </button>
        </form>
    )
}

export function StripeCheckout({ amount }: { amount: number }) {
    const [clientSecret, setClientSecret] = useState<string | null>(null)

    useEffect(() => {
        // Get client secret from backend
        fetch('/payments/mobile/init', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                provider: 'stripe',
                amount,
                currency: 'usd',
            }),
        })
            .then(res => res.json())
            .then(({ data }) => setClientSecret(data.client_secret))
    }, [amount])

    if (!clientSecret) return <div>Loading...</div>

    return (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
            <CheckoutForm clientSecret={clientSecret} />
        </Elements>
    )
}
```

### PayPal Web Integration

```bash
npm install @paypal/react-paypal-js
```

```tsx
// components/PayPalCheckout.tsx
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js'

const PAYPAL_CLIENT_ID = 'your-paypal-client-id'

export function PayPalCheckout({ amount }: { amount: number }) {
    return (
        <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID }}>
            <PayPalButtons
                createOrder={async () => {
                    // Call your backend
                    const response = await fetch('/payments/mobile/init', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                            provider: 'paypal',
                            amount,
                            currency: 'usd',
                        }),
                    })

                    const { data } = await response.json()
                    return data.order_id
                }}
                onApprove={async (data) => {
                    // Confirm the payment
                    await fetch('/payments/mobile/confirm', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                            provider: 'paypal',
                            payment_id: data.orderID,
                        }),
                    })

                    alert('Payment successful!')
                }}
            />
        </PayPalScriptProvider>
    )
}
```

---

## 🔄 Complete Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     APP (Mobile or Web)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   User selects: Stripe or PayPal                                │
│                          │                                       │
│                          ▼                                       │
│   POST /payments/mobile/init                                     │
│   { provider: 'stripe|paypal', amount: 2999 }                   │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (ETHPaymentLeaf)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Route: initMobilePayment()                                     │
│                                                                  │
│   → Validate provider                                           │
│   → Get/create Customer                                         │
│   → Call provider.initMobilePayment()                           │
│       ├─ Stripe: PaymentIntent + EphemeralKey                   │
│       └─ PayPal: Order                                          │
│   → Save to database                                            │
│   → Return SDK data                                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     APP (Mobile or Web)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────┐         ┌─────────────────┐               │
│   │   STRIPE SDK    │         │   PAYPAL SDK    │               │
│   │                 │         │                 │               │
│   │ presentPayment  │         │ PayPalButtons   │               │
│   │    Sheet()      │         │                 │               │
│   │                 │         │                 │               │
│   │ → Apple Pay ✓   │         │ → Login PayPal  │               │
│   │ → Google Pay ✓  │         │ → Confirm       │               │
│   │ → Card ✓        │         │                 │               │
│   └────────┬────────┘         └────────┬────────┘               │
│            │                           │                         │
│            │ (webhook auto)            │ POST /confirm           │
│            │                           │                         │
└────────────┼───────────────────────────┼─────────────────────────┘
             │                           │
             ▼                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Confirmation)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Stripe: Webhook → payment.succeeded → Update DB               │
│                                                                  │
│   PayPal: POST /confirm → Capture Order → Update DB             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## ⚠️ Key Differences

| Aspect | Stripe | PayPal |
|--------|--------|--------|
| **Confirmation** | Automatic (webhook) | Manual (POST /confirm) |
| **Apple Pay** | ✅ Built-in | ❌ |
| **Google Pay** | ✅ Built-in | ✅ Via SDK |
| **Saved Cards** | ✅ Via customer_id | ❌ Via PayPal account |

## 🧪 Testing

### Stripe Test Cards

| Number | Result |
|--------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0025 0000 3155` | 3D Secure |
| `4000 0000 0000 9995` | Declined |

### PayPal Sandbox

1. Create an account at [developer.paypal.com](https://developer.paypal.com)
2. Use sandbox credentials
3. Login with sandbox buyer account
