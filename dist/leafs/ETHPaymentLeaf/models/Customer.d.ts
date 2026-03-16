import { Model } from 'etherial/components/database/provider';
/**
 * Base PaymentCustomer model — extend this in your project and add @Table + User FK.
 *
 * @example
 * ```typescript
 * import { BasePaymentCustomer } from '../ETHPaymentLeaf/models/Customer.js'
 *
 * @Table({
 *     timestamps: true,
 *     tableName: 'payment_customers',
 *     freezeTableName: true,
 *     indexes: [{ unique: true, fields: ['user_id', 'provider'], name: 'unique_user_provider' }],
 * })
 * export class PaymentCustomer extends BasePaymentCustomer {
 *     @ForeignKey(() => User)
 *     declare user_id: number
 *
 *     @BelongsTo(() => User, 'user_id')
 *     user: User
 * }
 * ```
 */
export declare class BasePaymentCustomer extends Model<any> {
    id: number;
    /**
     * Payment provider (stripe, paypal, etc.)
     */
    provider: string;
    /**
     * Provider's customer ID
     */
    provider_customer_id: string;
    /**
     * Customer email (synced from provider)
     */
    email: string;
    /**
     * Customer name (synced from provider)
     */
    name: string;
    /**
     * Default payment method ID (provider's ID)
     */
    default_payment_method_id: string;
    /**
     * Custom metadata
     */
    metadata: Record<string, any>;
    /**
     * User ID — declare in your subclass with @ForeignKey(() => User)
     */
    user_id: number;
    created_at: Date;
    updated_at: Date;
    /**
     * Find or create a customer for a user and provider.
     * Uses findOrCreate to avoid race conditions.
     */
    static findOrCreateForUser(userId: number, provider: string, providerCustomerId: string, email?: string, name?: string): Promise<BasePaymentCustomer>;
    /**
     * Get provider customer ID for a user
     */
    static getProviderCustomerId(userId: number, provider: string): Promise<string | null>;
}
