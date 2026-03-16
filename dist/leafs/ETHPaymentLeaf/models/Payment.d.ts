import { Model } from 'etherial/components/database/provider';
import { PaymentStatus } from '../providers/base.js';
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
export declare class BasePayment extends Model<any> {
    id: number;
    /**
     * Payment provider (stripe, paypal, etc.)
     */
    provider: string;
    /**
     * Provider's payment/order ID
     */
    provider_payment_id: string;
    /**
     * Provider's checkout session ID (if applicable)
     */
    provider_checkout_id: string;
    /**
     * Provider's customer ID
     */
    provider_customer_id: string;
    /**
     * Payment status
     */
    status: PaymentStatus;
    /**
     * Amount in smallest currency unit (cents)
     */
    amount: number;
    /**
     * Currency code (lowercase)
     */
    currency: string;
    /**
     * Amount refunded (if any)
     */
    amount_refunded: number;
    /**
     * Customer email
     */
    customer_email: string;
    /**
     * Description of the payment
     */
    description: string;
    /**
     * Custom metadata (JSON)
     */
    metadata: Record<string, any>;
    /**
     * Raw response from provider (for debugging)
     */
    provider_data: Record<string, any>;
    /**
     * When the payment was completed
     */
    paid_at: Date;
    /**
     * User ID — declare in your subclass with @ForeignKey(() => User)
     */
    user_id: number;
    /**
     * URL of the generated invoice PDF (S3)
     */
    invoice_url: string;
    /**
     * URL of the generated credit note PDF (S3)
     */
    credit_note_url: string;
    created_at: Date;
    updated_at: Date;
    /**
     * Get amount in decimal format (e.g., 10.00 instead of 1000)
     */
    getFormattedAmount(): string;
    /**
     * Get amount with currency symbol
     */
    getDisplayAmount(): string;
    /**
     * Check if payment can be refunded
     */
    canRefund(): boolean;
    /**
     * Get remaining refundable amount
     */
    getRefundableAmount(): number;
    /**
     * Check if fully refunded
     */
    isFullyRefunded(): boolean;
    /**
     * Get payment method details from provider_data (if available)
     */
    getPaymentMethodDetails(): {
        brand?: string;
        last4?: string;
        exp_month?: number;
        exp_year?: number;
    } | null;
}
