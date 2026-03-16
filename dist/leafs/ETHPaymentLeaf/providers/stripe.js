var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import Stripe from 'stripe';
import { registerProvider } from './base.js';
export class StripeProvider {
    constructor() {
        this.name = 'stripe';
    }
    initialize(config) {
        return __awaiter(this, void 0, void 0, function* () {
            this.config = config;
            this.stripe = new Stripe(config.secret_key, {
                apiVersion: config.api_version || StripeProvider.DEFAULT_API_VERSION
            });
        });
    }
    supports(feature) {
        return true;
    }
    // ==================== Helpers ====================
    mapPaymentStatus(status) {
        const mapping = {
            requires_payment_method: 'pending',
            requires_confirmation: 'pending',
            requires_action: 'pending',
            processing: 'processing',
            requires_capture: 'processing',
            succeeded: 'succeeded',
            canceled: 'cancelled'
        };
        return mapping[status] || 'pending';
    }
    mapSubscriptionStatus(status) {
        const mapping = {
            active: 'active',
            canceled: 'cancelled',
            past_due: 'past_due',
            paused: 'paused',
            trialing: 'trialing',
            unpaid: 'unpaid',
            incomplete: 'pending',
            incomplete_expired: 'expired'
        };
        return mapping[status] || 'active';
    }
    // ==================== Customers ====================
    createCustomer(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const customer = yield this.stripe.customers.create({
                email: options.email,
                name: options.name,
                phone: options.phone,
                address: options.address
                    ? {
                        line1: options.address.line1,
                        line2: options.address.line2,
                        city: options.address.city,
                        state: options.address.state,
                        postal_code: options.address.postal_code,
                        country: options.address.country
                    }
                    : undefined,
                metadata: options.metadata
            });
            return {
                id: customer.id,
                provider: this.name,
                email: customer.email,
                name: customer.name || undefined,
                metadata: customer.metadata,
                raw: customer
            };
        });
    }
    getCustomer(customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const customer = yield this.stripe.customers.retrieve(customerId);
                if (customer.deleted)
                    return null;
                return {
                    id: customer.id,
                    provider: this.name,
                    email: customer.email,
                    name: customer.name || undefined,
                    metadata: customer.metadata,
                    raw: customer
                };
            }
            catch (_a) {
                return null;
            }
        });
    }
    updateCustomer(customerId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const customer = yield this.stripe.customers.update(customerId, {
                email: options.email,
                name: options.name,
                phone: options.phone,
                address: options.address
                    ? {
                        line1: options.address.line1,
                        line2: options.address.line2,
                        city: options.address.city,
                        state: options.address.state,
                        postal_code: options.address.postal_code,
                        country: options.address.country
                    }
                    : undefined,
                metadata: options.metadata
            });
            return {
                id: customer.id,
                provider: this.name,
                email: customer.email,
                name: customer.name || undefined,
                metadata: customer.metadata,
                raw: customer
            };
        });
    }
    deleteCustomer(customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.stripe.customers.del(customerId);
        });
    }
    // ==================== Checkout / Payments ====================
    createCheckout(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const requestOptions = {};
            if (options.idempotency_key) {
                requestOptions.idempotencyKey = options.idempotency_key;
            }
            const session = yield this.stripe.checkout.sessions.create({
                mode: 'payment',
                customer: options.customer_id,
                customer_email: options.customer_id ? undefined : options.customer_email,
                line_items: options.line_items.map(item => ({
                    price_data: {
                        currency: item.unit_amount.currency,
                        unit_amount: item.unit_amount.amount,
                        product_data: {
                            name: item.name,
                            description: item.description,
                            images: item.image_url ? [item.image_url] : undefined
                        }
                    },
                    quantity: item.quantity
                })),
                success_url: options.success_url,
                cancel_url: options.cancel_url,
                metadata: options.metadata,
                expires_at: options.expires_in ? Math.floor(Date.now() / 1000) + options.expires_in : undefined,
                allow_promotion_codes: options.allow_promotion_codes,
                locale: options.locale
            }, requestOptions);
            return {
                id: session.id,
                provider: this.name,
                url: session.url,
                expires_at: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
                metadata: session.metadata,
                raw: session
            };
        });
    }
    getPayment(paymentId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const paymentIntent = yield this.stripe.paymentIntents.retrieve(paymentId);
                return {
                    id: paymentIntent.id,
                    provider: this.name,
                    status: this.mapPaymentStatus(paymentIntent.status),
                    amount: {
                        amount: paymentIntent.amount,
                        currency: paymentIntent.currency
                    },
                    customer_id: typeof paymentIntent.customer === 'string' ? paymentIntent.customer : (_a = paymentIntent.customer) === null || _a === void 0 ? void 0 : _a.id,
                    metadata: paymentIntent.metadata,
                    paid_at: paymentIntent.status === 'succeeded' && paymentIntent.created ? new Date(paymentIntent.created * 1000) : undefined,
                    raw: paymentIntent
                };
            }
            catch (_b) {
                return null;
            }
        });
    }
    listPayments(customerId_1) {
        return __awaiter(this, arguments, void 0, function* (customerId, limit = 10) {
            const paymentIntents = yield this.stripe.paymentIntents.list({
                customer: customerId,
                limit
            });
            return paymentIntents.data.map(pi => {
                var _a;
                return ({
                    id: pi.id,
                    provider: this.name,
                    status: this.mapPaymentStatus(pi.status),
                    amount: {
                        amount: pi.amount,
                        currency: pi.currency
                    },
                    customer_id: typeof pi.customer === 'string' ? pi.customer : (_a = pi.customer) === null || _a === void 0 ? void 0 : _a.id,
                    metadata: pi.metadata,
                    paid_at: pi.status === 'succeeded' && pi.created ? new Date(pi.created * 1000) : undefined,
                    raw: pi
                });
            });
        });
    }
    // ==================== Subscriptions ====================
    createSubscription(options) {
        return __awaiter(this, void 0, void 0, function* () {
            // If success_url is provided, create a checkout session for subscription
            if (options.success_url) {
                const session = yield this.stripe.checkout.sessions.create({
                    mode: 'subscription',
                    customer: options.customer_id,
                    line_items: [
                        {
                            price: options.price_id,
                            quantity: 1
                        }
                    ],
                    success_url: options.success_url,
                    cancel_url: options.cancel_url,
                    metadata: options.metadata,
                    subscription_data: options.trial_days
                        ? {
                            trial_period_days: options.trial_days,
                            metadata: options.metadata
                        }
                        : {
                            metadata: options.metadata
                        }
                });
                return {
                    id: session.id,
                    provider: this.name,
                    status: 'pending',
                    customer_id: options.customer_id,
                    price_id: options.price_id,
                    current_period_start: new Date(),
                    current_period_end: new Date(),
                    cancel_at_period_end: false,
                    metadata: options.metadata,
                    checkout_url: session.url,
                    raw: session
                };
            }
            // Direct subscription creation (requires payment method already attached)
            const subscription = yield this.stripe.subscriptions.create({
                customer: options.customer_id,
                items: [{ price: options.price_id }],
                trial_period_days: options.trial_days,
                metadata: options.metadata,
                cancel_at_period_end: options.cancel_at_period_end
            });
            return this.mapSubscription(subscription);
        });
    }
    mapSubscription(subscription) {
        var _a;
        return {
            id: subscription.id,
            provider: this.name,
            status: this.mapSubscriptionStatus(subscription.status),
            customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
            price_id: ((_a = subscription.items.data[0]) === null || _a === void 0 ? void 0 : _a.price.id) || '',
            current_period_start: new Date(subscription.current_period_start * 1000),
            current_period_end: new Date(subscription.current_period_end * 1000),
            cancel_at_period_end: subscription.cancel_at_period_end,
            cancelled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : undefined,
            trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000) : undefined,
            trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
            metadata: subscription.metadata,
            raw: subscription
        };
    }
    getSubscription(subscriptionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const subscription = yield this.stripe.subscriptions.retrieve(subscriptionId);
                return this.mapSubscription(subscription);
            }
            catch (_a) {
                return null;
            }
        });
    }
    updateSubscription(subscriptionId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const updateData = {
                metadata: options.metadata,
                cancel_at_period_end: options.cancel_at_period_end,
                proration_behavior: options.proration_behavior
            };
            if (options.price_id) {
                const subscription = yield this.stripe.subscriptions.retrieve(subscriptionId);
                updateData.items = [
                    {
                        id: subscription.items.data[0].id,
                        price: options.price_id
                    }
                ];
            }
            const subscription = yield this.stripe.subscriptions.update(subscriptionId, updateData);
            return this.mapSubscription(subscription);
        });
    }
    cancelSubscription(subscriptionId_1) {
        return __awaiter(this, arguments, void 0, function* (subscriptionId, immediate = false) {
            if (immediate) {
                const subscription = yield this.stripe.subscriptions.cancel(subscriptionId);
                return this.mapSubscription(subscription);
            }
            const subscription = yield this.stripe.subscriptions.update(subscriptionId, {
                cancel_at_period_end: true
            });
            return this.mapSubscription(subscription);
        });
    }
    resumeSubscription(subscriptionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const subscription = yield this.stripe.subscriptions.update(subscriptionId, {
                cancel_at_period_end: false
            });
            return this.mapSubscription(subscription);
        });
    }
    listSubscriptions(customerId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const stripeStatus = status === 'cancelled' ? 'canceled' : status;
            const subscriptions = yield this.stripe.subscriptions.list({
                customer: customerId,
                status: stripeStatus
            });
            return subscriptions.data.map(sub => this.mapSubscription(sub));
        });
    }
    // ==================== Refunds ====================
    refund(options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const refund = yield this.stripe.refunds.create({
                payment_intent: options.payment_id,
                amount: (_a = options.amount) === null || _a === void 0 ? void 0 : _a.amount,
                reason: options.reason,
                metadata: options.metadata
            });
            return {
                id: refund.id,
                provider: this.name,
                payment_id: options.payment_id,
                status: refund.status === 'succeeded' ? 'succeeded' : 'pending',
                amount: {
                    amount: refund.amount,
                    currency: refund.currency
                },
                reason: refund.reason || undefined,
                raw: refund
            };
        });
    }
    getRefund(refundId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const refund = yield this.stripe.refunds.retrieve(refundId);
                return {
                    id: refund.id,
                    provider: this.name,
                    payment_id: typeof refund.payment_intent === 'string' ? refund.payment_intent : ((_a = refund.payment_intent) === null || _a === void 0 ? void 0 : _a.id) || '',
                    status: refund.status === 'succeeded' ? 'succeeded' : 'pending',
                    amount: {
                        amount: refund.amount,
                        currency: refund.currency
                    },
                    reason: refund.reason || undefined,
                    raw: refund
                };
            }
            catch (_b) {
                return null;
            }
        });
    }
    // ==================== Payment Methods ====================
    setupPaymentMethod(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const session = yield this.stripe.checkout.sessions.create({
                mode: 'setup',
                customer: options.customer_id,
                success_url: options.success_url,
                cancel_url: options.cancel_url
            });
            return {
                id: session.id,
                provider: this.name,
                url: session.url,
                raw: session
            };
        });
    }
    listPaymentMethods(customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const paymentMethods = yield this.stripe.paymentMethods.list({
                customer: customerId,
                type: 'card'
            });
            const customer = (yield this.stripe.customers.retrieve(customerId));
            const defaultPm = (_a = customer.invoice_settings) === null || _a === void 0 ? void 0 : _a.default_payment_method;
            return paymentMethods.data.map(pm => ({
                id: pm.id,
                provider: this.name,
                type: pm.type,
                card: pm.card
                    ? {
                        brand: pm.card.brand,
                        last4: pm.card.last4,
                        exp_month: pm.card.exp_month,
                        exp_year: pm.card.exp_year
                    }
                    : undefined,
                is_default: pm.id === defaultPm || pm.id === (defaultPm === null || defaultPm === void 0 ? void 0 : defaultPm.id),
                raw: pm
            }));
        });
    }
    setDefaultPaymentMethod(customerId, paymentMethodId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.stripe.customers.update(customerId, {
                invoice_settings: {
                    default_payment_method: paymentMethodId
                }
            });
        });
    }
    deletePaymentMethod(paymentMethodId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.stripe.paymentMethods.detach(paymentMethodId);
        });
    }
    // ==================== Webhooks ====================
    handleWebhook(req, webhookSecret) {
        return __awaiter(this, void 0, void 0, function* () {
            const sig = req.headers['stripe-signature'];
            try {
                const event = this.stripe.webhooks.constructEvent(req.rawBody || JSON.stringify(req.body), sig, webhookSecret);
                return this.mapWebhookEvent(event);
            }
            catch (err) {
                console.error('Stripe webhook verification failed:', err);
                return null;
            }
        });
    }
    mapWebhookEvent(event) {
        var _a, _b;
        const typeMapping = {
            'checkout.session.completed': 'checkout.completed',
            'checkout.session.expired': 'checkout.expired',
            'payment_intent.succeeded': 'payment.succeeded',
            'payment_intent.payment_failed': 'payment.failed',
            'charge.succeeded': 'payment.succeeded',
            'charge.refunded': 'refund.created',
            'customer.subscription.created': 'subscription.created',
            'customer.subscription.updated': 'subscription.updated',
            'customer.subscription.deleted': 'subscription.cancelled',
            'customer.subscription.trial_will_end': 'subscription.trial_ending',
            'invoice.paid': 'invoice.paid',
            'invoice.payment_failed': 'invoice.payment_failed',
            'customer.created': 'customer.created',
            'customer.updated': 'customer.updated',
            'payment_method.attached': 'payment_method.attached',
            'payment_method.detached': 'payment_method.detached'
        };
        const webhookEvent = {
            id: event.id,
            provider: this.name,
            type: typeMapping[event.type] || event.type,
            data: {},
            created_at: new Date(event.created * 1000),
            raw: event
        };
        // Map event data
        const obj = event.data.object;
        if (event.type.startsWith('customer.subscription')) {
            webhookEvent.data.subscription = this.mapSubscription(obj);
        }
        else if (event.type.startsWith('payment_intent')) {
            webhookEvent.data.payment = {
                id: obj.id,
                provider: this.name,
                status: this.mapPaymentStatus(obj.status),
                amount: { amount: obj.amount, currency: obj.currency },
                customer_id: typeof obj.customer === 'string' ? obj.customer : (_a = obj.customer) === null || _a === void 0 ? void 0 : _a.id,
                metadata: obj.metadata,
                raw: obj
            };
        }
        else if (event.type === 'charge.succeeded') {
            webhookEvent.data.payment = {
                id: obj.payment_intent || obj.id,
                provider: this.name,
                status: 'succeeded',
                amount: { amount: obj.amount, currency: obj.currency },
                customer_id: typeof obj.customer === 'string' ? obj.customer : (_b = obj.customer) === null || _b === void 0 ? void 0 : _b.id,
                metadata: obj.metadata,
                raw: obj
            };
        }
        else if (event.type === 'checkout.session.completed') {
            webhookEvent.data.payment = {
                id: obj.payment_intent || obj.id,
                provider: this.name,
                status: 'succeeded',
                amount: { amount: obj.amount_total, currency: obj.currency },
                customer_id: obj.customer,
                customer_email: obj.customer_email,
                metadata: obj.metadata,
                raw: obj
            };
        }
        return webhookEvent;
    }
    // ==================== Mobile Payments ====================
    /**
     * Create a PaymentIntent for mobile SDK
     * Returns client_secret and ephemeral_key for the Stripe mobile SDK
     */
    initMobilePayment(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const requestOptions = {};
            if (options.idempotency_key) {
                requestOptions.idempotencyKey = options.idempotency_key;
            }
            // Create PaymentIntent
            const paymentIntent = yield this.stripe.paymentIntents.create({
                amount: options.amount,
                currency: options.currency,
                customer: options.customer_id,
                automatic_payment_methods: { enabled: true },
                setup_future_usage: 'off_session',
                metadata: options.metadata
            }, requestOptions);
            // Create ephemeral key for the customer (required for mobile SDK)
            const ephemeralKey = yield this.stripe.ephemeralKeys.create({ customer: options.customer_id }, { apiVersion: this.config.api_version || StripeProvider.DEFAULT_API_VERSION });
            return {
                provider: this.name,
                payment_id: paymentIntent.id,
                customer_id: options.customer_id,
                client_secret: paymentIntent.client_secret,
                ephemeral_key: ephemeralKey.secret,
                publishable_key: this.config.publishable_key,
                raw: { paymentIntent, ephemeralKey }
            };
        });
    }
    /**
     * Create a Subscription for mobile SDK
     * Uses payment_behavior: 'default_incomplete' to get a PaymentIntent
     */
    initMobileSubscription(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const requestOptions = {};
            if (options.idempotency_key) {
                requestOptions.idempotencyKey = options.idempotency_key;
            }
            // Create subscription with incomplete status to get PaymentIntent
            const subscription = yield this.stripe.subscriptions.create({
                customer: options.customer_id,
                items: [{ price: options.price_id }],
                payment_behavior: 'default_incomplete',
                payment_settings: { save_default_payment_method: 'on_subscription' },
                trial_period_days: options.trial_days,
                metadata: options.metadata,
                expand: ['latest_invoice.payment_intent']
            }, requestOptions);
            const invoice = subscription.latest_invoice;
            const paymentIntent = invoice.payment_intent;
            // Create ephemeral key
            const ephemeralKey = yield this.stripe.ephemeralKeys.create({ customer: options.customer_id }, { apiVersion: this.config.api_version || StripeProvider.DEFAULT_API_VERSION });
            return {
                provider: this.name,
                payment_id: paymentIntent.id,
                customer_id: options.customer_id,
                client_secret: paymentIntent.client_secret,
                ephemeral_key: ephemeralKey.secret,
                publishable_key: this.config.publishable_key,
                raw: { subscription, paymentIntent, ephemeralKey }
            };
        });
    }
    /**
     * Confirm/check status of a mobile payment
     * For Stripe, webhooks handle confirmation, but this can be used to check status
     */
    confirmMobilePayment(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const paymentIntent = yield this.stripe.paymentIntents.retrieve(options.payment_id, {
                expand: ['latest_charge']
            });
            return {
                success: paymentIntent.status === 'succeeded',
                status: paymentIntent.status,
                raw: paymentIntent
            };
        });
    }
    // ==================== Mobile Card Setup ====================
    /**
     * Create a SetupIntent for mobile SDK (save card without charging)
     * Returns client_secret and ephemeral_key for the Stripe mobile SDK
     */
    initMobileSetup(customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const setupIntent = yield this.stripe.setupIntents.create({
                customer: customerId,
                automatic_payment_methods: { enabled: true }
            });
            const ephemeralKey = yield this.stripe.ephemeralKeys.create({ customer: customerId }, { apiVersion: this.config.api_version || StripeProvider.DEFAULT_API_VERSION });
            return {
                provider: this.name,
                customer_id: customerId,
                client_secret: setupIntent.client_secret,
                ephemeral_key: ephemeralKey.secret,
                publishable_key: this.config.publishable_key,
                raw: { setupIntent, ephemeralKey }
            };
        });
    }
}
StripeProvider.DEFAULT_API_VERSION = '2024-12-18.acacia';
// Register the provider
registerProvider('stripe', StripeProvider);
