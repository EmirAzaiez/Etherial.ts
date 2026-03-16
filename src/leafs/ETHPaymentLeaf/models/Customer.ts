import {
    Column,
    Model,
    AllowNull,
    PrimaryKey,
    AutoIncrement,
    CreatedAt,
    UpdatedAt,
    DataType,
    Index,
} from 'etherial/components/database/provider'

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
export class BasePaymentCustomer extends Model<any> {
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
     * Provider's customer ID
     */
    @AllowNull(false)
    @Index
    @Column
    provider_customer_id: string

    /**
     * Customer email (synced from provider)
     */
    @AllowNull(true)
    @Column
    email: string

    /**
     * Customer name (synced from provider)
     */
    @AllowNull(true)
    @Column
    name: string

    /**
     * Default payment method ID (provider's ID)
     */
    @AllowNull(true)
    @Column
    default_payment_method_id: string

    /**
     * Custom metadata
     */
    @AllowNull(true)
    @Column(DataType.JSON)
    metadata: Record<string, any>

    /**
     * User ID — declare in your subclass with @ForeignKey(() => User)
     */
    @AllowNull(false)
    @Index
    @Column
    user_id: number

    @CreatedAt
    created_at: Date

    @UpdatedAt
    updated_at: Date

    // ==================== Static Helpers ====================

    /**
     * Find or create a customer for a user and provider.
     * Uses findOrCreate to avoid race conditions.
     */
    static async findOrCreateForUser(
        userId: number,
        provider: string,
        providerCustomerId: string,
        email?: string,
        name?: string
    ): Promise<BasePaymentCustomer> {
        const ModelClass = this as any
        const [customer, created] = await ModelClass.findOrCreate({
            where: { user_id: userId, provider },
            defaults: {
                user_id: userId,
                provider,
                provider_customer_id: providerCustomerId,
                email,
                name,
            },
        })

        if (!created && customer.provider_customer_id !== providerCustomerId) {
            await customer.update({ provider_customer_id: providerCustomerId, email, name })
        }

        return customer
    }

    /**
     * Get provider customer ID for a user
     */
    static async getProviderCustomerId(userId: number, provider: string): Promise<string | null> {
        const ModelClass = this as any
        const customer = await ModelClass.findOne({
            where: { user_id: userId, provider },
        })
        return customer?.provider_customer_id || null
    }
}
