import { Request } from 'etherial/components/http/provider';
export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded';
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'paused' | 'trialing' | 'unpaid' | 'expired';
/**
 * Supported currencies (ISO 4217)
 * Includes major world currencies + Middle East / North Africa
 */
export type Currency = 'usd' | 'eur' | 'gbp' | 'cad' | 'aud' | 'chf' | 'jpy' | 'cny' | 'inr' | 'krw' | 'sgd' | 'hkd' | 'nzd' | 'sek' | 'nok' | 'dkk' | 'pln' | 'czk' | 'huf' | 'ron' | 'bgn' | 'hrk' | 'rub' | 'try' | 'brl' | 'mxn' | 'ars' | 'clp' | 'cop' | 'pen' | 'zar' | 'ngn' | 'egp' | 'kes' | 'ghs' | 'thb' | 'myr' | 'idr' | 'php' | 'vnd' | 'twd' | 'aed' | 'sar' | 'qar' | 'kwd' | 'bhd' | 'omr' | 'jod' | 'lbp' | 'iqd' | 'mad' | 'tnd' | 'dzd' | 'lyd' | 'ils' | 'pkr' | 'bdt' | string;
/**
 * Zero-decimal currencies (no cents/subunits)
 */
export declare const ZERO_DECIMAL_CURRENCIES: string[];
/**
 * Three-decimal currencies (1/1000 instead of 1/100)
 */
export declare const THREE_DECIMAL_CURRENCIES: string[];
/**
 * Currency symbols for display
 */
export declare const CURRENCY_SYMBOLS: Record<string, string>;
export interface Money {
    amount: number;
    currency: Currency;
}
/**
 * Format money amount for display
 */
export declare function formatMoney(money: Money): string;
/**
 * Convert display amount to smallest unit
 */
export declare function toSmallestUnit(amount: number, currency: Currency): number;
/**
 * Convert smallest unit to display amount
 */
export declare function toDisplayAmount(amount: number, currency: Currency): number;
export interface Address {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
}
export interface CreateCustomerOptions {
    email: string;
    name?: string;
    phone?: string;
    address?: Address;
    metadata?: Record<string, string>;
}
export interface CustomerResult {
    id: string;
    provider: string;
    email: string;
    name?: string;
    metadata?: Record<string, string>;
    raw?: any;
}
export interface LineItem {
    name: string;
    description?: string;
    quantity: number;
    unit_amount: Money;
    image_url?: string;
}
export interface CreateCheckoutOptions {
    customer_id?: string;
    customer_email?: string;
    line_items: LineItem[];
    success_url: string;
    cancel_url: string;
    metadata?: Record<string, string>;
    expires_in?: number;
    allow_promotion_codes?: boolean;
    locale?: string;
    idempotency_key?: string;
}
export interface CheckoutResult {
    id: string;
    provider: string;
    url: string;
    expires_at?: Date;
    metadata?: Record<string, string>;
    raw?: any;
}
export interface CapturePaymentOptions {
    checkout_id: string;
}
export interface PaymentResult {
    id: string;
    provider: string;
    status: PaymentStatus;
    amount: Money;
    customer_id?: string;
    customer_email?: string;
    metadata?: Record<string, string>;
    paid_at?: Date;
    raw?: any;
}
export interface PriceInterval {
    interval: 'day' | 'week' | 'month' | 'year';
    interval_count: number;
}
export interface CreateSubscriptionOptions {
    customer_id: string;
    price_id: string;
    trial_days?: number;
    metadata?: Record<string, string>;
    success_url?: string;
    cancel_url?: string;
    cancel_at_period_end?: boolean;
}
export interface SubscriptionResult {
    id: string;
    provider: string;
    status: SubscriptionStatus;
    customer_id: string;
    price_id: string;
    current_period_start: Date;
    current_period_end: Date;
    cancel_at_period_end: boolean;
    cancelled_at?: Date;
    trial_start?: Date;
    trial_end?: Date;
    metadata?: Record<string, string>;
    checkout_url?: string;
    raw?: any;
}
export interface UpdateSubscriptionOptions {
    price_id?: string;
    cancel_at_period_end?: boolean;
    metadata?: Record<string, string>;
    proration_behavior?: 'create_prorations' | 'none' | 'always_invoice';
}
export interface RefundOptions {
    payment_id: string;
    amount?: Money;
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer' | string;
    metadata?: Record<string, string>;
}
export interface RefundResult {
    id: string;
    provider: string;
    payment_id: string;
    status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
    amount: Money;
    reason?: string;
    raw?: any;
}
export interface SetupPaymentMethodOptions {
    customer_id: string;
    success_url: string;
    cancel_url: string;
}
export interface MobilePaymentInitOptions {
    customer_id: string;
    amount: number;
    currency: Currency;
    metadata?: Record<string, string>;
    idempotency_key?: string;
}
export interface MobileSubscriptionInitOptions {
    customer_id: string;
    price_id: string;
    trial_days?: number;
    metadata?: Record<string, string>;
    idempotency_key?: string;
}
/**
 * Result from mobile payment initialization
 * Contains provider-specific data for the mobile SDK
 */
export interface MobilePaymentInitResult {
    provider: string;
    payment_id: string;
    customer_id: string;
    client_secret?: string;
    ephemeral_key?: string;
    publishable_key?: string;
    order_id?: string;
    paypal_client_id?: string;
    environment?: 'sandbox' | 'live';
    raw?: any;
}
export interface MobilePaymentConfirmOptions {
    payment_id: string;
}
export interface MobilePaymentConfirmResult {
    success: boolean;
    status: string;
    capture_id?: string;
    raw?: any;
}
export interface SetupPaymentMethodResult {
    id: string;
    provider: string;
    url: string;
    raw?: any;
}
export interface MobileSetupResult {
    provider: string;
    customer_id: string;
    client_secret: string;
    ephemeral_key?: string;
    publishable_key?: string;
    raw?: any;
}
export interface PaymentMethodResult {
    id: string;
    provider: string;
    type: 'card' | 'paypal' | 'sepa_debit' | 'bank_account' | string;
    card?: {
        brand: string;
        last4: string;
        exp_month: number;
        exp_year: number;
    };
    is_default: boolean;
    raw?: any;
}
export type WebhookEventType = 'checkout.completed' | 'checkout.expired' | 'payment.succeeded' | 'payment.failed' | 'subscription.created' | 'subscription.updated' | 'subscription.cancelled' | 'subscription.trial_ending' | 'subscription.past_due' | 'refund.created' | 'refund.updated' | 'customer.created' | 'customer.updated' | 'payment_method.attached' | 'payment_method.detached' | 'invoice.paid' | 'invoice.payment_failed' | string;
export interface WebhookEvent {
    id: string;
    provider: string;
    type: WebhookEventType;
    data: {
        payment?: PaymentResult;
        subscription?: SubscriptionResult;
        refund?: RefundResult;
        customer?: CustomerResult;
        payment_method?: PaymentMethodResult;
        raw?: any;
    };
    created_at: Date;
    raw?: any;
}
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
/**
 * Features that a provider may or may not support
 */
export type PaymentProviderFeature = 'listPayments' | 'listSubscriptions' | 'listPaymentMethods' | 'getCustomer' | 'setDefaultPaymentMethod';
export interface PaymentProvider {
    /**
     * Provider identifier (e.g., 'stripe', 'paypal')
     */
    readonly name: string;
    /**
     * Initialize the provider with config
     */
    initialize(config: Record<string, any>): Promise<void>;
    /**
     * Check if the provider supports a given feature
     */
    supports(feature: PaymentProviderFeature): boolean;
    /**
     * Create a customer in the provider's system
     */
    createCustomer(options: CreateCustomerOptions): Promise<CustomerResult>;
    /**
     * Get customer details
     */
    getCustomer(customerId: string): Promise<CustomerResult | null>;
    /**
     * Update customer details
     */
    updateCustomer(customerId: string, options: Partial<CreateCustomerOptions>): Promise<CustomerResult>;
    /**
     * Delete a customer
     */
    deleteCustomer(customerId: string): Promise<void>;
    /**
     * Create a checkout session (redirects user to hosted payment page)
     */
    createCheckout(options: CreateCheckoutOptions): Promise<CheckoutResult>;
    /**
     * Get payment details by ID
     */
    getPayment(paymentId: string): Promise<PaymentResult | null>;
    /**
     * List payments for a customer
     */
    listPayments(customerId: string, limit?: number): Promise<PaymentResult[]>;
    /**
     * Create a subscription
     */
    createSubscription(options: CreateSubscriptionOptions): Promise<SubscriptionResult>;
    /**
     * Get subscription details
     */
    getSubscription(subscriptionId: string): Promise<SubscriptionResult | null>;
    /**
     * Update a subscription (change plan, etc.)
     */
    updateSubscription(subscriptionId: string, options: UpdateSubscriptionOptions): Promise<SubscriptionResult>;
    /**
     * Cancel a subscription
     * @param immediate If true, cancel immediately. If false, cancel at period end.
     */
    cancelSubscription(subscriptionId: string, immediate?: boolean): Promise<SubscriptionResult>;
    /**
     * Resume a cancelled subscription (if not yet expired)
     */
    resumeSubscription(subscriptionId: string): Promise<SubscriptionResult>;
    /**
     * List subscriptions for a customer
     */
    listSubscriptions(customerId: string, status?: SubscriptionStatus): Promise<SubscriptionResult[]>;
    /**
     * Refund a payment (full or partial)
     */
    refund(options: RefundOptions): Promise<RefundResult>;
    /**
     * Get refund details
     */
    getRefund(refundId: string): Promise<RefundResult | null>;
    /**
     * Setup a new payment method (redirects to hosted page)
     */
    setupPaymentMethod(options: SetupPaymentMethodOptions): Promise<SetupPaymentMethodResult>;
    /**
     * List saved payment methods for a customer
     */
    listPaymentMethods(customerId: string): Promise<PaymentMethodResult[]>;
    /**
     * Set default payment method
     */
    setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void>;
    /**
     * Delete a payment method
     */
    deletePaymentMethod(paymentMethodId: string): Promise<void>;
    /**
     * Verify and parse webhook payload
     * @returns Parsed event or null if verification fails
     */
    handleWebhook(req: Request, webhookSecret: string): Promise<WebhookEvent | null>;
    /**
     * Initialize a payment for mobile SDKs
     * - Stripe: Creates PaymentIntent + ephemeral key
     * - PayPal: Creates Order
     */
    initMobilePayment(options: MobilePaymentInitOptions): Promise<MobilePaymentInitResult>;
    /**
     * Initialize a subscription for mobile SDKs
     * - Stripe: Creates Subscription with payment_behavior: 'default_incomplete'
     * - PayPal: Creates subscription (different flow)
     */
    initMobileSubscription(options: MobileSubscriptionInitOptions): Promise<MobilePaymentInitResult>;
    /**
     * Confirm/capture a mobile payment (mainly for PayPal)
     * Stripe uses webhooks for confirmation, but this can be used to check status
     */
    confirmMobilePayment(options: MobilePaymentConfirmOptions): Promise<MobilePaymentConfirmResult>;
    /**
     * Initialize a SetupIntent for mobile SDK (save a card without charging)
     * Optional — only Stripe supports this natively
     */
    initMobileSetup?(customerId: string): Promise<MobileSetupResult>;
}
export type PaymentProviderConstructor = new () => PaymentProvider;
/**
 * Registry of available payment providers
 */
export declare const PaymentProviders: Map<string, PaymentProviderConstructor>;
/**
 * Register a payment provider
 * @example
 * registerProvider('stripe', StripeProvider)
 * registerProvider('paypal', PayPalProvider)
 */
export declare function registerProvider(name: string, provider: PaymentProviderConstructor): void;
/**
 * Get a payment provider by name
 */
export declare function getProvider(name: string): PaymentProviderConstructor | undefined;
