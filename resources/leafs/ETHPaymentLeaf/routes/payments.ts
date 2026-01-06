import etherial from 'etherial'

import { Controller, Post, Get, Delete, Request, Response } from 'etherial/components/http/provider'
import { ShouldValidateYupForm } from 'etherial/components/http/yup.validator'
import { ShouldBeAuthentificate } from 'etherial/components/http.security/provider'

import { User } from '../../models/User'
import { Payment } from '../models/Payment'
import { Subscription } from '../models/Subscription'
import { PaymentCustomer } from '../models/Customer'

import {
    CheckoutForm,
    CheckoutFormType,
    SubscriptionForm,
    SubscriptionFormType,
    RefundForm,
    RefundFormType,
    SetupPaymentMethodForm,
    SetupPaymentMethodFormType,
    MobilePaymentInitForm,
    MobilePaymentInitFormType,
    MobileSubscriptionInitForm,
    MobileSubscriptionInitFormType,
    MobilePaymentConfirmForm,
    MobilePaymentConfirmFormType,
} from '../forms/payment_form'

@Controller()
export default class ETHPaymentLeafController {
    // ==================== Checkout / One-time Payments ====================

    /**
     * Create a checkout session
     *
     * Creates a checkout URL for one-time payment.
     * Redirects user to provider's hosted payment page.
     *
     * @route POST /payments/checkout
     * @access Private (requires authentication)
     */
    @Post('/payments/checkout')
    @ShouldValidateYupForm(CheckoutForm)
    @ShouldBeAuthentificate()
    public async createCheckout(req: Request & { form: CheckoutFormType; user: User }, res: Response): Promise<any> {
        try {
            const provider = req.form.provider || etherial.eth_payment_leaf.config.default_provider

            // Validate provider is enabled
            const providerError = etherial.eth_payment_leaf.validateProvider(provider)
            if (providerError) {
                return res.error({
                    status: 400,
                    errors: [providerError.error],
                })
            }

            // Get or create customer
            const { customer } = await etherial.eth_payment_leaf.getOrCreateCustomer(
                req.user.id,
                req.user.email,
                req.user.getFullName?.() || `${req.user.firstname} ${req.user.lastname}`,
                provider
            )

            // Create checkout
            const checkout = await etherial.eth_payment_leaf.createCheckout({
                customer_id: customer.id,
                line_items: req.form.line_items.map(item => ({
                    name: item.name,
                    description: item.description,
                    quantity: item.quantity,
                    unit_amount: {
                        amount: item.amount,
                        currency: item.currency || 'usd',
                    },
                    image_url: item.image_url,
                })),
                success_url: req.form.success_url,
                cancel_url: req.form.cancel_url,
                metadata: {
                    user_id: req.user.id.toString(),
                    ...req.form.metadata,
                },
            }, provider)

            // Save to database
            await Payment.create({
                provider,
                provider_checkout_id: checkout.id,
                provider_payment_id: checkout.id, // Will be updated via webhook
                provider_customer_id: customer.id,
                status: 'pending',
                amount: req.form.line_items.reduce((sum, item) => sum + (item.amount * item.quantity), 0),
                currency: req.form.line_items[0]?.currency || 'usd',
                customer_email: req.user.email,
                metadata: req.form.metadata,
                user_id: req.user.id,
            })

            res.success({
                status: 200,
                data: {
                    checkout_id: checkout.id,
                    checkout_url: checkout.url,
                    provider,
                    expires_at: checkout.expires_at,
                },
            })
        } catch (error) {
            console.error('Error creating checkout:', error)
            res.error({
                status: 500,
                errors: ['api.payment.checkout_failed'],
            })
        }
    }

    /**
     * Get payment details
     *
     * @route GET /payments/:id
     * @access Private (requires authentication, must be owner)
     */
    @Get('/payments/:id(\\d+)')
    @ShouldBeAuthentificate()
    public async getPayment(req: Request & { user: User }, res: Response): Promise<any> {
        try {
            const paymentId = parseInt(req.params.id, 10)

            const payment = await Payment.findOne({
                where: {
                    id: paymentId,
                    user_id: req.user.id,
                },
            })

            if (!payment) {
                return res.error({
                    status: 404,
                    errors: ['api.payment.not_found'],
                })
            }

            res.success({
                status: 200,
                data: {
                    id: payment.id,
                    provider: payment.provider,
                    status: payment.status,
                    amount: payment.getDisplayAmount(),
                    amount_raw: payment.amount,
                    currency: payment.currency,
                    paid_at: payment.paid_at,
                    created_at: payment.created_at,
                    metadata: payment.metadata,
                },
            })
        } catch (error) {
            console.error('Error getting payment:', error)
            res.error({
                status: 500,
                errors: ['api.payment.get_failed'],
            })
        }
    }

    // ==================== Subscriptions ====================

    /**
     * Create a subscription
     *
     * @route POST /payments/subscriptions
     * @access Private (requires authentication)
     */
    @Post('/payments/subscriptions')
    @ShouldValidateYupForm(SubscriptionForm)
    @ShouldBeAuthentificate()
    public async createSubscription(req: Request & { form: SubscriptionFormType; user: User }, res: Response): Promise<any> {
        try {
            const provider = req.form.provider || etherial.eth_payment_leaf.config.default_provider

            // Validate provider is enabled
            const providerError = etherial.eth_payment_leaf.validateProvider(provider)
            if (providerError) {
                return res.error({
                    status: 400,
                    errors: [providerError.error],
                })
            }

            // Get or create customer
            const { customer } = await etherial.eth_payment_leaf.getOrCreateCustomer(
                req.user.id,
                req.user.email,
                req.user.getFullName?.() || `${req.user.firstname} ${req.user.lastname}`,
                provider
            )

            // Create subscription
            const subscription = await etherial.eth_payment_leaf.createSubscription({
                customer_id: customer.id,
                price_id: req.form.price_id,
                trial_days: req.form.trial_days,
                success_url: req.form.success_url,
                cancel_url: req.form.cancel_url,
                metadata: {
                    user_id: req.user.id.toString(),
                    plan_name: req.form.plan_name,
                    ...req.form.metadata,
                },
            }, provider)

            // Save to database
            await etherial.eth_payment_leaf.saveSubscription(subscription, req.user.id, req.form.plan_name)

            res.success({
                status: 200,
                data: {
                    subscription_id: subscription.id,
                    status: subscription.status,
                    checkout_url: subscription.checkout_url, // If checkout is needed
                    provider,
                    current_period_end: subscription.current_period_end,
                    trial_end: subscription.trial_end,
                },
            })
        } catch (error) {
            console.error('Error creating subscription:', error)
            res.error({
                status: 500,
                errors: ['api.payment.subscription_failed'],
            })
        }
    }

    /**
     * Get subscription details
     *
     * @route GET /payments/subscriptions/:id
     * @access Private (requires authentication, must be owner)
     */
    @Get('/payments/subscriptions/:id(\\d+)')
    @ShouldBeAuthentificate()
    public async getSubscription(req: Request & { user: User }, res: Response): Promise<any> {
        try {
            const subscriptionId = parseInt(req.params.id, 10)

            const subscription = await Subscription.findOne({
                where: {
                    id: subscriptionId,
                    user_id: req.user.id,
                },
            })

            if (!subscription) {
                return res.error({
                    status: 404,
                    errors: ['api.payment.subscription_not_found'],
                })
            }

            res.success({
                status: 200,
                data: {
                    id: subscription.id,
                    provider: subscription.provider,
                    plan_name: subscription.plan_name,
                    status: subscription.status,
                    price: subscription.getFormattedPrice(),
                    current_period_start: subscription.current_period_start,
                    current_period_end: subscription.current_period_end,
                    days_remaining: subscription.getDaysRemaining(),
                    cancel_at_period_end: subscription.cancel_at_period_end,
                    is_active: subscription.isActive(),
                    is_trialing: subscription.isTrialing(),
                    trial_days_remaining: subscription.getTrialDaysRemaining(),
                    can_resume: subscription.canResume(),
                    created_at: subscription.created_at,
                },
            })
        } catch (error) {
            console.error('Error getting subscription:', error)
            res.error({
                status: 500,
                errors: ['api.payment.subscription_get_failed'],
            })
        }
    }

    /**
     * Cancel a subscription
     *
     * @route DELETE /payments/subscriptions/:id
     * @access Private (requires authentication, must be owner)
     */
    @Delete('/payments/subscriptions/:id(\\d+)')
    @ShouldBeAuthentificate()
    public async cancelSubscription(req: Request & { user: User }, res: Response): Promise<any> {
        try {
            const subscriptionId = parseInt(req.params.id, 10)

            const localSubscription = await Subscription.findOne({
                where: {
                    id: subscriptionId,
                    user_id: req.user.id,
                },
            })

            if (!localSubscription) {
                return res.error({
                    status: 404,
                    errors: ['api.payment.subscription_not_found'],
                })
            }

            // Validate provider is still enabled
            const providerError = etherial.eth_payment_leaf.validateProvider(localSubscription.provider)
            if (providerError) {
                return res.error({
                    status: 400,
                    errors: [providerError.error],
                })
            }

            const immediate = req.query.immediate === 'true'

            // Cancel in provider
            const subscription = await etherial.eth_payment_leaf.cancelSubscription(
                localSubscription.provider_subscription_id,
                immediate,
                localSubscription.provider
            )

            // Update local
            await localSubscription.update({
                status: subscription.status,
                cancel_at_period_end: subscription.cancel_at_period_end,
                cancelled_at: subscription.cancelled_at,
            })

            res.success({
                status: 200,
                data: {
                    id: localSubscription.id,
                    status: subscription.status,
                    cancel_at_period_end: subscription.cancel_at_period_end,
                    current_period_end: subscription.current_period_end,
                },
            })
        } catch (error) {
            console.error('Error cancelling subscription:', error)
            res.error({
                status: 500,
                errors: ['api.payment.subscription_cancel_failed'],
            })
        }
    }

    /**
     * Resume a cancelled subscription
     *
     * @route POST /payments/subscriptions/:id/resume
     * @access Private (requires authentication, must be owner)
     */
    @Post('/payments/subscriptions/:id(\\d+)/resume')
    @ShouldBeAuthentificate()
    public async resumeSubscription(req: Request & { user: User }, res: Response): Promise<any> {
        try {
            const subscriptionId = parseInt(req.params.id, 10)

            const localSubscription = await Subscription.findOne({
                where: {
                    id: subscriptionId,
                    user_id: req.user.id,
                },
            })

            if (!localSubscription) {
                return res.error({
                    status: 404,
                    errors: ['api.payment.subscription_not_found'],
                })
            }

            if (!localSubscription.canResume()) {
                return res.error({
                    status: 400,
                    errors: ['api.payment.subscription_cannot_resume'],
                })
            }

            // Validate provider is still enabled
            const providerError = etherial.eth_payment_leaf.validateProvider(localSubscription.provider)
            if (providerError) {
                return res.error({
                    status: 400,
                    errors: [providerError.error],
                })
            }

            // Resume in provider
            const subscription = await etherial.eth_payment_leaf.resumeSubscription(
                localSubscription.provider_subscription_id,
                localSubscription.provider
            )

            // Update local
            await localSubscription.update({
                status: subscription.status,
                cancel_at_period_end: false,
            })

            res.success({
                status: 200,
                data: {
                    id: localSubscription.id,
                    status: subscription.status,
                    resumed: true,
                },
            })
        } catch (error) {
            console.error('Error resuming subscription:', error)
            res.error({
                status: 500,
                errors: ['api.payment.subscription_resume_failed'],
            })
        }
    }

    // ==================== Refunds ====================

    /**
     * Refund a payment
     *
     * @route POST /payments/:id/refund
     * @access Private (requires authentication, must be owner or admin)
     */
    @Post('/payments/:id(\\d+)/refund')
    @ShouldValidateYupForm(RefundForm)
    @ShouldBeAuthentificate()
    public async refundPayment(req: Request & { form: RefundFormType; user: User }, res: Response): Promise<any> {
        try {
            const paymentId = parseInt(req.params.id, 10)

            const payment = await Payment.findOne({
                where: {
                    id: paymentId,
                    user_id: req.user.id,
                },
            })

            if (!payment) {
                return res.error({
                    status: 404,
                    errors: ['api.payment.not_found'],
                })
            }

            if (!payment.canRefund()) {
                return res.error({
                    status: 400,
                    errors: ['api.payment.cannot_refund'],
                })
            }

            // Validate provider is still enabled
            const providerError = etherial.eth_payment_leaf.validateProvider(payment.provider)
            if (providerError) {
                return res.error({
                    status: 400,
                    errors: [providerError.error],
                })
            }

            const refundAmount = req.form.amount || payment.getRefundableAmount()

            if (refundAmount > payment.getRefundableAmount()) {
                return res.error({
                    status: 400,
                    errors: ['api.payment.refund_amount_exceeds'],
                })
            }

            // Process refund
            const refund = await etherial.eth_payment_leaf.refund({
                payment_id: payment.provider_payment_id,
                amount: req.form.amount ? {
                    amount: req.form.amount,
                    currency: payment.currency,
                } : undefined,
                reason: req.form.reason,
            }, payment.provider)

            // Update payment
            const newRefundedAmount = payment.amount_refunded + refundAmount
            await payment.update({
                amount_refunded: newRefundedAmount,
                status: newRefundedAmount >= payment.amount ? 'refunded' : 'partially_refunded',
            })

            res.success({
                status: 200,
                data: {
                    refund_id: refund.id,
                    status: refund.status,
                    amount_refunded: refundAmount,
                    payment_status: payment.status,
                },
            })
        } catch (error) {
            console.error('Error refunding payment:', error)
            res.error({
                status: 500,
                errors: ['api.payment.refund_failed'],
            })
        }
    }

    // ==================== Payment Methods ====================

    /**
     * Setup a new payment method
     *
     * @route POST /payments/methods/setup
     * @access Private (requires authentication)
     */
    @Post('/payments/methods/setup')
    @ShouldValidateYupForm(SetupPaymentMethodForm)
    @ShouldBeAuthentificate()
    public async setupPaymentMethod(req: Request & { form: SetupPaymentMethodFormType; user: User }, res: Response): Promise<any> {
        try {
            const provider = req.form.provider || etherial.eth_payment_leaf.config.default_provider

            // Validate provider is enabled
            const providerError = etherial.eth_payment_leaf.validateProvider(provider)
            if (providerError) {
                return res.error({
                    status: 400,
                    errors: [providerError.error],
                })
            }

            // Get or create customer
            const { customer } = await etherial.eth_payment_leaf.getOrCreateCustomer(
                req.user.id,
                req.user.email,
                req.user.getFullName?.() || `${req.user.firstname} ${req.user.lastname}`,
                provider
            )

            // Create setup session
            const setup = await etherial.eth_payment_leaf.setupPaymentMethod({
                customer_id: customer.id,
                success_url: req.form.success_url,
                cancel_url: req.form.cancel_url,
            }, provider)

            res.success({
                status: 200,
                data: {
                    setup_id: setup.id,
                    setup_url: setup.url,
                    provider,
                },
            })
        } catch (error) {
            console.error('Error setting up payment method:', error)
            res.error({
                status: 500,
                errors: ['api.payment.method_setup_failed'],
            })
        }
    }

    /**
     * List saved payment methods
     *
     * @route GET /payments/methods
     * @access Private (requires authentication)
     */
    @Get('/payments/methods')
    @ShouldBeAuthentificate()
    public async listPaymentMethods(req: Request & { user: User }, res: Response): Promise<any> {
        try {
            const provider = (req.query.provider as string) || etherial.eth_payment_leaf.config.default_provider

            // Validate provider is enabled
            const providerError = etherial.eth_payment_leaf.validateProvider(provider)
            if (providerError) {
                return res.error({
                    status: 400,
                    errors: [providerError.error],
                })
            }

            // Get customer
            const customer = await PaymentCustomer.findOne({
                where: { user_id: req.user.id, provider },
            })

            if (!customer) {
                return res.success({
                    status: 200,
                    data: [],
                })
            }

            const methods = await etherial.eth_payment_leaf.listPaymentMethods(
                customer.provider_customer_id,
                provider
            )

            res.success({
                status: 200,
                data: methods.map(m => ({
                    id: m.id,
                    type: m.type,
                    card: m.card,
                    is_default: m.is_default,
                })),
            })
        } catch (error) {
            console.error('Error listing payment methods:', error)
            res.error({
                status: 500,
                errors: ['api.payment.methods_list_failed'],
            })
        }
    }

    /**
     * Delete a payment method
     *
     * @route DELETE /payments/methods/:id
     * @access Private (requires authentication)
     */
    @Delete('/payments/methods/:id')
    @ShouldBeAuthentificate()
    public async deletePaymentMethod(req: Request & { user: User }, res: Response): Promise<any> {
        try {
            const provider = (req.query.provider as string) || etherial.eth_payment_leaf.config.default_provider
            const paymentMethodId = req.params.id

            // Validate provider is enabled
            const providerError = etherial.eth_payment_leaf.validateProvider(provider)
            if (providerError) {
                return res.error({
                    status: 400,
                    errors: [providerError.error],
                })
            }

            const providerInstance = etherial.eth_payment_leaf.getProviderOrThrow(provider)
            await providerInstance.deletePaymentMethod(paymentMethodId)

            res.success({
                status: 200,
                data: {
                    deleted: true,
                    id: paymentMethodId,
                },
            })
        } catch (error) {
            console.error('Error deleting payment method:', error)
            res.error({
                status: 500,
                errors: ['api.payment.method_delete_failed'],
            })
        }
    }

    // ==================== Webhooks ====================

    /**
     * Handle provider webhooks
     *
     * @route POST /payments/webhooks/:provider
     * @access Public (verified by provider signature)
     */
    @Post('/payments/webhooks/:provider')
    public async webhook(req: Request, res: Response): Promise<any> {
        const providerName = req.params.provider

        try {
            // Check if provider exists (but don't require it to be enabled for webhooks)
            const provider = etherial.eth_payment_leaf.getProvider(providerName)

            if (!provider) {
                console.error(`Webhook received for unknown provider: ${providerName}`)
                return res.status(400).json({ error: 'Unknown provider' })
            }

            const webhookSecret = etherial.eth_payment_leaf.getWebhookSecret(providerName)

            if (!webhookSecret) {
                console.error(`No webhook secret configured for provider: ${providerName}`)
                return res.status(500).json({ error: 'Webhook not configured' })
            }

            // Verify and parse webhook
            const event = await provider.handleWebhook(req, webhookSecret)

            if (!event) {
                console.error(`Webhook verification failed for provider: ${providerName}`)
                return res.status(400).json({ error: 'Verification failed' })
            }

            console.log(`[ETHPaymentLeaf] Webhook received: ${event.type} from ${providerName}`)

            // Handle different event types
            switch (event.type) {
                case 'checkout.completed':
                case 'payment.succeeded':
                    if (event.data.payment) {
                        const payment = await etherial.eth_payment_leaf.savePayment(event.data.payment)

                        // Call user callback
                        if (etherial.eth_payment_leaf.config.onPaymentCompleted) {
                            await etherial.eth_payment_leaf.config.onPaymentCompleted(event.data.payment, payment)
                        }
                    }
                    break

                case 'subscription.created':
                case 'subscription.updated':
                case 'subscription.cancelled':
                    if (event.data.subscription) {
                        const subscription = await etherial.eth_payment_leaf.saveSubscription(event.data.subscription)

                        // Call user callback
                        if (etherial.eth_payment_leaf.config.onSubscriptionUpdated) {
                            await etherial.eth_payment_leaf.config.onSubscriptionUpdated(event.data.subscription, subscription)
                        }
                    }
                    break

                case 'payment.failed':
                    if (event.data.payment) {
                        await Payment.update(
                            { status: 'failed' },
                            {
                                where: {
                                    provider: providerName,
                                    provider_payment_id: event.data.payment.id,
                                },
                            }
                        )
                    }
                    break

                case 'refund.created':
                    if (event.data.refund) {
                        const payment = await Payment.findOne({
                            where: {
                                provider: providerName,
                                provider_payment_id: event.data.refund.payment_id,
                            },
                        })

                        if (payment) {
                            const newRefundedAmount = payment.amount_refunded + event.data.refund.amount.amount
                            await payment.update({
                                amount_refunded: newRefundedAmount,
                                status: newRefundedAmount >= payment.amount ? 'refunded' : 'partially_refunded',
                            })
                        }
                    }
                    break
            }

            // Return 200 to acknowledge receipt
            res.status(200).json({ received: true })
        } catch (error) {
            console.error(`Webhook error for ${providerName}:`, error)
            res.status(500).json({ error: 'Webhook processing failed' })
        }
    }

    // ==================== Mobile Payments ====================

    /**
     * Initialize a mobile payment
     *
     * Returns provider-specific data for mobile SDKs:
     * - Stripe: client_secret, ephemeral_key, customer_id
     * - PayPal: order_id, client_id, environment
     *
     * @route POST /payments/mobile/init
     * @access Private (requires authentication)
     */
    @Post('/payments/mobile/init')
    @ShouldValidateYupForm(MobilePaymentInitForm)
    @ShouldBeAuthentificate()
    public async initMobilePayment(req: Request & { form: MobilePaymentInitFormType; user: User }, res: Response): Promise<any> {
        try {
            const { provider, amount, currency, metadata } = req.form

            // Validate provider is enabled
            const providerError = etherial.eth_payment_leaf.validateProvider(provider)
            if (providerError) {
                return res.error({
                    status: 400,
                    errors: [providerError.error],
                })
            }

            // Initialize mobile payment
            const result = await etherial.eth_payment_leaf.initMobilePayment(
                { amount, currency: currency as any, metadata },
                req.user.id,
                req.user.email,
                req.user.getFullName?.() || `${req.user.firstname || ''} ${req.user.lastname || ''}`.trim(),
                provider
            )

            res.success({
                status: 200,
                data: {
                    provider: result.provider,
                    payment_id: result.payment_id,
                    customer_id: result.customer_id,
                    // Stripe
                    client_secret: result.client_secret,
                    ephemeral_key: result.ephemeral_key,
                    publishable_key: result.publishable_key,
                    // PayPal
                    order_id: result.order_id,
                    paypal_client_id: result.paypal_client_id,
                    environment: result.environment,
                },
            })
        } catch (error) {
            console.error('Mobile payment init error:', error)
            res.error({ status: 500, errors: ['api.payment.mobile_init_failed'] })
        }
    }

    /**
     * Initialize a mobile subscription
     *
     * Returns provider-specific data for mobile SDKs.
     *
     * @route POST /payments/mobile/subscription
     * @access Private (requires authentication)
     */
    @Post('/payments/mobile/subscription')
    @ShouldValidateYupForm(MobileSubscriptionInitForm)
    @ShouldBeAuthentificate()
    public async initMobileSubscription(req: Request & { form: MobileSubscriptionInitFormType; user: User }, res: Response): Promise<any> {
        try {
            const { provider, price_id, trial_days, metadata } = req.form

            // Validate provider is enabled
            const providerError = etherial.eth_payment_leaf.validateProvider(provider)
            if (providerError) {
                return res.error({
                    status: 400,
                    errors: [providerError.error],
                })
            }

            // Initialize mobile subscription
            const result = await etherial.eth_payment_leaf.initMobileSubscription(
                { price_id, trial_days, metadata },
                req.user.id,
                req.user.email,
                req.user.getFullName?.() || `${req.user.firstname || ''} ${req.user.lastname || ''}`.trim(),
                provider
            )

            res.success({
                status: 200,
                data: {
                    provider: result.provider,
                    payment_id: result.payment_id,
                    customer_id: result.customer_id,
                    // Stripe
                    client_secret: result.client_secret,
                    ephemeral_key: result.ephemeral_key,
                    publishable_key: result.publishable_key,
                    // PayPal
                    order_id: result.order_id,
                    paypal_client_id: result.paypal_client_id,
                    environment: result.environment,
                },
            })
        } catch (error) {
            console.error('Mobile subscription init error:', error)
            res.error({ status: 500, errors: ['api.payment.mobile_subscription_init_failed'] })
        }
    }

    /**
     * Confirm a mobile payment
     *
     * For PayPal: Captures the order after SDK approval (REQUIRED)
     * For Stripe: Checks payment status (webhooks handle confirmation)
     *
     * @route POST /payments/mobile/confirm
     * @access Private (requires authentication)
     */
    @Post('/payments/mobile/confirm')
    @ShouldValidateYupForm(MobilePaymentConfirmForm)
    @ShouldBeAuthentificate()
    public async confirmMobilePayment(req: Request & { form: MobilePaymentConfirmFormType; user: User }, res: Response): Promise<any> {
        try {
            const { provider, payment_id } = req.form

            // Validate provider is enabled
            const providerError = etherial.eth_payment_leaf.validateProvider(provider)
            if (providerError) {
                return res.error({
                    status: 400,
                    errors: [providerError.error],
                })
            }

            // Confirm payment
            const result = await etherial.eth_payment_leaf.confirmMobilePayment(payment_id, provider)

            // Update local payment if successful
            if (result.success) {
                await Payment.update(
                    {
                        status: 'succeeded',
                        paid_at: new Date(),
                    },
                    {
                        where: {
                            provider,
                            provider_payment_id: payment_id,
                            user_id: req.user.id,
                        },
                    }
                )
            }

            res.success({
                status: 200,
                data: {
                    success: result.success,
                    status: result.status,
                    capture_id: result.capture_id,
                },
            })
        } catch (error) {
            console.error('Mobile payment confirm error:', error)
            res.error({ status: 500, errors: ['api.payment.mobile_confirm_failed'] })
        }
    }
}
