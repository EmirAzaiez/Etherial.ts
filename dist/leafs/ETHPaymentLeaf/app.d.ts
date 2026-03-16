import { Etherial } from 'etherial';
import { PaymentProvider, CreateCustomerOptions, CustomerResult, CreateCheckoutOptions, CheckoutResult, PaymentResult, CreateSubscriptionOptions, SubscriptionResult, UpdateSubscriptionOptions, RefundOptions, RefundResult, SetupPaymentMethodOptions, SetupPaymentMethodResult, PaymentMethodResult, MobileSetupResult, MobilePaymentInitResult, MobilePaymentConfirmResult, Currency } from './providers/base.js';
import { BasePayment } from './models/Payment.js';
import { BaseSubscription } from './models/Subscription.js';
import { BasePaymentCustomer } from './models/Customer.js';
import { InvoiceCompanyInfo } from './services/invoice_generator.js';
import './providers/stripe';
import './providers/paypal';
export * from './providers/base.js';
export { BasePayment } from './models/Payment.js';
export { BaseSubscription } from './models/Subscription.js';
export { BasePaymentCustomer } from './models/Customer.js';
export declare class ProviderNotFoundError extends Error {
    code: string;
    constructor(providerName: string);
}
export declare class ProviderNotEnabledError extends Error {
    code: string;
    constructor(providerName: string);
}
export interface ProviderConfig {
    enabled: boolean;
    config: Record<string, any>;
    webhook_secret?: string;
}
export interface ETHPaymentLeafConfig {
    /**
     * Default provider to use when not specified
     */
    default_provider: string;
    /**
     * Provider configurations.
     * Only providers with `enabled: true` will be initialized.
     * You can configure providers without enabling them.
     */
    providers: {
        [providerName: string]: ProviderConfig;
    };
    /**
     * Routes to enable
     */
    routes: {
        payments: PaymentMethods[];
    };
    /**
     * Invoice generation configuration (optional)
     */
    invoices?: {
        enabled: boolean;
        s3_folder?: string;
        number_prefix?: string;
        credit_note_prefix?: string;
        locale?: 'fr' | 'en';
        company?: InvoiceCompanyInfo;
        /**
         * Custom EJS template paths. If not provided, the leaf's default templates are used.
         * Paths should be absolute (use path.join(__dirname, ...)).
         */
        templates?: {
            invoice?: string;
            credit_note?: string;
        };
    };
}
type OnPaymentCompletedCallback = (payment: PaymentResult, localPayment: BasePayment) => Promise<void> | void;
type OnSubscriptionUpdatedCallback = (subscription: SubscriptionResult, localSubscription: BaseSubscription) => Promise<void> | void;
type OnPaymentFailedCallback = (payment: PaymentResult, localPayment: BasePayment | null) => Promise<void> | void;
type OnRefundCreatedCallback = (refund: RefundResult, localPayment: BasePayment | null) => Promise<void> | void;
export default class EthPaymentLeaf {
    etherial_module_name: string;
    private routes;
    private providers;
    config: ETHPaymentLeafConfig;
    private _onPaymentCompleted?;
    private _onSubscriptionUpdated?;
    private _onPaymentFailed?;
    private _onRefundCreated?;
    constructor(config: ETHPaymentLeafConfig);
    beforeRun({ database }: Etherial): Promise<void>;
    run({ http }: Etherial): void;
    /**
     * Called when a payment succeeds (via webhook)
     */
    onPaymentCompleted(fn: OnPaymentCompletedCallback): void;
    /**
     * Called when a subscription status changes (via webhook)
     */
    onSubscriptionUpdated(fn: OnSubscriptionUpdatedCallback): void;
    /**
     * Called when a payment fails (via webhook)
     */
    onPaymentFailed(fn: OnPaymentFailedCallback): void;
    /**
     * Called when a refund is created (via webhook)
     */
    onRefundCreated(fn: OnRefundCreatedCallback): void;
    /** @internal — used by routes */
    get callbacks(): {
        onPaymentCompleted: OnPaymentCompletedCallback;
        onSubscriptionUpdated: OnSubscriptionUpdatedCallback;
        onPaymentFailed: OnPaymentFailedCallback;
        onRefundCreated: OnRefundCreatedCallback;
    };
    /** Get the Payment model (consumer's concrete class) */
    get Payment(): typeof BasePayment;
    /** Get the Subscription model (consumer's concrete class) */
    get Subscription(): typeof BaseSubscription;
    /** Get the PaymentCustomer model (consumer's concrete class) */
    get PaymentCustomer(): typeof BasePaymentCustomer;
    /**
     * Get the default provider
     */
    getDefaultProvider(): PaymentProvider;
    /**
     * Get a specific provider by name
     */
    getProvider(name: string): PaymentProvider | undefined;
    /**
     * Get a provider or throw an error if not found/enabled
     */
    getProviderOrThrow(name?: string): PaymentProvider;
    /**
     * Check if a provider is enabled
     */
    isProviderEnabled(name: string): boolean;
    /**
     * Validate that a provider exists and is enabled
     * Returns an error object if invalid, null if valid
     */
    validateProvider(name?: string): {
        error: string;
        code: string;
    } | null;
    /**
     * Get all enabled providers
     */
    getEnabledProviders(): string[];
    /**
     * Get webhook secret for a provider
     */
    getWebhookSecret(provider: string): string | undefined;
    createCustomer(options: CreateCustomerOptions, providerName?: string): Promise<CustomerResult>;
    getCustomer(customerId: string, providerName?: string): Promise<CustomerResult | null>;
    createCheckout(options: CreateCheckoutOptions, providerName?: string): Promise<CheckoutResult>;
    getPayment(paymentId: string, providerName?: string): Promise<PaymentResult | null>;
    createSubscription(options: CreateSubscriptionOptions, providerName?: string): Promise<SubscriptionResult>;
    getSubscription(subscriptionId: string, providerName?: string): Promise<SubscriptionResult | null>;
    updateSubscription(subscriptionId: string, options: UpdateSubscriptionOptions, providerName?: string): Promise<SubscriptionResult>;
    cancelSubscription(subscriptionId: string, immediate?: boolean, providerName?: string): Promise<SubscriptionResult>;
    resumeSubscription(subscriptionId: string, providerName?: string): Promise<SubscriptionResult>;
    refund(options: RefundOptions, providerName?: string): Promise<RefundResult>;
    setupPaymentMethod(options: SetupPaymentMethodOptions, providerName?: string): Promise<SetupPaymentMethodResult>;
    listPaymentMethods(customerId: string, providerName?: string): Promise<PaymentMethodResult[]>;
    setDefaultPaymentMethod(customerId: string, paymentMethodId: string, providerName?: string): Promise<void>;
    initMobileSetup(userId: number, email: string, name?: string, providerName?: string): Promise<MobileSetupResult>;
    /**
     * Initialize a mobile payment
     * Returns provider-specific data for the mobile SDK (Stripe or PayPal)
     */
    initMobilePayment(options: {
        amount: number;
        currency: Currency;
        metadata?: Record<string, string>;
        idempotency_key?: string;
    }, userId: number, email: string, name?: string, providerName?: string): Promise<MobilePaymentInitResult & {
        local_payment: BasePayment;
    }>;
    /**
     * Initialize a mobile subscription
     * Returns provider-specific data for the mobile SDK
     */
    initMobileSubscription(options: {
        price_id: string;
        trial_days?: number;
        metadata?: Record<string, string>;
        idempotency_key?: string;
    }, userId: number, email: string, name?: string, providerName?: string): Promise<MobilePaymentInitResult & {
        local_subscription?: BaseSubscription;
    }>;
    /**
     * Confirm a mobile payment (mainly for PayPal)
     * For Stripe, this just checks the status (webhooks handle confirmation)
     */
    confirmMobilePayment(paymentId: string, providerName?: string): Promise<MobilePaymentConfirmResult>;
    /**
     * Save a payment to the local database
     */
    savePayment(result: PaymentResult, userId?: number, metadata?: Record<string, any>): Promise<BasePayment>;
    /**
     * Save a subscription to the local database
     */
    saveSubscription(result: SubscriptionResult, userId?: number, planName?: string): Promise<BaseSubscription>;
    /**
     * Get or create a customer for a user
     */
    getOrCreateCustomer(userId: number, email: string, name?: string, providerName?: string): Promise<{
        customer: CustomerResult;
        local: BasePaymentCustomer;
    }>;
    private get mediaLeaf();
    private uploadToS3;
    private getInvoiceNumber;
    private getCreditNoteNumber;
    generateInvoiceForPayment(localPayment: BasePayment, paymentResult: PaymentResult): Promise<string>;
    generateCreditNoteForPayment(localPayment: BasePayment, refundResult: RefundResult): Promise<string>;
    commands(): {
        command: string;
        description: string;
        action: () => Promise<{
            success: boolean;
            message: string;
        }>;
    }[];
}
export declare const AvailableRouteMethods: {
    readonly payments: readonly ["createCheckout", "getPayment", "createSubscription", "getSubscription", "cancelSubscription", "resumeSubscription", "refundPayment", "setupPaymentMethod", "listPaymentMethods", "deletePaymentMethod", "setDefaultPaymentMethod", "webhook", "initMobilePayment", "initMobileSubscription", "confirmMobilePayment", "initMobileSetup", "getInvoice", "getCreditNote"];
};
export type PaymentMethods = (typeof AvailableRouteMethods.payments)[number];
