import { Request, Response } from 'etherial/components/http/provider';
import { CheckoutFormType, SubscriptionFormType, RefundFormType, SetupPaymentMethodFormType, MobilePaymentInitFormType, MobileSubscriptionInitFormType, MobilePaymentConfirmFormType, MobileSetupFormType, SetDefaultPaymentMethodFormType } from '../forms/payment_form.js';
export default class ETHPaymentLeafController {
    /**
     * Create a checkout session
     *
     * @route POST /payments/checkout
     * @access Private (requires authentication)
     */
    createCheckout(req: Request & {
        form: CheckoutFormType;
        user: any;
    }, res: Response): Promise<any>;
    /**
     * Get payment details
     *
     * @route GET /payments/:id
     * @access Private (requires authentication, must be owner)
     */
    getPayment(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /**
     * Create a subscription
     *
     * @route POST /payments/subscriptions
     * @access Private (requires authentication)
     */
    createSubscription(req: Request & {
        form: SubscriptionFormType;
        user: any;
    }, res: Response): Promise<any>;
    /**
     * Get subscription details
     *
     * @route GET /payments/subscriptions/:id
     * @access Private (requires authentication, must be owner)
     */
    getSubscription(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /**
     * Cancel a subscription
     *
     * @route DELETE /payments/subscriptions/:id
     * @access Private (requires authentication, must be owner)
     */
    cancelSubscription(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /**
     * Resume a cancelled subscription
     *
     * @route POST /payments/subscriptions/:id/resume
     * @access Private (requires authentication, must be owner)
     */
    resumeSubscription(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /**
     * Refund a payment
     *
     * @route POST /payments/:id/refund
     * @access Private (requires authentication, must be owner)
     */
    refundPayment(req: Request & {
        form: RefundFormType;
        user: any;
    }, res: Response): Promise<any>;
    /**
     * Setup a new payment method
     *
     * @route POST /payments/methods/setup
     * @access Private (requires authentication)
     */
    setupPaymentMethod(req: Request & {
        form: SetupPaymentMethodFormType;
        user: any;
    }, res: Response): Promise<any>;
    /**
     * List saved payment methods
     *
     * @route GET /payments/methods
     * @access Private (requires authentication)
     */
    listPaymentMethods(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /**
     * Delete a payment method
     *
     * @route DELETE /payments/methods/:id
     * @access Private (requires authentication)
     */
    deletePaymentMethod(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /**
     * Set a payment method as default
     *
     * @route PUT /payments/methods/:id/default
     * @access Private (requires authentication)
     */
    setDefaultPaymentMethod(req: Request & {
        form: SetDefaultPaymentMethodFormType;
        user: any;
    }, res: Response): Promise<any>;
    /**
     * Get invoice URL for a payment
     *
     * @route GET /payments/:id/invoice
     * @access Private (requires authentication, must be owner)
     */
    getInvoice(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /**
     * Get credit note URL for a payment
     *
     * @route GET /payments/:id/credit-note
     * @access Private (requires authentication, must be owner)
     */
    getCreditNote(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /**
     * Handle provider webhooks
     *
     * @route POST /payments/webhooks/:provider
     * @access Public (verified by provider signature)
     */
    webhook(req: Request, res: Response): Promise<any>;
    /**
     * Initialize a mobile payment
     *
     * @route POST /payments/mobile/init
     * @access Private (requires authentication)
     */
    initMobilePayment(req: Request & {
        form: MobilePaymentInitFormType;
        user: any;
    }, res: Response): Promise<any>;
    /**
     * Initialize a mobile subscription
     *
     * @route POST /payments/mobile/subscription
     * @access Private (requires authentication)
     */
    initMobileSubscription(req: Request & {
        form: MobileSubscriptionInitFormType;
        user: any;
    }, res: Response): Promise<any>;
    /**
     * Confirm a mobile payment
     *
     * @route POST /payments/mobile/confirm
     * @access Private (requires authentication)
     */
    confirmMobilePayment(req: Request & {
        form: MobilePaymentConfirmFormType;
        user: any;
    }, res: Response): Promise<any>;
    /**
     * Initialize mobile card setup (SetupIntent)
     * Returns client_secret + ephemeral_key for the Stripe mobile SDK
     *
     * @route POST /payments/mobile/setup
     * @access Private (requires authentication)
     */
    initMobileSetup(req: Request & {
        form: MobileSetupFormType;
        user: any;
    }, res: Response): Promise<any>;
}
