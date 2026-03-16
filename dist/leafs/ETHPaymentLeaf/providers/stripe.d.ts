import { Request } from 'etherial/components/http/provider';
import { PaymentProvider, PaymentProviderFeature, CreateCustomerOptions, CustomerResult, CreateCheckoutOptions, CheckoutResult, PaymentResult, CreateSubscriptionOptions, SubscriptionResult, SubscriptionStatus, UpdateSubscriptionOptions, RefundOptions, RefundResult, SetupPaymentMethodOptions, SetupPaymentMethodResult, PaymentMethodResult, WebhookEvent, MobilePaymentInitOptions, MobilePaymentInitResult, MobileSubscriptionInitOptions, MobilePaymentConfirmOptions, MobilePaymentConfirmResult } from './base.js';
export interface StripeConfig {
    secret_key: string;
    publishable_key?: string;
    webhook_secret?: string;
    api_version?: string;
}
export declare class StripeProvider implements PaymentProvider {
    readonly name = "stripe";
    private stripe;
    private config;
    private static readonly DEFAULT_API_VERSION;
    initialize(config: StripeConfig): Promise<void>;
    supports(feature: PaymentProviderFeature): boolean;
    private mapPaymentStatus;
    private mapSubscriptionStatus;
    createCustomer(options: CreateCustomerOptions): Promise<CustomerResult>;
    getCustomer(customerId: string): Promise<CustomerResult | null>;
    updateCustomer(customerId: string, options: Partial<CreateCustomerOptions>): Promise<CustomerResult>;
    deleteCustomer(customerId: string): Promise<void>;
    createCheckout(options: CreateCheckoutOptions): Promise<CheckoutResult>;
    getPayment(paymentId: string): Promise<PaymentResult | null>;
    listPayments(customerId: string, limit?: number): Promise<PaymentResult[]>;
    createSubscription(options: CreateSubscriptionOptions): Promise<SubscriptionResult>;
    private mapSubscription;
    getSubscription(subscriptionId: string): Promise<SubscriptionResult | null>;
    updateSubscription(subscriptionId: string, options: UpdateSubscriptionOptions): Promise<SubscriptionResult>;
    cancelSubscription(subscriptionId: string, immediate?: boolean): Promise<SubscriptionResult>;
    resumeSubscription(subscriptionId: string): Promise<SubscriptionResult>;
    listSubscriptions(customerId: string, status?: SubscriptionStatus): Promise<SubscriptionResult[]>;
    refund(options: RefundOptions): Promise<RefundResult>;
    getRefund(refundId: string): Promise<RefundResult | null>;
    setupPaymentMethod(options: SetupPaymentMethodOptions): Promise<SetupPaymentMethodResult>;
    listPaymentMethods(customerId: string): Promise<PaymentMethodResult[]>;
    setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void>;
    deletePaymentMethod(paymentMethodId: string): Promise<void>;
    handleWebhook(req: Request, webhookSecret: string): Promise<WebhookEvent | null>;
    private mapWebhookEvent;
    /**
     * Create a PaymentIntent for mobile SDK
     * Returns client_secret and ephemeral_key for the Stripe mobile SDK
     */
    initMobilePayment(options: MobilePaymentInitOptions): Promise<MobilePaymentInitResult>;
    /**
     * Create a Subscription for mobile SDK
     * Uses payment_behavior: 'default_incomplete' to get a PaymentIntent
     */
    initMobileSubscription(options: MobileSubscriptionInitOptions): Promise<MobilePaymentInitResult>;
    /**
     * Confirm/check status of a mobile payment
     * For Stripe, webhooks handle confirmation, but this can be used to check status
     */
    confirmMobilePayment(options: MobilePaymentConfirmOptions): Promise<MobilePaymentConfirmResult>;
    /**
     * Create a SetupIntent for mobile SDK (save card without charging)
     * Returns client_secret and ephemeral_key for the Stripe mobile SDK
     */
    initMobileSetup(customerId: string): Promise<{
        provider: string;
        customer_id: string;
        client_secret: string;
        ephemeral_key?: string;
        publishable_key?: string;
        raw?: any;
    }>;
}
