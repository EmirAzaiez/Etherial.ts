import { Request } from 'etherial/components/http/provider';
import { PaymentProvider, PaymentProviderFeature, CreateCustomerOptions, CustomerResult, CreateCheckoutOptions, CheckoutResult, PaymentResult, CreateSubscriptionOptions, SubscriptionResult, SubscriptionStatus, UpdateSubscriptionOptions, RefundOptions, RefundResult, SetupPaymentMethodOptions, SetupPaymentMethodResult, PaymentMethodResult, WebhookEvent, MobilePaymentInitOptions, MobilePaymentInitResult, MobileSubscriptionInitOptions, MobilePaymentConfirmOptions, MobilePaymentConfirmResult } from './base.js';
export interface PayPalConfig {
    client_id: string;
    client_secret: string;
    mode: 'sandbox' | 'live';
    webhook_id?: string;
}
export declare class PayPalProvider implements PaymentProvider {
    readonly name = "paypal";
    private config;
    private accessToken;
    private tokenExpiresAt;
    private static readonly UNSUPPORTED_FEATURES;
    initialize(config: PayPalConfig): Promise<void>;
    supports(feature: PaymentProviderFeature): boolean;
    private get baseUrl();
    private getAccessToken;
    private request;
    private mapPaymentStatus;
    private mapSubscriptionStatus;
    private formatMoney;
    private parseMoney;
    createCustomer(options: CreateCustomerOptions): Promise<CustomerResult>;
    getCustomer(customerId: string): Promise<CustomerResult | null>;
    updateCustomer(customerId: string, options: Partial<CreateCustomerOptions>): Promise<CustomerResult>;
    deleteCustomer(customerId: string): Promise<void>;
    createCheckout(options: CreateCheckoutOptions): Promise<CheckoutResult>;
    getPayment(paymentId: string): Promise<PaymentResult | null>;
    listPayments(customerId: string, limit?: number): Promise<PaymentResult[]>;
    createSubscription(options: CreateSubscriptionOptions): Promise<SubscriptionResult>;
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
    handleWebhook(req: Request, webhookId: string): Promise<WebhookEvent | null>;
    private mapWebhookEvent;
    /**
     * Convert amount from smallest unit to PayPal format
     */
    private toPayPalAmount;
    /**
     * Create a PayPal Order for mobile SDK
     * Returns order_id for the PayPal mobile SDK
     */
    initMobilePayment(options: MobilePaymentInitOptions): Promise<MobilePaymentInitResult>;
    /**
     * Create a PayPal Subscription for mobile SDK
     */
    initMobileSubscription(options: MobileSubscriptionInitOptions): Promise<MobilePaymentInitResult>;
    /**
     * Capture a PayPal Order after mobile SDK approval
     * This is REQUIRED for PayPal - the payment is not completed until captured
     */
    confirmMobilePayment(options: MobilePaymentConfirmOptions): Promise<MobilePaymentConfirmResult>;
}
