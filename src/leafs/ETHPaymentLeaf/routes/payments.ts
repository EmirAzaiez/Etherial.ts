import etherial from 'etherial'

import { Controller, Post, Get, Put, Delete, Request, Response } from 'etherial/components/http/provider'
import { ShouldValidateYupForm } from 'etherial/components/http/yup.validator'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'

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
    MobileSetupForm,
    MobileSetupFormType,
    SetDefaultPaymentMethodForm,
    SetDefaultPaymentMethodFormType
} from '../forms/payment_form.js'

import { toSmallestUnit } from '../providers/base.js'

// Dynamic model access — resolves consumer's concrete models at runtime
const leaf = () => (etherial as any).eth_payment_leaf
const Payment = () => leaf().Payment
const Subscription = () => leaf().Subscription
const PaymentCustomer = () => leaf().PaymentCustomer

@Controller()
export default class ETHPaymentLeafController {
    // ==================== Checkout / One-time Payments ====================

    /**
     * Create a checkout session
     *
     * @route POST /payments/checkout
     * @access Private (requires authentication)
     */
    @Post('/payments/checkout')
    @ShouldValidateYupForm(CheckoutForm)
    @ShouldBeAuthenticated()
    public async createCheckout(req: Request & { form: CheckoutFormType; user: any }, res: Response): Promise<any> {
        try {
            const provider = req.form.provider || leaf().config.default_provider

            const providerError = leaf().validateProvider(provider)
            if (providerError) {
                return res.error({ status: 400, errors: [providerError.error] })
            }

            const { customer } = await leaf().getOrCreateCustomer(req.user.id, req.user.email, req.user.getFullName?.() || `${req.user.firstname} ${req.user.lastname}`, provider)

            const checkout = await leaf().createCheckout(
                {
                    customer_id: customer.id,
                    line_items: req.form.line_items.map((item: any) => ({
                        name: item.name,
                        description: item.description,
                        quantity: item.quantity,
                        unit_amount: {
                            amount: toSmallestUnit(item.amount, item.currency || 'usd'),
                            currency: item.currency || 'usd'
                        },
                        image_url: item.image_url
                    })),
                    success_url: req.form.success_url,
                    cancel_url: req.form.cancel_url,
                    metadata: {
                        user_id: req.user.id.toString(),
                        ...req.form.metadata
                    }
                },
                provider
            )

            await Payment().create({
                provider,
                provider_checkout_id: checkout.id,
                provider_payment_id: checkout.id,
                provider_customer_id: customer.id,
                status: 'pending',
                amount: req.form.line_items.reduce((sum: number, item: any) => sum + item.amount * item.quantity, 0),
                currency: req.form.line_items[0]?.currency || 'usd',
                customer_email: req.user.email,
                metadata: req.form.metadata,
                user_id: req.user.id
            })

            res.success({
                status: 200,
                data: {
                    checkout_id: checkout.id,
                    checkout_url: checkout.url,
                    provider,
                    expires_at: checkout.expires_at
                }
            })
        } catch (error) {
            console.error('Error creating checkout:', error)
            res.error({ status: 500, errors: ['api.payment.checkout_failed'] })
        }
    }

    /**
     * Get payment details
     *
     * @route GET /payments/:id
     * @access Private (requires authentication, must be owner)
     */
    @Get('/payments/:id(\\d+)')
    @ShouldBeAuthenticated()
    public async getPayment(req: Request & { user: any }, res: Response): Promise<any> {
        try {
            const paymentId = parseInt((req.params as any).id, 10)

            const payment = await Payment().findOne({
                where: { id: paymentId, user_id: req.user.id }
            })

            if (!payment) {
                return res.error({ status: 404, errors: ['api.payment.not_found'] })
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
                    payment_method: payment.getPaymentMethodDetails(),
                    metadata: payment.metadata
                }
            })
        } catch (error) {
            console.error('Error getting payment:', error)
            res.error({ status: 500, errors: ['api.payment.get_failed'] })
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
    @ShouldBeAuthenticated()
    public async createSubscription(req: Request & { form: SubscriptionFormType; user: any }, res: Response): Promise<any> {
        try {
            const provider = req.form.provider || leaf().config.default_provider

            const providerError = leaf().validateProvider(provider)
            if (providerError) {
                return res.error({ status: 400, errors: [providerError.error] })
            }

            const { customer } = await leaf().getOrCreateCustomer(req.user.id, req.user.email, req.user.getFullName?.() || `${req.user.firstname} ${req.user.lastname}`, provider)

            const subscription = await leaf().createSubscription(
                {
                    customer_id: customer.id,
                    price_id: req.form.price_id,
                    trial_days: req.form.trial_days,
                    success_url: req.form.success_url,
                    cancel_url: req.form.cancel_url,
                    metadata: {
                        user_id: req.user.id.toString(),
                        plan_name: req.form.plan_name,
                        ...req.form.metadata
                    }
                },
                provider
            )

            await leaf().saveSubscription(subscription, req.user.id, req.form.plan_name)

            res.success({
                status: 200,
                data: {
                    subscription_id: subscription.id,
                    status: subscription.status,
                    checkout_url: subscription.checkout_url,
                    provider,
                    current_period_end: subscription.current_period_end,
                    trial_end: subscription.trial_end
                }
            })
        } catch (error) {
            console.error('Error creating subscription:', error)
            res.error({ status: 500, errors: ['api.payment.subscription_failed'] })
        }
    }

    /**
     * Get subscription details
     *
     * @route GET /payments/subscriptions/:id
     * @access Private (requires authentication, must be owner)
     */
    @Get('/payments/subscriptions/:id(\\d+)')
    @ShouldBeAuthenticated()
    public async getSubscription(req: Request & { user: any }, res: Response): Promise<any> {
        try {
            const subscriptionId = parseInt((req.params as any).id, 10)

            const subscription = await Subscription().findOne({
                where: { id: subscriptionId, user_id: req.user.id }
            })

            if (!subscription) {
                return res.error({ status: 404, errors: ['api.payment.subscription_not_found'] })
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
                    created_at: subscription.created_at
                }
            })
        } catch (error) {
            console.error('Error getting subscription:', error)
            res.error({ status: 500, errors: ['api.payment.subscription_get_failed'] })
        }
    }

    /**
     * Cancel a subscription
     *
     * @route DELETE /payments/subscriptions/:id
     * @access Private (requires authentication, must be owner)
     */
    @Delete('/payments/subscriptions/:id(\\d+)')
    @ShouldBeAuthenticated()
    public async cancelSubscription(req: Request & { user: any }, res: Response): Promise<any> {
        try {
            const subscriptionId = parseInt((req.params as any).id, 10)

            const localSubscription = await Subscription().findOne({
                where: { id: subscriptionId, user_id: req.user.id }
            })

            if (!localSubscription) {
                return res.error({ status: 404, errors: ['api.payment.subscription_not_found'] })
            }

            const providerError = leaf().validateProvider(localSubscription.provider)
            if (providerError) {
                return res.error({ status: 400, errors: [providerError.error] })
            }

            const immediate = req.query.immediate === 'true'

            const subscription = await leaf().cancelSubscription(localSubscription.provider_subscription_id, immediate, localSubscription.provider)

            await localSubscription.update({
                status: subscription.status,
                cancel_at_period_end: subscription.cancel_at_period_end,
                cancelled_at: subscription.cancelled_at
            })

            res.success({
                status: 200,
                data: {
                    id: localSubscription.id,
                    status: subscription.status,
                    cancel_at_period_end: subscription.cancel_at_period_end,
                    current_period_end: subscription.current_period_end
                }
            })
        } catch (error) {
            console.error('Error cancelling subscription:', error)
            res.error({ status: 500, errors: ['api.payment.subscription_cancel_failed'] })
        }
    }

    /**
     * Resume a cancelled subscription
     *
     * @route POST /payments/subscriptions/:id/resume
     * @access Private (requires authentication, must be owner)
     */
    @Post('/payments/subscriptions/:id(\\d+)/resume')
    @ShouldBeAuthenticated()
    public async resumeSubscription(req: Request & { user: any }, res: Response): Promise<any> {
        try {
            const subscriptionId = parseInt((req.params as any).id, 10)

            const localSubscription = await Subscription().findOne({
                where: { id: subscriptionId, user_id: req.user.id }
            })

            if (!localSubscription) {
                return res.error({ status: 404, errors: ['api.payment.subscription_not_found'] })
            }

            if (!localSubscription.canResume()) {
                return res.error({ status: 400, errors: ['api.payment.subscription_cannot_resume'] })
            }

            const providerError = leaf().validateProvider(localSubscription.provider)
            if (providerError) {
                return res.error({ status: 400, errors: [providerError.error] })
            }

            const subscription = await leaf().resumeSubscription(localSubscription.provider_subscription_id, localSubscription.provider)

            await localSubscription.update({
                status: subscription.status,
                cancel_at_period_end: false
            })

            res.success({
                status: 200,
                data: {
                    id: localSubscription.id,
                    status: subscription.status,
                    resumed: true
                }
            })
        } catch (error) {
            console.error('Error resuming subscription:', error)
            res.error({ status: 500, errors: ['api.payment.subscription_resume_failed'] })
        }
    }

    // ==================== Refunds ====================

    /**
     * Refund a payment
     *
     * @route POST /payments/:id/refund
     * @access Private (requires authentication, must be owner)
     */
    @Post('/payments/:id(\\d+)/refund')
    @ShouldValidateYupForm(RefundForm)
    @ShouldBeAuthenticated()
    public async refundPayment(req: Request & { form: RefundFormType; user: any }, res: Response): Promise<any> {
        try {
            const paymentId = parseInt((req.params as any).id, 10)

            const payment = await Payment().findOne({
                where: { id: paymentId, user_id: req.user.id }
            })

            if (!payment) {
                return res.error({ status: 404, errors: ['api.payment.not_found'] })
            }

            if (!payment.canRefund()) {
                return res.error({ status: 400, errors: ['api.payment.cannot_refund'] })
            }

            const providerError = leaf().validateProvider(payment.provider)
            if (providerError) {
                return res.error({ status: 400, errors: [providerError.error] })
            }

            const refundAmount = req.form.amount || payment.getRefundableAmount()

            if (refundAmount > payment.getRefundableAmount()) {
                return res.error({ status: 400, errors: ['api.payment.refund_amount_exceeds'] })
            }

            const refund = await leaf().refund(
                {
                    payment_id: payment.provider_payment_id,
                    amount: req.form.amount
                        ? {
                              amount: req.form.amount,
                              currency: payment.currency
                          }
                        : undefined,
                    reason: req.form.reason
                },
                payment.provider
            )

            const newRefundedAmount = payment.amount_refunded + refundAmount
            await payment.update({
                amount_refunded: newRefundedAmount,
                status: newRefundedAmount >= payment.amount ? 'refunded' : 'partially_refunded'
            })

            res.success({
                status: 200,
                data: {
                    refund_id: refund.id,
                    status: refund.status,
                    amount_refunded: refundAmount,
                    payment_status: payment.status
                }
            })
        } catch (error) {
            console.error('Error refunding payment:', error)
            res.error({ status: 500, errors: ['api.payment.refund_failed'] })
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
    @ShouldBeAuthenticated()
    public async setupPaymentMethod(req: Request & { form: SetupPaymentMethodFormType; user: any }, res: Response): Promise<any> {
        try {
            const provider = req.form.provider || leaf().config.default_provider

            const providerError = leaf().validateProvider(provider)
            if (providerError) {
                return res.error({ status: 400, errors: [providerError.error] })
            }

            const { customer } = await leaf().getOrCreateCustomer(req.user.id, req.user.email, req.user.getFullName?.() || `${req.user.firstname} ${req.user.lastname}`, provider)

            const setup = await leaf().setupPaymentMethod(
                {
                    customer_id: customer.id,
                    success_url: req.form.success_url,
                    cancel_url: req.form.cancel_url
                },
                provider
            )

            res.success({
                status: 200,
                data: {
                    setup_id: setup.id,
                    setup_url: setup.url,
                    provider
                }
            })
        } catch (error) {
            console.error('Error setting up payment method:', error)
            res.error({ status: 500, errors: ['api.payment.method_setup_failed'] })
        }
    }

    /**
     * List saved payment methods
     *
     * @route GET /payments/methods
     * @access Private (requires authentication)
     */
    @Get('/payments/methods')
    @ShouldBeAuthenticated()
    public async listPaymentMethods(req: Request & { user: any }, res: Response): Promise<any> {
        try {
            const provider = (req.query.provider as string) || leaf().config.default_provider

            const providerError = leaf().validateProvider(provider)
            if (providerError) {
                return res.error({ status: 400, errors: [providerError.error] })
            }

            const customer = await PaymentCustomer().findOne({
                where: { user_id: req.user.id, provider }
            })

            if (!customer) {
                return res.success({ status: 200, data: [] })
            }

            const methods = await leaf().listPaymentMethods(customer.provider_customer_id, provider)

            res.success({
                status: 200,
                data: methods.map((m: any) => ({
                    id: m.id,
                    type: m.type,
                    card: m.card,
                    is_default: m.is_default
                }))
            })
        } catch (error) {
            console.error('Error listing payment methods:', error)
            res.error({ status: 500, errors: ['api.payment.methods_list_failed'] })
        }
    }

    /**
     * Delete a payment method
     *
     * @route DELETE /payments/methods/:id
     * @access Private (requires authentication)
     */
    @Delete('/payments/methods/:id')
    @ShouldBeAuthenticated()
    public async deletePaymentMethod(req: Request & { user: any }, res: Response): Promise<any> {
        try {
            const provider = (req.query.provider as string) || leaf().config.default_provider
            const paymentMethodId = (req.params as any).id

            const providerError = leaf().validateProvider(provider)
            if (providerError) {
                return res.error({ status: 400, errors: [providerError.error] })
            }

            // Verify ownership
            const customer = await PaymentCustomer().findOne({
                where: { user_id: req.user.id, provider }
            })

            if (!customer) {
                return res.error({ status: 403, errors: ['api.payment.method_not_owned'] })
            }

            const providerInstance = leaf().getProviderOrThrow(provider)
            const methods = await providerInstance.listPaymentMethods(customer.provider_customer_id)
            const ownsMethod = methods.some((m: any) => m.id === paymentMethodId)

            if (!ownsMethod) {
                return res.error({ status: 403, errors: ['api.payment.method_not_owned'] })
            }

            await providerInstance.deletePaymentMethod(paymentMethodId)

            res.success({
                status: 200,
                data: { deleted: true, id: paymentMethodId }
            })
        } catch (error) {
            console.error('Error deleting payment method:', error)
            res.error({ status: 500, errors: ['api.payment.method_delete_failed'] })
        }
    }

    /**
     * Set a payment method as default
     *
     * @route PUT /payments/methods/:id/default
     * @access Private (requires authentication)
     */
    @Put('/payments/methods/:id/default')
    @ShouldValidateYupForm(SetDefaultPaymentMethodForm)
    @ShouldBeAuthenticated()
    public async setDefaultPaymentMethod(req: Request & { form: SetDefaultPaymentMethodFormType; user: any }, res: Response): Promise<any> {
        try {
            const provider = req.form.provider || leaf().config.default_provider
            const paymentMethodId = (req.params as any).id

            const providerError = leaf().validateProvider(provider)
            if (providerError) {
                return res.error({ status: 400, errors: [providerError.error] })
            }

            // Verify ownership
            const customer = await PaymentCustomer().findOne({
                where: { user_id: req.user.id, provider }
            })

            if (!customer) {
                return res.error({ status: 403, errors: ['api.payment.method_not_owned'] })
            }

            const providerInstance = leaf().getProviderOrThrow(provider)
            const methods = await providerInstance.listPaymentMethods(customer.provider_customer_id)
            const ownsMethod = methods.some((m: any) => m.id === paymentMethodId)

            if (!ownsMethod) {
                return res.error({ status: 403, errors: ['api.payment.method_not_owned'] })
            }

            await providerInstance.setDefaultPaymentMethod(customer.provider_customer_id, paymentMethodId)

            res.success({
                status: 200,
                data: { id: paymentMethodId, is_default: true }
            })
        } catch (error) {
            console.error('Error setting default payment method:', error)
            res.error({ status: 500, errors: ['api.payment.method_default_failed'] })
        }
    }

    // ==================== Invoices ====================

    /**
     * Get invoice URL for a payment
     *
     * @route GET /payments/:id/invoice
     * @access Private (requires authentication, must be owner)
     */
    @Get('/payments/:id(\\d+)/invoice')
    @ShouldBeAuthenticated()
    public async getInvoice(req: Request & { user: any }, res: Response): Promise<any> {
        try {
            const paymentId = parseInt((req.params as any).id, 10)

            const payment = await Payment().findOne({
                where: { id: paymentId, user_id: req.user.id }
            })

            if (!payment) {
                return res.error({ status: 404, errors: ['api.payment.not_found'] })
            }

            if (!payment.invoice_url) {
                return res.error({ status: 404, errors: ['api.payment.invoice_not_found'] })
            }

            res.success({
                status: 200,
                data: { invoice_url: payment.invoice_url }
            })
        } catch (error) {
            console.error('Error getting invoice:', error)
            res.error({ status: 500, errors: ['api.payment.invoice_get_failed'] })
        }
    }

    /**
     * Get credit note URL for a payment
     *
     * @route GET /payments/:id/credit-note
     * @access Private (requires authentication, must be owner)
     */
    @Get('/payments/:id(\\d+)/credit-note')
    @ShouldBeAuthenticated()
    public async getCreditNote(req: Request & { user: any }, res: Response): Promise<any> {
        try {
            const paymentId = parseInt((req.params as any).id, 10)

            const payment = await Payment().findOne({
                where: { id: paymentId, user_id: req.user.id }
            })

            if (!payment) {
                return res.error({ status: 404, errors: ['api.payment.not_found'] })
            }

            if (!payment.credit_note_url) {
                return res.error({ status: 404, errors: ['api.payment.credit_note_not_found'] })
            }

            res.success({
                status: 200,
                data: { credit_note_url: payment.credit_note_url }
            })
        } catch (error) {
            console.error('Error getting credit note:', error)
            res.error({ status: 500, errors: ['api.payment.credit_note_get_failed'] })
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
        const providerName = (req.params as any).provider

        try {
            const provider = leaf().getProvider(providerName)

            if (!provider) {
                console.error(`Webhook received for unknown provider: ${providerName}`)
                return res.status(400).json({ error: 'Unknown provider' })
            }

            const webhookSecret = leaf().getWebhookSecret(providerName)

            if (!webhookSecret) {
                console.error(`No webhook secret configured for provider: ${providerName}`)
                return res.status(500).json({ error: 'Webhook not configured' })
            }

            const event = await provider.handleWebhook(req, webhookSecret)

            if (!event) {
                console.error(`Webhook verification failed for provider: ${providerName}`)
                return res.status(400).json({ error: 'Verification failed' })
            }

            console.log(`[ETHPaymentLeaf] Webhook received: ${event.type} from ${providerName}`)

            const callbacks = leaf().callbacks

            switch (event.type) {
                case 'checkout.completed':
                case 'payment.succeeded':
                    if (event.data.payment) {
                        const payment = await leaf().savePayment(event.data.payment)

                        if (leaf().config.invoices?.enabled) {
                            try {
                                await leaf().generateInvoiceForPayment(payment, event.data.payment)
                            } catch (err) {
                                console.error('[ETHPaymentLeaf] Invoice generation failed:', err)
                            }
                        }

                        if (callbacks.onPaymentCompleted) {
                            await callbacks.onPaymentCompleted(event.data.payment, payment)
                        }
                    }
                    break

                case 'subscription.created':
                case 'subscription.updated':
                case 'subscription.cancelled':
                    if (event.data.subscription) {
                        const subscription = await leaf().saveSubscription(event.data.subscription)

                        if (callbacks.onSubscriptionUpdated) {
                            await callbacks.onSubscriptionUpdated(event.data.subscription, subscription)
                        }
                    }
                    break

                case 'payment.failed':
                    if (event.data.payment) {
                        const PaymentModel = Payment()
                        const localPayment = await PaymentModel.findOne({
                            where: {
                                provider: providerName,
                                provider_payment_id: event.data.payment.id
                            }
                        })

                        if (localPayment) {
                            await localPayment.update({ status: 'failed' })
                        }

                        if (callbacks.onPaymentFailed) {
                            await callbacks.onPaymentFailed(event.data.payment, localPayment)
                        }
                    }
                    break

                case 'refund.created':
                    if (event.data.refund) {
                        const PaymentModel = Payment()
                        const refundPayment = await PaymentModel.findOne({
                            where: {
                                provider: providerName,
                                provider_payment_id: event.data.refund.payment_id
                            }
                        })

                        if (refundPayment) {
                            const newRefundedAmount = refundPayment.amount_refunded + event.data.refund.amount.amount
                            await refundPayment.update({
                                amount_refunded: newRefundedAmount,
                                status: newRefundedAmount >= refundPayment.amount ? 'refunded' : 'partially_refunded'
                            })

                            if (leaf().config.invoices?.enabled) {
                                try {
                                    await leaf().generateCreditNoteForPayment(refundPayment, event.data.refund)
                                } catch (err) {
                                    console.error('[ETHPaymentLeaf] Credit note generation failed:', err)
                                }
                            }
                        }

                        if (callbacks.onRefundCreated) {
                            await callbacks.onRefundCreated(event.data.refund, refundPayment)
                        }
                    }
                    break
            }

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
     * @route POST /payments/mobile/init
     * @access Private (requires authentication)
     */
    @Post('/payments/mobile/init')
    @ShouldValidateYupForm(MobilePaymentInitForm)
    @ShouldBeAuthenticated()
    public async initMobilePayment(req: Request & { form: MobilePaymentInitFormType; user: any }, res: Response): Promise<any> {
        try {
            let { provider, amount, currency, metadata, idempotency_key } = req.form

            const providerError = leaf().validateProvider(provider)
            if (providerError) {
                return res.error({ status: 400, errors: [providerError.error] })
            }

            // The frontend sometimes sends decimal amounts (e.g. 2.04 instead of 204)
            // Ensure the amount is accurately converted into the smallest currency unit (cents/fils)
            amount = toSmallestUnit(amount, currency as any)

            const result = await leaf().initMobilePayment(
                { amount, currency: currency as any, metadata, idempotency_key },
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
                    environment: result.environment
                }
            })
        } catch (error) {
            console.error('Mobile payment init error:', error)
            res.error({ status: 500, errors: ['api.payment.mobile_init_failed'] })
        }
    }

    /**
     * Initialize a mobile subscription
     *
     * @route POST /payments/mobile/subscription
     * @access Private (requires authentication)
     */
    @Post('/payments/mobile/subscription')
    @ShouldValidateYupForm(MobileSubscriptionInitForm)
    @ShouldBeAuthenticated()
    public async initMobileSubscription(req: Request & { form: MobileSubscriptionInitFormType; user: any }, res: Response): Promise<any> {
        try {
            const { provider, price_id, trial_days, metadata, idempotency_key } = req.form

            const providerError = leaf().validateProvider(provider)
            if (providerError) {
                return res.error({ status: 400, errors: [providerError.error] })
            }

            const result = await leaf().initMobileSubscription(
                { price_id, trial_days, metadata, idempotency_key },
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
                    environment: result.environment
                }
            })
        } catch (error) {
            console.error('Mobile subscription init error:', error)
            res.error({ status: 500, errors: ['api.payment.mobile_subscription_init_failed'] })
        }
    }

    /**
     * Confirm a mobile payment
     *
     * @route POST /payments/mobile/confirm
     * @access Private (requires authentication)
     */
    @Post('/payments/mobile/confirm')
    @ShouldValidateYupForm(MobilePaymentConfirmForm)
    @ShouldBeAuthenticated()
    public async confirmMobilePayment(req: Request & { form: MobilePaymentConfirmFormType; user: any }, res: Response): Promise<any> {
        try {
            const { provider, payment_id } = req.form

            const providerError = leaf().validateProvider(provider)
            if (providerError) {
                return res.error({ status: 400, errors: [providerError.error] })
            }

            const result = await leaf().confirmMobilePayment(payment_id, provider)

            if (result.success) {
                await Payment().update(
                    {
                        status: 'succeeded',
                        paid_at: new Date(),
                        provider_data: result.raw
                    },
                    {
                        where: {
                            provider,
                            provider_payment_id: payment_id,
                            user_id: req.user.id
                        }
                    }
                )
            }

            res.success({
                status: 200,
                data: {
                    success: result.success,
                    status: result.status,
                    capture_id: result.capture_id
                }
            })
        } catch (error) {
            console.error('Mobile payment confirm error:', error)
            res.error({ status: 500, errors: ['api.payment.mobile_confirm_failed'] })
        }
    }

    /**
     * Initialize mobile card setup (SetupIntent)
     * Returns client_secret + ephemeral_key for the Stripe mobile SDK
     *
     * @route POST /payments/mobile/setup
     * @access Private (requires authentication)
     */
    @Post('/payments/mobile/setup')
    @ShouldValidateYupForm(MobileSetupForm)
    @ShouldBeAuthenticated()
    public async initMobileSetup(req: Request & { form: MobileSetupFormType; user: any }, res: Response): Promise<any> {
        try {
            const provider = req.form.provider || leaf().config.default_provider

            const providerError = leaf().validateProvider(provider)
            if (providerError) {
                return res.error({ status: 400, errors: [providerError.error] })
            }

            const result = await leaf().initMobileSetup(req.user.id, req.user.email, req.user.getFullName?.() || `${req.user.firstname || ''} ${req.user.lastname || ''}`.trim(), provider)

            res.success({
                status: 200,
                data: {
                    provider: result.provider,
                    customer_id: result.customer_id,
                    client_secret: result.client_secret,
                    ephemeral_key: result.ephemeral_key,
                    publishable_key: result.publishable_key
                }
            })
        } catch (error) {
            console.error('Mobile setup error:', error)
            res.error({ status: 500, errors: ['api.payment.mobile_setup_failed'] })
        }
    }
}
