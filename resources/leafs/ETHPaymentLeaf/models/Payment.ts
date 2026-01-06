import {
    Table,
    Column,
    Model,
    AllowNull,
    PrimaryKey,
    AutoIncrement,
    CreatedAt,
    UpdatedAt,
    DataType,
    ForeignKey,
    BelongsTo,
    Default,
    Index,
} from 'etherial/components/database/provider'

import { User } from '../../models/User'
import { PaymentStatus } from '../providers/base'

@Table({
    timestamps: true,
    tableName: 'payments',
    freezeTableName: true,
})
export class Payment extends Model<Payment> {
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
     * Associated user (optional)
     */
    @ForeignKey(() => User)
    @AllowNull(true)
    @Index
    @Column
    user_id: number

    @BelongsTo(() => User, 'user_id')
    user: User

    @CreatedAt
    created_at: Date

    @UpdatedAt
    updated_at: Date

    // ==================== Helper Methods ====================

    /**
     * Get amount in decimal format (e.g., 10.00 instead of 1000)
     */
    getFormattedAmount(): string {
        if (this.currency === 'jpy') {
            return this.amount.toString()
        }
        return (this.amount / 100).toFixed(2)
    }

    /**
     * Get amount with currency symbol
     */
    getDisplayAmount(): string {
        const symbols: Record<string, string> = {
            usd: '$',
            eur: '€',
            gbp: '£',
            cad: 'CA$',
            aud: 'A$',
            chf: 'CHF',
            jpy: '¥',
        }
        const symbol = symbols[this.currency] || this.currency.toUpperCase()
        return `${symbol}${this.getFormattedAmount()}`
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
}

