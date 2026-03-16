import { Column, Model, AllowNull, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, Default, Index } from 'etherial/components/database/provider'

import { PaymentStatus, formatMoney, ZERO_DECIMAL_CURRENCIES, THREE_DECIMAL_CURRENCIES } from '../providers/base.js'

/**
 * Base Payment model — extend this in your project and add @Table + User FK.
 *
 * @example
 * ```typescript
 * import { BasePayment } from '../ETHPaymentLeaf/models/Payment.js'
 *
 * @Table({ timestamps: true, tableName: 'payments', freezeTableName: true })
 * export class Payment extends BasePayment {
 *     @ForeignKey(() => User)
 *     @AllowNull(true)
 *     @Index
 *     @Column
 *     declare user_id: number
 *
 *     @BelongsTo(() => User, 'user_id')
 *     user: User
 * }
 * ```
 */
export class BasePayment extends Model<any> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column
    id: number

    /**
     * Payment provider (stripe, paypal, etc.)
     */
    @AllowNull(false)
    @Index
    @Column
    provider: string

    /**
     * Provider's payment/order ID
     */
    @AllowNull(false)
    @Index
    @Column
    provider_payment_id: string

    /**
     * Provider's checkout session ID (if applicable)
     */
    @AllowNull(true)
    @Index
    @Column
    provider_checkout_id: string

    /**
     * Provider's customer ID
     */
    @AllowNull(true)
    @Index
    @Column
    provider_customer_id: string

    /**
     * Payment status
     */
    @AllowNull(false)
    @Default('pending')
    @Column(DataType.ENUM('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded', 'partially_refunded'))
    status: PaymentStatus

    /**
     * Amount in smallest currency unit (cents)
     */
    @AllowNull(false)
    @Column(DataType.BIGINT)
    amount: number

    /**
     * Currency code (lowercase)
     */
    @AllowNull(false)
    @Default('usd')
    @Column
    currency: string

    /**
     * Amount refunded (if any)
     */
    @AllowNull(false)
    @Default(0)
    @Column(DataType.BIGINT)
    amount_refunded: number

    /**
     * Customer email
     */
    @AllowNull(true)
    @Column
    customer_email: string

    /**
     * Description of the payment
     */
    @AllowNull(true)
    @Column(DataType.TEXT)
    description: string

    /**
     * Custom metadata (JSON)
     */
    @AllowNull(true)
    @Column(DataType.JSON)
    metadata: Record<string, any>

    /**
     * Raw response from provider (for debugging)
     */
    @AllowNull(true)
    @Column(DataType.JSON)
    provider_data: Record<string, any>

    /**
     * When the payment was completed
     */
    @AllowNull(true)
    @Column
    paid_at: Date

    /**
     * User ID — declare in your subclass with @ForeignKey(() => User)
     */
    @AllowNull(true)
    @Index
    @Column
    user_id: number

    /**
     * URL of the generated invoice PDF (S3)
     */
    @AllowNull(true)
    @Column
    invoice_url: string

    /**
     * URL of the generated credit note PDF (S3)
     */
    @AllowNull(true)
    @Column
    credit_note_url: string

    @CreatedAt
    created_at: Date

    @UpdatedAt
    updated_at: Date

    // ==================== Helper Methods ====================

    /**
     * Get amount in decimal format (e.g., 10.00 instead of 1000)
     */
    getFormattedAmount(): string {
        if (ZERO_DECIMAL_CURRENCIES.includes(this.currency)) {
            return this.amount.toLocaleString()
        } else if (THREE_DECIMAL_CURRENCIES.includes(this.currency)) {
            return (this.amount / 1000).toFixed(3)
        }
        return (this.amount / 100).toFixed(2)
    }

    /**
     * Get amount with currency symbol
     */
    getDisplayAmount(): string {
        return formatMoney({ amount: this.amount, currency: this.currency })
    }

    /**
     * Check if payment can be refunded
     */
    canRefund(): boolean {
        return this.status === 'succeeded' && this.amount_refunded < this.amount
    }

    /**
     * Get remaining refundable amount
     */
    getRefundableAmount(): number {
        return this.amount - this.amount_refunded
    }

    /**
     * Check if fully refunded
     */
    isFullyRefunded(): boolean {
        return this.amount_refunded >= this.amount
    }

    /**
     * Get payment method details from provider_data (if available)
     */
    getPaymentMethodDetails(): { brand?: string; last4?: string; exp_month?: number; exp_year?: number } | null {
        if (this.provider === 'stripe' && this.provider_data) {
            let charge = null

            // 1. If provider_data is already a Charge object
            if (this.provider_data.object === 'charge') {
                charge = this.provider_data
            }
            // 2. If provider_data is a PaymentIntent with expanded latest_charge
            else if (this.provider_data.object === 'payment_intent' && this.provider_data.latest_charge?.object === 'charge') {
                charge = this.provider_data.latest_charge
            }
            // 3. Fallback: check charges data array in PaymentIntent
            else if (this.provider_data.charges?.data?.length > 0) {
                charge = this.provider_data.charges.data[0]
            }

            if (charge && charge.payment_method_details?.type === 'card' && charge.payment_method_details.card) {
                const card = charge.payment_method_details.card
                return {
                    brand: card.brand,
                    last4: card.last4,
                    exp_month: card.exp_month,
                    exp_year: card.exp_year
                }
            }
        }
        return null
    }
}
