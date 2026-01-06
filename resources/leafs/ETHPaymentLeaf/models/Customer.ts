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
    Index,
    Unique,
    HasMany,
} from 'etherial/components/database/provider'

import { User } from '../../models/User'
import { Payment } from './Payment'
import { Subscription } from './Subscription'

/**
 * Stores provider customer IDs for users
 * One user can have multiple provider customers (one per provider)
 */
@Table({
    timestamps: true,
    tableName: 'payment_customers',
    freezeTableName: true,
})
export class PaymentCustomer extends Model<PaymentCustomer> {
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
     * Associated user
     */
    @ForeignKey(() => User)
    @AllowNull(false)
    @Index
    @Column
    user_id: number

    @BelongsTo(() => User, 'user_id')
    user: User

    @CreatedAt
    created_at: Date

    @UpdatedAt
    updated_at: Date

    // ==================== Static Helpers ====================

    /**
     * Find or create a customer for a user and provider
     */
    static async findOrCreateForUser(
        userId: number,
        provider: string,
        providerCustomerId: string,
        email?: string,
        name?: string
    ): Promise<PaymentCustomer> {
        let customer = await PaymentCustomer.findOne({
            where: { user_id: userId, provider },
        })

        if (!customer) {
            customer = await PaymentCustomer.create({
                user_id: userId,
                provider,
                provider_customer_id: providerCustomerId,
                email,
                name,
            })
        } else if (customer.provider_customer_id !== providerCustomerId) {
            // Update if provider customer ID changed
            await customer.update({ provider_customer_id: providerCustomerId, email, name })
        }

        return customer
    }

    /**
     * Get provider customer ID for a user
     */
    static async getProviderCustomerId(userId: number, provider: string): Promise<string | null> {
        const customer = await PaymentCustomer.findOne({
            where: { user_id: userId, provider },
        })
        return customer?.provider_customer_id || null
    }
}

