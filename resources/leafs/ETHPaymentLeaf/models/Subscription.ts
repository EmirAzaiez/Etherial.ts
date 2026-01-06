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
import { SubscriptionStatus } from '../providers/base'

@Table({
    timestamps: true,
    tableName: 'subscriptions',
    freezeTableName: true,
})
export class Subscription extends Model<Subscription> {
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
     * Provider's subscription ID
     */
    @AllowNull(false)
    @Index
    @Column
    provider_subscription_id: string

    /**
     * Provider's customer ID
     */
    @AllowNull(false)
    @Index
    @Column
    provider_customer_id: string

    /**
     * Provider's price/plan ID
     */
    @AllowNull(false)
    @Column
    provider_price_id: string

    /**
     * Your internal plan identifier (e.g., 'pro', 'enterprise')
     */
    @AllowNull(true)
    @Index
    @Column
    plan_name: string

    /**
     * Subscription status
     */
    @AllowNull(false)
    @Default('active')
    @Column(DataType.ENUM('active', 'cancelled', 'past_due', 'paused', 'trialing', 'unpaid', 'expired'))
    status: SubscriptionStatus

    /**
     * Billing interval (day, week, month, year)
     */
    @AllowNull(true)
    @Column
    interval: 'day' | 'week' | 'month' | 'year'

    /**
     * Interval count (e.g., 1 for monthly, 3 for quarterly)
     */
    @AllowNull(true)
    @Default(1)
    @Column
    interval_count: number

    /**
     * Price amount in smallest currency unit
     */
    @AllowNull(true)
    @Column(DataType.BIGINT)
    price_amount: number

    /**
     * Currency code
     */
    @AllowNull(true)
    @Default('usd')
    @Column
    currency: string

    /**
     * Current billing period start
     */
    @AllowNull(false)
    @Column
    current_period_start: Date

    /**
     * Current billing period end
     */
    @AllowNull(false)
    @Column
    current_period_end: Date

    /**
     * Whether to cancel at end of current period
     */
    @AllowNull(false)
    @Default(false)
    @Column
    cancel_at_period_end: boolean

    /**
     * When the subscription was cancelled
     */
    @AllowNull(true)
    @Column
    cancelled_at: Date

    /**
     * When the subscription ends (if scheduled)
     */
    @AllowNull(true)
    @Column
    ends_at: Date

    /**
     * Trial start date
     */
    @AllowNull(true)
    @Column
    trial_start: Date

    /**
     * Trial end date
     */
    @AllowNull(true)
    @Column
    trial_end: Date

    /**
     * Custom metadata
     */
    @AllowNull(true)
    @Column(DataType.JSON)
    metadata: Record<string, any>

    /**
     * Raw provider data
     */
    @AllowNull(true)
    @Column(DataType.JSON)
    provider_data: Record<string, any>

    /**
     * Associated user
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
     * Check if subscription is active (including trialing)
     */
    isActive(): boolean {
        return ['active', 'trialing'].includes(this.status)
    }

    /**
     * Check if subscription is in trial period
     */
    isTrialing(): boolean {
        return this.status === 'trialing' && this.trial_end && this.trial_end > new Date()
    }

    /**
     * Check if subscription will cancel at period end
     */
    willCancel(): boolean {
        return this.cancel_at_period_end && !this.cancelled_at
    }

    /**
     * Check if subscription has ended
     */
    hasEnded(): boolean {
        return ['cancelled', 'expired'].includes(this.status)
    }

    /**
     * Get days remaining in current period
     */
    getDaysRemaining(): number {
        const now = new Date()
        const end = new Date(this.current_period_end)
        const diff = end.getTime() - now.getTime()
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
    }

    /**
     * Get days remaining in trial
     */
    getTrialDaysRemaining(): number {
        if (!this.trial_end) return 0
        const now = new Date()
        const end = new Date(this.trial_end)
        const diff = end.getTime() - now.getTime()
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
    }

    /**
     * Get formatted price
     */
    getFormattedPrice(): string {
        if (!this.price_amount) return 'N/A'

        const symbols: Record<string, string> = {
            usd: '$',
            eur: '€',
            gbp: '£',
        }
        const symbol = symbols[this.currency || 'usd'] || this.currency?.toUpperCase() || 'USD'
        const amount = this.currency === 'jpy'
            ? this.price_amount.toString()
            : (this.price_amount / 100).toFixed(2)

        const intervalLabel = this.interval_count === 1
            ? this.interval
            : `${this.interval_count} ${this.interval}s`

        return `${symbol}${amount}/${intervalLabel}`
    }

    /**
     * Check if can be resumed (cancelled but not yet expired)
     */
    canResume(): boolean {
        return this.cancel_at_period_end &&
            !this.cancelled_at &&
            new Date(this.current_period_end) > new Date()
    }
}

