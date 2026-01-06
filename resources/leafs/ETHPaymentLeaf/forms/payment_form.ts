import { EtherialYup } from 'etherial/components/http/yup.validator'
import { InferType } from 'yup'

/**
 * Line item for checkout
 */
const LineItemSchema = EtherialYup.object({
    name: EtherialYup.string().required(),
    description: EtherialYup.string().optional(),
    quantity: EtherialYup.number().required().min(1),
    amount: EtherialYup.number().required().min(1, 'Amount must be at least 1 cent'),
    currency: EtherialYup.string().optional().default('usd'),
    image_url: EtherialYup.string().url().optional(),
})

/**
 * Create checkout form
 */
export const CheckoutForm = EtherialYup.object({
    provider: EtherialYup.string().optional(),
    line_items: EtherialYup.array().of(LineItemSchema).min(1).required(),
    success_url: EtherialYup.string().url().required(),
    cancel_url: EtherialYup.string().url().required(),
    metadata: EtherialYup.object().optional(),
}).required()

export type CheckoutFormType = InferType<typeof CheckoutForm>

/**
 * Create subscription form
 */
export const SubscriptionForm = EtherialYup.object({
    provider: EtherialYup.string().optional(),
    price_id: EtherialYup.string().required(),
    plan_name: EtherialYup.string().optional(),
    trial_days: EtherialYup.number().optional().min(0).max(365),
    success_url: EtherialYup.string().url().optional(),
    cancel_url: EtherialYup.string().url().optional(),
    metadata: EtherialYup.object().optional(),
}).required()

export type SubscriptionFormType = InferType<typeof SubscriptionForm>

/**
 * Refund form
 */
export const RefundForm = EtherialYup.object({
    amount: EtherialYup.number().optional().min(1, 'Amount must be at least 1 cent'),
    reason: EtherialYup.string().optional().oneOf(['duplicate', 'fraudulent', 'requested_by_customer']),
}).required()

export type RefundFormType = InferType<typeof RefundForm>

/**
 * Setup payment method form
 */
export const SetupPaymentMethodForm = EtherialYup.object({
    provider: EtherialYup.string().optional(),
    success_url: EtherialYup.string().url().required(),
    cancel_url: EtherialYup.string().url().required(),
}).required()

export type SetupPaymentMethodFormType = InferType<typeof SetupPaymentMethodForm>

// ==================== Mobile Forms ====================

/**
 * Initialize mobile payment form
 */
export const MobilePaymentInitForm = EtherialYup.object({
    provider: EtherialYup.string().oneOf(['stripe', 'paypal']).required(),
    amount: EtherialYup.number().required().min(1, 'Amount must be at least 1 cent'),
    currency: EtherialYup.string().default('eur'),
    metadata: EtherialYup.object().optional(),
}).required()

export type MobilePaymentInitFormType = InferType<typeof MobilePaymentInitForm>

/**
 * Initialize mobile subscription form
 */
export const MobileSubscriptionInitForm = EtherialYup.object({
    provider: EtherialYup.string().oneOf(['stripe', 'paypal']).required(),
    price_id: EtherialYup.string().required(),
    trial_days: EtherialYup.number().optional().min(0).max(365),
    metadata: EtherialYup.object().optional(),
}).required()

export type MobileSubscriptionInitFormType = InferType<typeof MobileSubscriptionInitForm>

/**
 * Confirm mobile payment form
 */
export const MobilePaymentConfirmForm = EtherialYup.object({
    provider: EtherialYup.string().oneOf(['stripe', 'paypal']).required(),
    payment_id: EtherialYup.string().required(),
}).required()

export type MobilePaymentConfirmFormType = InferType<typeof MobilePaymentConfirmForm>

