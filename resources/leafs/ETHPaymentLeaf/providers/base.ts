import { Request } from 'etherial/components/http/provider'

// ============================================
// Core Types - Same for ALL providers
// ============================================

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded'
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'paused' | 'trialing' | 'unpaid' | 'expired'

/**
 * Supported currencies (ISO 4217)
 * Includes major world currencies + Middle East / North Africa
 */
export type Currency =
    // Major currencies
    | 'usd'     // US Dollar
    | 'eur'     // Euro
    | 'gbp'     // British Pound
    | 'cad'     // Canadian Dollar
    | 'aud'     // Australian Dollar
    | 'chf'     // Swiss Franc
    | 'jpy'     // Japanese Yen (zero-decimal)
    | 'cny'     // Chinese Yuan
    | 'inr'     // Indian Rupee
    | 'krw'     // South Korean Won (zero-decimal)
    | 'sgd'     // Singapore Dollar
    | 'hkd'     // Hong Kong Dollar
    | 'nzd'     // New Zealand Dollar
    | 'sek'     // Swedish Krona
    | 'nok'     // Norwegian Krone
    | 'dkk'     // Danish Krone
    | 'pln'     // Polish Złoty
    | 'czk'     // Czech Koruna
    | 'huf'     // Hungarian Forint
    | 'ron'     // Romanian Leu
    | 'bgn'     // Bulgarian Lev
    | 'hrk'     // Croatian Kuna
    | 'rub'     // Russian Ruble
    | 'try'     // Turkish Lira
    | 'brl'     // Brazilian Real
    | 'mxn'     // Mexican Peso
    | 'ars'     // Argentine Peso
    | 'clp'     // Chilean Peso (zero-decimal)
    | 'cop'     // Colombian Peso
    | 'pen'     // Peruvian Sol
    | 'zar'     // South African Rand
    | 'ngn'     // Nigerian Naira
    | 'egp'     // Egyptian Pound
    | 'kes'     // Kenyan Shilling
    | 'ghs'     // Ghanaian Cedi
    | 'thb'     // Thai Baht
    | 'myr'     // Malaysian Ringgit
    | 'idr'     // Indonesian Rupiah
    | 'php'     // Philippine Peso
    | 'vnd'     // Vietnamese Dong (zero-decimal)
    | 'twd'     // Taiwan Dollar
    // Middle East & North Africa (MENA)
    | 'aed'     // UAE Dirham
    | 'sar'     // Saudi Riyal
    | 'qar'     // Qatari Riyal
    | 'kwd'     // Kuwaiti Dinar (3 decimal places)
    | 'bhd'     // Bahraini Dinar (3 decimal places)
    | 'omr'     // Omani Rial (3 decimal places)
    | 'jod'     // Jordanian Dinar (3 decimal places)
    | 'lbp'     // Lebanese Pound
    | 'iqd'     // Iraqi Dinar (3 decimal places)
    | 'mad'     // Moroccan Dirham
    | 'tnd'     // Tunisian Dinar (3 decimal places)
    | 'dzd'     // Algerian Dinar
    | 'lyd'     // Libyan Dinar (3 decimal places)
    | 'ils'     // Israeli Shekel
    | 'pkr'     // Pakistani Rupee
    | 'bdt'     // Bangladeshi Taka
    | string    // Allow any other ISO 4217 code

/**
 * Zero-decimal currencies (no cents/subunits)
 */
export const ZERO_DECIMAL_CURRENCIES = [
    'jpy', 'krw', 'clp', 'vnd', 'bif', 'djf', 'gnf', 'kmf', 
    'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'
]

/**
 * Three-decimal currencies (1/1000 instead of 1/100)
 */
export const THREE_DECIMAL_CURRENCIES = [
    'kwd', 'bhd', 'omr', 'jod', 'iqd', 'tnd', 'lyd'
]

/**
 * Currency symbols for display
 */
export const CURRENCY_SYMBOLS: Record<string, string> = {
    usd: '$', eur: '€', gbp: '£', cad: 'CA$', aud: 'A$', 
    chf: 'CHF', jpy: '¥', cny: '¥', inr: '₹', krw: '₩',
    sgd: 'S$', hkd: 'HK$', nzd: 'NZ$', sek: 'kr', nok: 'kr',
    dkk: 'kr', pln: 'zł', czk: 'Kč', huf: 'Ft', ron: 'lei',
    rub: '₽', try: '₺', brl: 'R$', mxn: 'MX$', zar: 'R',
    thb: '฿', myr: 'RM', idr: 'Rp', php: '₱', twd: 'NT$',
    // MENA
    aed: 'د.إ', sar: '﷼', qar: '﷼', kwd: 'د.ك', bhd: '.د.ب',
    omr: '﷼', jod: 'د.ا', lbp: 'ل.ل', iqd: 'ع.د', mad: 'د.م.',
    tnd: 'د.ت', dzd: 'د.ج', lyd: 'ل.د', ils: '₪', egp: 'E£',
    pkr: '₨', bdt: '৳',
}

export interface Money {
    amount: number          // Amount in smallest currency unit (cents, fils, etc.)
    currency: Currency
}

/**
 * Format money amount for display
 */
export function formatMoney(money: Money): string {
    const symbol = CURRENCY_SYMBOLS[money.currency] || money.currency.toUpperCase()
    let displayAmount: string

    if (ZERO_DECIMAL_CURRENCIES.includes(money.currency)) {
        displayAmount = money.amount.toLocaleString()
    } else if (THREE_DECIMAL_CURRENCIES.includes(money.currency)) {
        displayAmount = (money.amount / 1000).toFixed(3)
    } else {
        displayAmount = (money.amount / 100).toFixed(2)
    }

    return `${symbol}${displayAmount}`
}

/**
 * Convert display amount to smallest unit
 */
export function toSmallestUnit(amount: number, currency: Currency): number {
    if (ZERO_DECIMAL_CURRENCIES.includes(currency)) {
        return Math.round(amount)
    } else if (THREE_DECIMAL_CURRENCIES.includes(currency)) {
        return Math.round(amount * 1000)
    } else {
        return Math.round(amount * 100)
    }
}

/**
 * Convert smallest unit to display amount
 */
export function toDisplayAmount(amount: number, currency: Currency): number {
    if (ZERO_DECIMAL_CURRENCIES.includes(currency)) {
        return amount
    } else if (THREE_DECIMAL_CURRENCIES.includes(currency)) {
        return amount / 1000
    } else {
        return amount / 100
    }
}

export interface Address {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string        // ISO 3166-1 alpha-2 (e.g., 'US', 'FR')
}

// ============================================
// Customer
// ============================================

export interface CreateCustomerOptions {
    email: string
    name?: string
    phone?: string
    address?: Address
    metadata?: Record<string, string>
}

export interface CustomerResult {
    id: string                          // Provider's customer ID
    provider: string                    // 'stripe', 'paypal', etc.
    email: string
    name?: string
    metadata?: Record<string, string>
    raw?: any                           // Raw response from provider
}

// ============================================
// Checkout / One-time Payment
// ============================================

export interface LineItem {
    name: string
    description?: string
    quantity: number
    unit_amount: Money
    image_url?: string
}

export interface CreateCheckoutOptions {
    customer_id?: string                // Provider's customer ID (optional)
    customer_email?: string             // Email if no customer_id
    line_items: LineItem[]
    success_url: string                 // Redirect after success
    cancel_url: string                  // Redirect after cancel
    metadata?: Record<string, string>   // Your custom data (order_id, user_id, etc.)
    expires_in?: number                 // Session expiration in seconds
    allow_promotion_codes?: boolean
    locale?: string                     // 'en', 'fr', etc.
}

export interface CheckoutResult {
    id: string                          // Checkout session ID
    provider: string
    url: string                         // URL to redirect user to
    expires_at?: Date
    metadata?: Record<string, string>
    raw?: any
}

export interface CapturePaymentOptions {
    checkout_id: string
}

export interface PaymentResult {
    id: string                          // Payment ID from provider
    provider: string
    status: PaymentStatus
    amount: Money
    customer_id?: string
    customer_email?: string
    metadata?: Record<string, string>
    paid_at?: Date
    raw?: any
}

// ============================================
// Subscriptions
// ============================================

export interface PriceInterval {
    interval: 'day' | 'week' | 'month' | 'year'
    interval_count: number              // e.g., 2 for "every 2 months"
}

export interface CreateSubscriptionOptions {
    customer_id: string                 // Provider's customer ID (required)
    price_id: string                    // Provider's price/plan ID
    trial_days?: number
    metadata?: Record<string, string>
    success_url?: string                // For hosted checkout
    cancel_url?: string
    cancel_at_period_end?: boolean      // Cancel at end of billing period
}

export interface SubscriptionResult {
    id: string                          // Subscription ID from provider
    provider: string
    status: SubscriptionStatus
    customer_id: string
    price_id: string
    current_period_start: Date
    current_period_end: Date
    cancel_at_period_end: boolean
    cancelled_at?: Date
    trial_start?: Date
    trial_end?: Date
    metadata?: Record<string, string>
    checkout_url?: string               // If checkout is needed
    raw?: any
}

export interface UpdateSubscriptionOptions {
    price_id?: string                   // Change plan
    cancel_at_period_end?: boolean
    metadata?: Record<string, string>
    proration_behavior?: 'create_prorations' | 'none' | 'always_invoice'
}

// ============================================
// Refunds
// ============================================

export interface RefundOptions {
    payment_id: string                  // Provider's payment/charge ID
    amount?: Money                      // Partial refund (if not provided = full refund)
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer' | string
    metadata?: Record<string, string>
}

export interface RefundResult {
    id: string
    provider: string
    payment_id: string
    status: 'pending' | 'succeeded' | 'failed' | 'cancelled'
    amount: Money
    reason?: string
    raw?: any
}

// ============================================
// Payment Methods (saved cards, etc.)
// ============================================

export interface SetupPaymentMethodOptions {
    customer_id: string
    success_url: string
    cancel_url: string
}

// ============================================
// Mobile Payment (PaymentIntent / Order)
// ============================================

export interface MobilePaymentInitOptions {
    customer_id: string
    amount: number                      // Amount in smallest unit (cents)
    currency: Currency
    metadata?: Record<string, string>
}

export interface MobileSubscriptionInitOptions {
    customer_id: string
    price_id: string
    trial_days?: number
    metadata?: Record<string, string>
}

/**
 * Result from mobile payment initialization
 * Contains provider-specific data for the mobile SDK
 */
export interface MobilePaymentInitResult {
    provider: string

    // Common
    payment_id: string                  // PaymentIntent ID (Stripe) or Order ID (PayPal)
    customer_id: string

    // Stripe-specific
    client_secret?: string              // For Stripe SDK
    ephemeral_key?: string              // For Stripe SDK (customer session)
    publishable_key?: string            // Stripe publishable key

    // PayPal-specific
    order_id?: string                   // PayPal Order ID
    paypal_client_id?: string           // PayPal Client ID
    environment?: 'sandbox' | 'live'    // PayPal environment

    raw?: any
}

export interface MobilePaymentConfirmOptions {
    payment_id: string                  // PaymentIntent ID or Order ID
}

export interface MobilePaymentConfirmResult {
    success: boolean
    status: string
    capture_id?: string                 // PayPal capture ID
    raw?: any
}

export interface SetupPaymentMethodResult {
    id: string
    provider: string
    url: string                         // URL to redirect user
    raw?: any
}

export interface PaymentMethodResult {
    id: string
    provider: string
    type: 'card' | 'paypal' | 'sepa_debit' | 'bank_account' | string
    card?: {
        brand: string                   // 'visa', 'mastercard', etc.
        last4: string
        exp_month: number
        exp_year: number
    }
    is_default: boolean
    raw?: any
}

// ============================================
// Webhooks
// ============================================

export type WebhookEventType =
    | 'checkout.completed'
    | 'checkout.expired'
    | 'payment.succeeded'
    | 'payment.failed'
    | 'subscription.created'
    | 'subscription.updated'
    | 'subscription.cancelled'
    | 'subscription.trial_ending'
    | 'subscription.past_due'
    | 'refund.created'
    | 'refund.updated'
    | 'customer.created'
    | 'customer.updated'
    | 'payment_method.attached'
    | 'payment_method.detached'
    | 'invoice.paid'
    | 'invoice.payment_failed'
    | string                            // Allow custom events

export interface WebhookEvent {
    id: string                          // Event ID from provider
    provider: string
    type: WebhookEventType
    data: {
        payment?: PaymentResult
        subscription?: SubscriptionResult
        refund?: RefundResult
        customer?: CustomerResult
        payment_method?: PaymentMethodResult
        raw?: any
    }
    created_at: Date
    raw?: any                           // Full raw event
}

// ============================================
// Payment Provider Interface
// ============================================

/**
 * Base interface that ALL payment providers must implement.
 * This ensures a unified API regardless of the underlying provider.
 * 
 * @example
 * // All these calls work the same way, regardless of provider:
 * await etherial.eth_payment_leaf.createCheckout({ ... })
 * await etherial.eth_payment_leaf.createSubscription({ ... })
 * await etherial.eth_payment_leaf.refund({ ... })
 */
export interface PaymentProvider {
    /**
     * Provider identifier (e.g., 'stripe', 'paypal')
     */
    readonly name: string

    /**
     * Initialize the provider with config
     */
    initialize(config: Record<string, any>): Promise<void>

    // ==================== Customers ====================

    /**
     * Create a customer in the provider's system
     */
    createCustomer(options: CreateCustomerOptions): Promise<CustomerResult>

    /**
     * Get customer details
     */
    getCustomer(customerId: string): Promise<CustomerResult | null>

    /**
     * Update customer details
     */
    updateCustomer(customerId: string, options: Partial<CreateCustomerOptions>): Promise<CustomerResult>

    /**
     * Delete a customer
     */
    deleteCustomer(customerId: string): Promise<void>

    // ==================== Checkout / Payments ====================

    /**
     * Create a checkout session (redirects user to hosted payment page)
     */
    createCheckout(options: CreateCheckoutOptions): Promise<CheckoutResult>

    /**
     * Get payment details by ID
     */
    getPayment(paymentId: string): Promise<PaymentResult | null>

    /**
     * List payments for a customer
     */
    listPayments(customerId: string, limit?: number): Promise<PaymentResult[]>

    // ==================== Subscriptions ====================

    /**
     * Create a subscription
     */
    createSubscription(options: CreateSubscriptionOptions): Promise<SubscriptionResult>

    /**
     * Get subscription details
     */
    getSubscription(subscriptionId: string): Promise<SubscriptionResult | null>

    /**
     * Update a subscription (change plan, etc.)
     */
    updateSubscription(subscriptionId: string, options: UpdateSubscriptionOptions): Promise<SubscriptionResult>

    /**
     * Cancel a subscription
     * @param immediate If true, cancel immediately. If false, cancel at period end.
     */
    cancelSubscription(subscriptionId: string, immediate?: boolean): Promise<SubscriptionResult>

    /**
     * Resume a cancelled subscription (if not yet expired)
     */
    resumeSubscription(subscriptionId: string): Promise<SubscriptionResult>

    /**
     * List subscriptions for a customer
     */
    listSubscriptions(customerId: string, status?: SubscriptionStatus): Promise<SubscriptionResult[]>

    // ==================== Refunds ====================

    /**
     * Refund a payment (full or partial)
     */
    refund(options: RefundOptions): Promise<RefundResult>

    /**
     * Get refund details
     */
    getRefund(refundId: string): Promise<RefundResult | null>

    // ==================== Payment Methods ====================

    /**
     * Setup a new payment method (redirects to hosted page)
     */
    setupPaymentMethod(options: SetupPaymentMethodOptions): Promise<SetupPaymentMethodResult>

    /**
     * List saved payment methods for a customer
     */
    listPaymentMethods(customerId: string): Promise<PaymentMethodResult[]>

    /**
     * Set default payment method
     */
    setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void>

    /**
     * Delete a payment method
     */
    deletePaymentMethod(paymentMethodId: string): Promise<void>

    // ==================== Webhooks ====================

    /**
     * Verify and parse webhook payload
     * @returns Parsed event or null if verification fails
     */
    handleWebhook(req: Request, webhookSecret: string): Promise<WebhookEvent | null>

    // ==================== Mobile Payments ====================

    /**
     * Initialize a payment for mobile SDKs
     * - Stripe: Creates PaymentIntent + ephemeral key
     * - PayPal: Creates Order
     */
    initMobilePayment(options: MobilePaymentInitOptions): Promise<MobilePaymentInitResult>

    /**
     * Initialize a subscription for mobile SDKs
     * - Stripe: Creates Subscription with payment_behavior: 'default_incomplete'
     * - PayPal: Creates subscription (different flow)
     */
    initMobileSubscription(options: MobileSubscriptionInitOptions): Promise<MobilePaymentInitResult>

    /**
     * Confirm/capture a mobile payment (mainly for PayPal)
     * Stripe uses webhooks for confirmation, but this can be used to check status
     */
    confirmMobilePayment(options: MobilePaymentConfirmOptions): Promise<MobilePaymentConfirmResult>
}

// ============================================
// Provider Registration Helper
// ============================================

export type PaymentProviderConstructor = new () => PaymentProvider

/**
 * Registry of available payment providers
 */
export const PaymentProviders: Map<string, PaymentProviderConstructor> = new Map()

/**
 * Register a payment provider
 * @example
 * registerProvider('stripe', StripeProvider)
 * registerProvider('paypal', PayPalProvider)
 */
export function registerProvider(name: string, provider: PaymentProviderConstructor): void {
    PaymentProviders.set(name.toLowerCase(), provider)
}

/**
 * Get a payment provider by name
 */
export function getProvider(name: string): PaymentProviderConstructor | undefined {
    return PaymentProviders.get(name.toLowerCase())
}

