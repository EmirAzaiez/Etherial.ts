# ETHPaymentLeaf Routes & Forms

## Checkout (One-Time)

### `POST /payments/checkout`
**Method:** `createCheckout`
*Creates a hosted checkout session URL.*

**Form Validation:** `CheckoutForm` (Yup)
- `line_items`: array of objects (required)
    - `name`: string
    - `amount`: number (in cents)
    - `quantity`: number
    - `image_url`: string (optional)
- `success_url`: url
- `cancel_url`: url
- `provider`: string (optional, defaults to config)
- `metadata`: object (optional)

**Response (200):**
```json
{
    "status": 200,
    "data": {
        "checkout_id": "cs_test_...",
        "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_...",
        "provider": "stripe"
    }
}
```

## Subscriptions

### `POST /payments/subscriptions`
**Method:** `createSubscription`
*Creates a subscription checkout session.*

**Form Validation:** `SubscriptionForm` (Yup)
- `price_id`: string (required)
- `trial_days`: number (optional)
- `success_url`: url
- `cancel_url`: url
- `plan_name`: string (optional internal identifier)

**Response (200):**
```json
{
    "status": 200,
    "data": {
        "subscription_id": 1,
        "checkout_url": "https://...",
        "status": "pending"
    }
}
```

### `POST /payments/subscriptions/:id/resume`
**Method:** `resumeSubscription`
*Resumes a subscription that was cancelled (but still in grace period).*

**Response (200):**
```json
{
    "status": 200,
    "data": { "resumed": true, "status": "active" }
}
```

### `DELETE /payments/subscriptions/:id`
**Method:** `cancelSubscription`
*Cancels a subscription.*

**Query Params:**
- `immediate=true` (Force immediate cancellation, no grace period)

**Response (200):**
```json
{
    "status": 200,
    "data": { "status": "active", "cancel_at_period_end": true }
}
```

## Mobile SDK Payment

### `POST /payments/mobile/init`
**Method:** `initMobilePayment`
*Generates intents/orders for mobile SDKs.*

**Form Validation:** `MobilePaymentInitForm` (Yup)
- `provider`: 'stripe' | 'paypal' (required)
- `amount`: number (required, cents)
- `currency`: string (default 'eur')

**Response (200):**
```json
{
    "status": 200,
    "data": {
        "client_secret": "pi_..._secret_...",
        "ephemeral_key": "ek_...",
        "customer_id": "cus_..."
    }
}
```

### `POST /payments/mobile/confirm`
**Method:** `confirmMobilePayment`
*Confirms payment after SDK actions (mostly for PayPal).*

**Form Validation:** `MobilePaymentConfirmForm` (Yup)
- `provider`: 'stripe' | 'paypal' (required)
- `payment_id`: string (required)

**Response (200):**
```json
{ "status": 200, "data": { "status": "succeeded" } }
```
