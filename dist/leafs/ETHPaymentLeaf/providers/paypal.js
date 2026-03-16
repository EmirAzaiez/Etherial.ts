var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { registerProvider, ZERO_DECIMAL_CURRENCIES, THREE_DECIMAL_CURRENCIES, } from './base.js';
export class PayPalProvider {
    constructor() {
        this.name = 'paypal';
        this.accessToken = '';
        this.tokenExpiresAt = 0;
    }
    initialize(config) {
        return __awaiter(this, void 0, void 0, function* () {
            this.config = config;
        });
    }
    supports(feature) {
        return !PayPalProvider.UNSUPPORTED_FEATURES.includes(feature);
    }
    // ==================== API Helpers ====================
    get baseUrl() {
        return this.config.mode === 'live'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';
    }
    getAccessToken() {
        return __awaiter(this, void 0, void 0, function* () {
            // Return cached token if still valid
            if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
                return this.accessToken;
            }
            const auth = Buffer.from(`${this.config.client_id}:${this.config.client_secret}`).toString('base64');
            const response = yield fetch(`${this.baseUrl}/v1/oauth2/token`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 'grant_type=client_credentials',
            });
            if (!response.ok) {
                throw new Error(`PayPal auth failed: ${response.statusText}`);
            }
            const data = yield response.json();
            this.accessToken = data.access_token;
            this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
            return this.accessToken;
        });
    }
    request(method, path, body, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield this.getAccessToken();
            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation',
            };
            if (options === null || options === void 0 ? void 0 : options.idempotency_key) {
                headers['PayPal-Request-Id'] = options.idempotency_key;
            }
            const response = yield fetch(`${this.baseUrl}${path}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
            });
            if (!response.ok) {
                const error = yield response.json().catch(() => ({}));
                throw new Error(`PayPal API error: ${JSON.stringify(error)}`);
            }
            if (response.status === 204) {
                return {};
            }
            return response.json();
        });
    }
    mapPaymentStatus(status) {
        const mapping = {
            'CREATED': 'pending',
            'SAVED': 'pending',
            'APPROVED': 'processing',
            'VOIDED': 'cancelled',
            'COMPLETED': 'succeeded',
            'PAYER_ACTION_REQUIRED': 'pending',
        };
        return mapping[status] || 'pending';
    }
    mapSubscriptionStatus(status) {
        const mapping = {
            'APPROVAL_PENDING': 'pending',
            'APPROVED': 'active',
            'ACTIVE': 'active',
            'SUSPENDED': 'paused',
            'CANCELLED': 'cancelled',
            'EXPIRED': 'expired',
        };
        return mapping[status] || 'active';
    }
    formatMoney(money) {
        // PayPal uses full currency amounts, not cents
        const curr = money.currency.toLowerCase();
        let value;
        if (ZERO_DECIMAL_CURRENCIES.includes(curr)) {
            value = money.amount.toString();
        }
        else if (THREE_DECIMAL_CURRENCIES.includes(curr)) {
            value = (money.amount / 1000).toFixed(3);
        }
        else {
            value = (money.amount / 100).toFixed(2);
        }
        return {
            currency_code: money.currency.toUpperCase(),
            value,
        };
    }
    parseMoney(amount) {
        const currency = amount.currency_code.toLowerCase();
        let value;
        if (ZERO_DECIMAL_CURRENCIES.includes(currency)) {
            value = parseInt(amount.value, 10);
        }
        else if (THREE_DECIMAL_CURRENCIES.includes(currency)) {
            value = Math.round(parseFloat(amount.value) * 1000);
        }
        else {
            value = Math.round(parseFloat(amount.value) * 100);
        }
        return { amount: value, currency };
    }
    // ==================== Customers ====================
    // PayPal doesn't have a traditional customer API, we store metadata locally
    createCustomer(options) {
        return __awaiter(this, void 0, void 0, function* () {
            // PayPal doesn't have customer creation - return a pseudo-customer
            // In practice, you'd store this in your database
            const id = `paypal_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            return {
                id,
                provider: this.name,
                email: options.email,
                name: options.name,
                metadata: options.metadata,
            };
        });
    }
    getCustomer(customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            // PayPal doesn't have customer retrieval
            // Return null - implement with your database
            return null;
        });
    }
    updateCustomer(customerId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            // PayPal doesn't have customer update
            return {
                id: customerId,
                provider: this.name,
                email: options.email || '',
                name: options.name,
                metadata: options.metadata,
            };
        });
    }
    deleteCustomer(customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            // PayPal doesn't have customer deletion
            // Implement with your database
        });
    }
    // ==================== Checkout / Payments ====================
    createCheckout(options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const items = options.line_items.map(item => ({
                name: item.name,
                description: item.description,
                quantity: item.quantity.toString(),
                unit_amount: this.formatMoney(item.unit_amount),
            }));
            const totalAmount = options.line_items.reduce((sum, item) => {
                return sum + (item.unit_amount.amount * item.quantity);
            }, 0);
            const order = yield this.request('POST', '/v2/checkout/orders', {
                intent: 'CAPTURE',
                purchase_units: [{
                        amount: {
                            currency_code: ((_a = options.line_items[0]) === null || _a === void 0 ? void 0 : _a.unit_amount.currency.toUpperCase()) || 'USD',
                            value: (totalAmount / 100).toFixed(2),
                            breakdown: {
                                item_total: {
                                    currency_code: ((_b = options.line_items[0]) === null || _b === void 0 ? void 0 : _b.unit_amount.currency.toUpperCase()) || 'USD',
                                    value: (totalAmount / 100).toFixed(2),
                                },
                            },
                        },
                        items,
                        custom_id: options.metadata ? JSON.stringify(options.metadata) : undefined,
                    }],
                application_context: {
                    return_url: options.success_url,
                    cancel_url: options.cancel_url,
                    user_action: 'PAY_NOW',
                    locale: options.locale,
                },
            });
            const approveLink = (_d = (_c = order.links) === null || _c === void 0 ? void 0 : _c.find((l) => l.rel === 'approve')) === null || _d === void 0 ? void 0 : _d.href;
            return {
                id: order.id,
                provider: this.name,
                url: approveLink || '',
                metadata: options.metadata,
                raw: order,
            };
        });
    }
    getPayment(paymentId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            try {
                const order = yield this.request('GET', `/v2/checkout/orders/${paymentId}`);
                const capture = (_d = (_c = (_b = (_a = order.purchase_units) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.payments) === null || _c === void 0 ? void 0 : _c.captures) === null || _d === void 0 ? void 0 : _d[0];
                const amount = (capture === null || capture === void 0 ? void 0 : capture.amount) || ((_f = (_e = order.purchase_units) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.amount);
                return {
                    id: order.id,
                    provider: this.name,
                    status: this.mapPaymentStatus(order.status),
                    amount: this.parseMoney(amount),
                    customer_email: (_g = order.payer) === null || _g === void 0 ? void 0 : _g.email_address,
                    metadata: ((_j = (_h = order.purchase_units) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.custom_id)
                        ? JSON.parse(order.purchase_units[0].custom_id)
                        : undefined,
                    paid_at: (capture === null || capture === void 0 ? void 0 : capture.create_time) ? new Date(capture.create_time) : undefined,
                    raw: order,
                };
            }
            catch (_k) {
                return null;
            }
        });
    }
    listPayments(customerId_1) {
        return __awaiter(this, arguments, void 0, function* (customerId, limit = 10) {
            // PayPal doesn't support listing orders by customer
            // You'd need to implement this with your database
            return [];
        });
    }
    // ==================== Subscriptions ====================
    createSubscription(options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const subscription = yield this.request('POST', '/v1/billing/subscriptions', {
                plan_id: options.price_id,
                custom_id: options.metadata ? JSON.stringify(options.metadata) : undefined,
                application_context: {
                    return_url: options.success_url,
                    cancel_url: options.cancel_url,
                    user_action: 'SUBSCRIBE_NOW',
                },
            });
            const approveLink = (_b = (_a = subscription.links) === null || _a === void 0 ? void 0 : _a.find((l) => l.rel === 'approve')) === null || _b === void 0 ? void 0 : _b.href;
            return {
                id: subscription.id,
                provider: this.name,
                status: this.mapSubscriptionStatus(subscription.status),
                customer_id: options.customer_id,
                price_id: options.price_id,
                current_period_start: subscription.start_time ? new Date(subscription.start_time) : new Date(),
                current_period_end: ((_c = subscription.billing_info) === null || _c === void 0 ? void 0 : _c.next_billing_time)
                    ? new Date(subscription.billing_info.next_billing_time)
                    : new Date(),
                cancel_at_period_end: false,
                metadata: options.metadata,
                checkout_url: approveLink,
                raw: subscription,
            };
        });
    }
    getSubscription(subscriptionId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const subscription = yield this.request('GET', `/v1/billing/subscriptions/${subscriptionId}`);
                return {
                    id: subscription.id,
                    provider: this.name,
                    status: this.mapSubscriptionStatus(subscription.status),
                    customer_id: ((_a = subscription.subscriber) === null || _a === void 0 ? void 0 : _a.payer_id) || '',
                    price_id: subscription.plan_id,
                    current_period_start: subscription.start_time ? new Date(subscription.start_time) : new Date(),
                    current_period_end: ((_b = subscription.billing_info) === null || _b === void 0 ? void 0 : _b.next_billing_time)
                        ? new Date(subscription.billing_info.next_billing_time)
                        : new Date(),
                    cancel_at_period_end: false,
                    metadata: subscription.custom_id ? JSON.parse(subscription.custom_id) : undefined,
                    raw: subscription,
                };
            }
            catch (_c) {
                return null;
            }
        });
    }
    updateSubscription(subscriptionId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (options.price_id) {
                // Revise the subscription to change plan
                yield this.request('POST', `/v1/billing/subscriptions/${subscriptionId}/revise`, {
                    plan_id: options.price_id,
                });
            }
            const subscription = yield this.getSubscription(subscriptionId);
            return subscription;
        });
    }
    cancelSubscription(subscriptionId_1) {
        return __awaiter(this, arguments, void 0, function* (subscriptionId, immediate = false) {
            yield this.request('POST', `/v1/billing/subscriptions/${subscriptionId}/cancel`, {
                reason: 'User requested cancellation',
            });
            const subscription = yield this.getSubscription(subscriptionId);
            return subscription;
        });
    }
    resumeSubscription(subscriptionId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.request('POST', `/v1/billing/subscriptions/${subscriptionId}/activate`, {
                reason: 'User requested reactivation',
            });
            const subscription = yield this.getSubscription(subscriptionId);
            return subscription;
        });
    }
    listSubscriptions(customerId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            // PayPal doesn't support listing subscriptions by customer easily
            // You'd need to implement this with your database
            return [];
        });
    }
    // ==================== Refunds ====================
    refund(options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            // First, get the capture ID from the order
            const order = yield this.request('GET', `/v2/checkout/orders/${options.payment_id}`);
            const captureId = (_e = (_d = (_c = (_b = (_a = order.purchase_units) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.payments) === null || _c === void 0 ? void 0 : _c.captures) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.id;
            if (!captureId) {
                throw new Error('No capture found for this payment');
            }
            const refundBody = {};
            if (options.amount) {
                refundBody.amount = this.formatMoney(options.amount);
            }
            if (options.reason) {
                refundBody.note_to_payer = options.reason;
            }
            const refund = yield this.request('POST', `/v2/payments/captures/${captureId}/refund`, refundBody);
            return {
                id: refund.id,
                provider: this.name,
                payment_id: options.payment_id,
                status: refund.status === 'COMPLETED' ? 'succeeded' : 'pending',
                amount: this.parseMoney(refund.amount),
                reason: options.reason,
                raw: refund,
            };
        });
    }
    getRefund(refundId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const refund = yield this.request('GET', `/v2/payments/refunds/${refundId}`);
                return {
                    id: refund.id,
                    provider: this.name,
                    payment_id: '', // PayPal doesn't include this in refund details
                    status: refund.status === 'COMPLETED' ? 'succeeded' : 'pending',
                    amount: this.parseMoney(refund.amount),
                    raw: refund,
                };
            }
            catch (_a) {
                return null;
            }
        });
    }
    // ==================== Payment Methods ====================
    // PayPal handles payment methods differently - through vault
    setupPaymentMethod(options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            // PayPal uses vault tokens - this creates a setup token
            const token = yield this.request('POST', '/v3/vault/setup-tokens', {
                payment_source: {
                    paypal: {
                        usage_type: 'MERCHANT',
                        experience_context: {
                            return_url: options.success_url,
                            cancel_url: options.cancel_url,
                        },
                    },
                },
            });
            const approveLink = (_b = (_a = token.links) === null || _a === void 0 ? void 0 : _a.find((l) => l.rel === 'approve')) === null || _b === void 0 ? void 0 : _b.href;
            return {
                id: token.id,
                provider: this.name,
                url: approveLink || '',
                raw: token,
            };
        });
    }
    listPaymentMethods(customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            // PayPal vault tokens are customer-specific
            // Implementation depends on how you store customer vault tokens
            return [];
        });
    }
    setDefaultPaymentMethod(customerId, paymentMethodId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Implement with your database
        });
    }
    deletePaymentMethod(paymentMethodId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.request('DELETE', `/v3/vault/payment-tokens/${paymentMethodId}`);
        });
    }
    // ==================== Webhooks ====================
    handleWebhook(req, webhookId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Verify webhook signature
            const headers = {
                'PAYPAL-AUTH-ALGO': req.headers['paypal-auth-algo'],
                'PAYPAL-CERT-URL': req.headers['paypal-cert-url'],
                'PAYPAL-TRANSMISSION-ID': req.headers['paypal-transmission-id'],
                'PAYPAL-TRANSMISSION-SIG': req.headers['paypal-transmission-sig'],
                'PAYPAL-TRANSMISSION-TIME': req.headers['paypal-transmission-time'],
            };
            try {
                const verification = yield this.request('POST', '/v1/notifications/verify-webhook-signature', {
                    auth_algo: headers['PAYPAL-AUTH-ALGO'],
                    cert_url: headers['PAYPAL-CERT-URL'],
                    transmission_id: headers['PAYPAL-TRANSMISSION-ID'],
                    transmission_sig: headers['PAYPAL-TRANSMISSION-SIG'],
                    transmission_time: headers['PAYPAL-TRANSMISSION-TIME'],
                    webhook_id: webhookId,
                    webhook_event: req.body,
                });
                if (verification.verification_status !== 'SUCCESS') {
                    console.error('PayPal webhook verification failed');
                    return null;
                }
                return this.mapWebhookEvent(req.body);
            }
            catch (err) {
                console.error('PayPal webhook error:', err);
                return null;
            }
        });
    }
    mapWebhookEvent(event) {
        var _a, _b, _c, _d, _e;
        const typeMapping = {
            'CHECKOUT.ORDER.APPROVED': 'checkout.completed',
            'PAYMENT.CAPTURE.COMPLETED': 'payment.succeeded',
            'PAYMENT.CAPTURE.DENIED': 'payment.failed',
            'BILLING.SUBSCRIPTION.CREATED': 'subscription.created',
            'BILLING.SUBSCRIPTION.UPDATED': 'subscription.updated',
            'BILLING.SUBSCRIPTION.CANCELLED': 'subscription.cancelled',
            'BILLING.SUBSCRIPTION.SUSPENDED': 'subscription.past_due',
            'PAYMENT.CAPTURE.REFUNDED': 'refund.created',
        };
        const webhookEvent = {
            id: event.id,
            provider: this.name,
            type: typeMapping[event.event_type] || event.event_type,
            data: {},
            created_at: new Date(event.create_time),
            raw: event,
        };
        const resource = event.resource;
        if (event.event_type.startsWith('BILLING.SUBSCRIPTION')) {
            webhookEvent.data.subscription = {
                id: resource.id,
                provider: this.name,
                status: this.mapSubscriptionStatus(resource.status),
                customer_id: ((_a = resource.subscriber) === null || _a === void 0 ? void 0 : _a.payer_id) || '',
                price_id: resource.plan_id,
                current_period_start: resource.start_time ? new Date(resource.start_time) : new Date(),
                current_period_end: ((_b = resource.billing_info) === null || _b === void 0 ? void 0 : _b.next_billing_time)
                    ? new Date(resource.billing_info.next_billing_time)
                    : new Date(),
                cancel_at_period_end: false,
                raw: resource,
            };
        }
        else if (event.event_type.includes('PAYMENT.CAPTURE')) {
            webhookEvent.data.payment = {
                id: resource.id,
                provider: this.name,
                status: this.mapPaymentStatus(resource.status),
                amount: this.parseMoney(resource.amount),
                raw: resource,
            };
        }
        else if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
            const amount = (_d = (_c = resource.purchase_units) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.amount;
            webhookEvent.data.payment = {
                id: resource.id,
                provider: this.name,
                status: 'processing',
                amount: amount ? this.parseMoney(amount) : { amount: 0, currency: 'usd' },
                customer_email: (_e = resource.payer) === null || _e === void 0 ? void 0 : _e.email_address,
                raw: resource,
            };
        }
        return webhookEvent;
    }
    // ==================== Mobile Payments ====================
    /**
     * Convert amount from smallest unit to PayPal format
     */
    toPayPalAmount(amount, currency) {
        const curr = currency.toLowerCase();
        if (ZERO_DECIMAL_CURRENCIES.includes(curr)) {
            return amount.toString();
        }
        else if (THREE_DECIMAL_CURRENCIES.includes(curr)) {
            return (amount / 1000).toFixed(3);
        }
        return (amount / 100).toFixed(2);
    }
    /**
     * Create a PayPal Order for mobile SDK
     * Returns order_id for the PayPal mobile SDK
     */
    initMobilePayment(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const currency = options.currency.toUpperCase();
            const amountValue = this.toPayPalAmount(options.amount, options.currency);
            const order = yield this.request('POST', '/v2/checkout/orders', {
                intent: 'CAPTURE',
                purchase_units: [{
                        amount: {
                            currency_code: currency,
                            value: amountValue,
                        },
                        custom_id: options.metadata ? JSON.stringify(options.metadata) : undefined,
                    }],
                application_context: {
                    brand_name: 'App',
                    user_action: 'PAY_NOW',
                    shipping_preference: 'NO_SHIPPING',
                },
            }, { idempotency_key: options.idempotency_key });
            return {
                provider: this.name,
                payment_id: order.id,
                customer_id: options.customer_id,
                order_id: order.id,
                paypal_client_id: this.config.client_id,
                environment: this.config.mode === 'live' ? 'live' : 'sandbox',
                raw: order,
            };
        });
    }
    /**
     * Create a PayPal Subscription for mobile SDK
     */
    initMobileSubscription(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const subscription = yield this.request('POST', '/v1/billing/subscriptions', {
                plan_id: options.price_id,
                custom_id: options.metadata ? JSON.stringify(options.metadata) : undefined,
                application_context: {
                    brand_name: 'App',
                    user_action: 'SUBSCRIBE_NOW',
                    shipping_preference: 'NO_SHIPPING',
                },
            }, { idempotency_key: options.idempotency_key });
            return {
                provider: this.name,
                payment_id: subscription.id,
                customer_id: options.customer_id,
                order_id: subscription.id,
                paypal_client_id: this.config.client_id,
                environment: this.config.mode === 'live' ? 'live' : 'sandbox',
                raw: subscription,
            };
        });
    }
    /**
     * Capture a PayPal Order after mobile SDK approval
     * This is REQUIRED for PayPal - the payment is not completed until captured
     */
    confirmMobilePayment(options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            try {
                // Capture the order
                const capture = yield this.request('POST', `/v2/checkout/orders/${options.payment_id}/capture`);
                const captureResult = (_d = (_c = (_b = (_a = capture.purchase_units) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.payments) === null || _c === void 0 ? void 0 : _c.captures) === null || _d === void 0 ? void 0 : _d[0];
                return {
                    success: capture.status === 'COMPLETED',
                    status: capture.status,
                    capture_id: captureResult === null || captureResult === void 0 ? void 0 : captureResult.id,
                    raw: capture,
                };
            }
            catch (error) {
                // Check if already captured
                const order = yield this.request('GET', `/v2/checkout/orders/${options.payment_id}`);
                if (order.status === 'COMPLETED') {
                    const captureResult = (_h = (_g = (_f = (_e = order.purchase_units) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.payments) === null || _g === void 0 ? void 0 : _g.captures) === null || _h === void 0 ? void 0 : _h[0];
                    return {
                        success: true,
                        status: 'COMPLETED',
                        capture_id: captureResult === null || captureResult === void 0 ? void 0 : captureResult.id,
                        raw: order,
                    };
                }
                return {
                    success: false,
                    status: order.status || 'FAILED',
                    raw: { error, order },
                };
            }
        });
    }
}
PayPalProvider.UNSUPPORTED_FEATURES = [
    'listPayments', 'listSubscriptions', 'listPaymentMethods',
    'getCustomer', 'setDefaultPaymentMethod',
];
// Register the provider
registerProvider('paypal', PayPalProvider);
