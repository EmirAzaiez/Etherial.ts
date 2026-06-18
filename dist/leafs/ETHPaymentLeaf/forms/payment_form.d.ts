import { InferType } from 'yup';
/**
 * Create checkout form
 */
export declare const CheckoutForm: import("yup").ObjectSchema<{
    provider: string;
    line_items: {
        description?: string;
        name?: string;
        currency?: string;
        amount?: number;
        quantity?: number;
        image_url?: string;
    }[];
    success_url: string;
    cancel_url: string;
    metadata: {};
}, import("yup").AnyObject, {
    provider: undefined;
    line_items: "";
    success_url: undefined;
    cancel_url: undefined;
    metadata: {};
}, "">;
export type CheckoutFormType = InferType<typeof CheckoutForm>;
/**
 * Create subscription form
 */
export declare const SubscriptionForm: import("yup").ObjectSchema<{
    provider: string;
    price_id: string;
    plan_name: string;
    trial_days: number;
    success_url: string;
    cancel_url: string;
    metadata: {};
}, import("yup").AnyObject, {
    provider: undefined;
    price_id: undefined;
    plan_name: undefined;
    trial_days: undefined;
    success_url: undefined;
    cancel_url: undefined;
    metadata: {};
}, "">;
export type SubscriptionFormType = InferType<typeof SubscriptionForm>;
/**
 * Refund form
 */
export declare const RefundForm: import("yup").ObjectSchema<{
    amount: number;
    reason: string;
}, import("yup").AnyObject, {
    amount: undefined;
    reason: undefined;
}, "">;
export type RefundFormType = InferType<typeof RefundForm>;
/**
 * Setup payment method form
 */
export declare const SetupPaymentMethodForm: import("yup").ObjectSchema<{
    provider: string;
    success_url: string;
    cancel_url: string;
}, import("yup").AnyObject, {
    provider: undefined;
    success_url: undefined;
    cancel_url: undefined;
}, "">;
export type SetupPaymentMethodFormType = InferType<typeof SetupPaymentMethodForm>;
/**
 * Initialize mobile payment form
 */
export declare const MobilePaymentInitForm: import("yup").ObjectSchema<{
    provider: string;
    amount: number;
    currency: string;
    idempotency_key: string;
    metadata: {};
}, import("yup").AnyObject, {
    provider: undefined;
    amount: undefined;
    currency: "eur";
    idempotency_key: undefined;
    metadata: {};
}, "">;
export type MobilePaymentInitFormType = InferType<typeof MobilePaymentInitForm>;
/**
 * Initialize mobile subscription form
 */
export declare const MobileSubscriptionInitForm: import("yup").ObjectSchema<{
    provider: string;
    price_id: string;
    trial_days: number;
    idempotency_key: string;
    metadata: {};
}, import("yup").AnyObject, {
    provider: undefined;
    price_id: undefined;
    trial_days: undefined;
    idempotency_key: undefined;
    metadata: {};
}, "">;
export type MobileSubscriptionInitFormType = InferType<typeof MobileSubscriptionInitForm>;
/**
 * Confirm mobile payment form
 */
export declare const MobilePaymentConfirmForm: import("yup").ObjectSchema<{
    provider: string;
    payment_id: string;
}, import("yup").AnyObject, {
    provider: undefined;
    payment_id: undefined;
}, "">;
export type MobilePaymentConfirmFormType = InferType<typeof MobilePaymentConfirmForm>;
/**
 * Initialize mobile card setup form (SetupIntent)
 */
export declare const MobileSetupForm: import("yup").ObjectSchema<{
    provider: string;
}, import("yup").AnyObject, {
    provider: undefined;
}, "">;
export type MobileSetupFormType = InferType<typeof MobileSetupForm>;
/**
 * Set default payment method form
 */
export declare const SetDefaultPaymentMethodForm: import("yup").ObjectSchema<{
    provider: string;
}, import("yup").AnyObject, {
    provider: undefined;
}, "">;
export type SetDefaultPaymentMethodFormType = InferType<typeof SetDefaultPaymentMethodForm>;
