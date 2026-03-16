import { Model } from 'etherial/components/database/provider';
import { SubscriptionStatus } from '../providers/base.js';
/**
 * Base Subscription model — extend this in your project and add @Table + User FK.
 *
 * @example
 * ```typescript
 * import { BaseSubscription } from '../ETHPaymentLeaf/models/Subscription.js'
 *
 * @Table({ timestamps: true, tableName: 'subscriptions', freezeTableName: true })
 * export class Subscription extends BaseSubscription {
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
export declare class BaseSubscription extends Model<any> {
    id: number;
    /**
     * Payment provider (stripe, paypal, etc.)
     */
    provider: string;
    /**
     * Provider's subscription ID
     */
    provider_subscription_id: string;
    /**
     * Provider's customer ID
     */
    provider_customer_id: string;
    /**
     * Provider's price/plan ID
     */
    provider_price_id: string;
    /**
     * Your internal plan identifier (e.g., 'pro', 'enterprise')
     */
    plan_name: string;
    /**
     * Subscription status
     */
    status: SubscriptionStatus;
    /**
     * Billing interval (day, week, month, year)
     */
    interval: 'day' | 'week' | 'month' | 'year';
    /**
     * Interval count (e.g., 1 for monthly, 3 for quarterly)
     */
    interval_count: number;
    /**
     * Price amount in smallest currency unit
     */
    price_amount: number;
    /**
     * Currency code
     */
    currency: string;
    /**
     * Current billing period start
     */
    current_period_start: Date;
    /**
     * Current billing period end
     */
    current_period_end: Date;
    /**
     * Whether to cancel at end of current period
     */
    cancel_at_period_end: boolean;
    /**
     * When the subscription was cancelled
     */
    cancelled_at: Date;
    /**
     * When the subscription ends (if scheduled)
     */
    ends_at: Date;
    /**
     * Trial start date
     */
    trial_start: Date;
    /**
     * Trial end date
     */
    trial_end: Date;
    /**
     * Custom metadata
     */
    metadata: Record<string, any>;
    /**
     * Raw provider data
     */
    provider_data: Record<string, any>;
    /**
     * User ID — declare in your subclass with @ForeignKey(() => User)
     */
    user_id: number;
    created_at: Date;
    updated_at: Date;
    /**
     * Check if subscription is active (including trialing)
     */
    isActive(): boolean;
    /**
     * Check if subscription is in trial period
     */
    isTrialing(): boolean;
    /**
     * Check if subscription will cancel at period end
     */
    willCancel(): boolean;
    /**
     * Check if subscription has ended
     */
    hasEnded(): boolean;
    /**
     * Get days remaining in current period
     */
    getDaysRemaining(): number;
    /**
     * Get days remaining in trial
     */
    getTrialDaysRemaining(): number;
    /**
     * Get formatted price
     */
    getFormattedPrice(): string;
    /**
     * Check if can be resumed (cancelled but not yet expired)
     */
    canResume(): boolean;
}
