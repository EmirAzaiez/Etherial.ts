# ETHPaymentLeaf Models

## Payment

Records individual one-time payments (checkouts).

**Table Name:** `payments`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `INTEGER` | Primary Key |
| `provider` | `STRING` | `stripe`, `paypal`, etc. |
| `provider_payment_id` | `STRING` | ID from provider (e.g., `pi_123`) |
| `provider_checkout_id`| `STRING` | Checkout session ID |
| `provider_customer_id`| `STRING` | Customer ID |
| `status` | `ENUM` | `pending`, `succeeded`, `failed`, `refunded` |
| `amount` | `BIGINT` | Amount in cents |
| `currency`| `STRING` | `usd`, `eur`, etc. |
| `metadata`| `JSON` | Custom key-value pairs |
| `user_id` | `INTEGER` | Foreign Key (User) |

## Subscription

Records recurring billing agreements.

**Table Name:** `subscriptions`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `INTEGER` | Primary Key |
| `provider` | `STRING` | `stripe`, `paypal` |
| `provider_subscription_id` | `STRING` | ID from provider (e.g., `sub_123`) |
| `plan_name` | `STRING` | Internal plan ID (e.g., `pro_monthly`) |
| `status` | `ENUM` | `active`, `past_due`, `cancelled`, `trialing` |
| `current_period_end` | `DATE` | When the next bill is due |
| `cancel_at_period_end` | `BOOLEAN` | True if user cancelled (ends at period end) |
| `trial_end` | `DATE` | When the trial expires |
| `user_id` | `INTEGER` | Foreign Key (User) |

## PaymentCustomer

Maps your local Users to Provider Customers.

**Table Name:** `payment_customers`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `INTEGER` | Primary Key |
| `user_id` | `INTEGER` | Foreign Key (User) |
| `provider` | `STRING` | `stripe`, `paypal` |
| `provider_customer_id` | `STRING` | ID from provider (e.g., `cus_123`) |
| `default_payment_method_id` | `STRING` | Default card/method ID |
