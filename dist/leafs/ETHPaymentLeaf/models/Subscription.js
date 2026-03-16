var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Column, Model, AllowNull, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, Default, Index, } from 'etherial/components/database/provider';
import { formatMoney } from '../providers/base.js';
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
export class BaseSubscription extends Model {
    // ==================== Helper Methods ====================
    /**
     * Check if subscription is active (including trialing)
     */
    isActive() {
        return ['active', 'trialing'].includes(this.status);
    }
    /**
     * Check if subscription is in trial period
     */
    isTrialing() {
        return this.status === 'trialing' && this.trial_end && this.trial_end > new Date();
    }
    /**
     * Check if subscription will cancel at period end
     */
    willCancel() {
        return this.cancel_at_period_end && !this.cancelled_at;
    }
    /**
     * Check if subscription has ended
     */
    hasEnded() {
        return ['cancelled', 'expired'].includes(this.status);
    }
    /**
     * Get days remaining in current period
     */
    getDaysRemaining() {
        const now = new Date();
        const end = new Date(this.current_period_end);
        const diff = end.getTime() - now.getTime();
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }
    /**
     * Get days remaining in trial
     */
    getTrialDaysRemaining() {
        if (!this.trial_end)
            return 0;
        const now = new Date();
        const end = new Date(this.trial_end);
        const diff = end.getTime() - now.getTime();
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }
    /**
     * Get formatted price
     */
    getFormattedPrice() {
        if (!this.price_amount)
            return 'N/A';
        const currency = this.currency || 'usd';
        const formatted = formatMoney({ amount: this.price_amount, currency });
        const intervalLabel = this.interval_count === 1
            ? this.interval
            : `${this.interval_count} ${this.interval}s`;
        return `${formatted}/${intervalLabel}`;
    }
    /**
     * Check if can be resumed (cancelled but not yet expired)
     */
    canResume() {
        return this.cancel_at_period_end &&
            !this.cancelled_at &&
            new Date(this.current_period_end) > new Date();
    }
}
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column,
    __metadata("design:type", Number)
], BaseSubscription.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Index,
    Column,
    __metadata("design:type", String)
], BaseSubscription.prototype, "provider", void 0);
__decorate([
    AllowNull(false),
    Index,
    Column,
    __metadata("design:type", String)
], BaseSubscription.prototype, "provider_subscription_id", void 0);
__decorate([
    AllowNull(false),
    Index,
    Column,
    __metadata("design:type", String)
], BaseSubscription.prototype, "provider_customer_id", void 0);
__decorate([
    AllowNull(false),
    Column,
    __metadata("design:type", String)
], BaseSubscription.prototype, "provider_price_id", void 0);
__decorate([
    AllowNull(true),
    Index,
    Column,
    __metadata("design:type", String)
], BaseSubscription.prototype, "plan_name", void 0);
__decorate([
    AllowNull(false),
    Default('active'),
    Column(DataType.ENUM('active', 'cancelled', 'past_due', 'paused', 'trialing', 'unpaid', 'expired')),
    __metadata("design:type", String)
], BaseSubscription.prototype, "status", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], BaseSubscription.prototype, "interval", void 0);
__decorate([
    AllowNull(true),
    Default(1),
    Column,
    __metadata("design:type", Number)
], BaseSubscription.prototype, "interval_count", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.BIGINT),
    __metadata("design:type", Number)
], BaseSubscription.prototype, "price_amount", void 0);
__decorate([
    AllowNull(true),
    Default('usd'),
    Column,
    __metadata("design:type", String)
], BaseSubscription.prototype, "currency", void 0);
__decorate([
    AllowNull(false),
    Column,
    __metadata("design:type", Date
    /**
     * Current billing period end
     */
    )
], BaseSubscription.prototype, "current_period_start", void 0);
__decorate([
    AllowNull(false),
    Column,
    __metadata("design:type", Date
    /**
     * Whether to cancel at end of current period
     */
    )
], BaseSubscription.prototype, "current_period_end", void 0);
__decorate([
    AllowNull(false),
    Default(false),
    Column,
    __metadata("design:type", Boolean)
], BaseSubscription.prototype, "cancel_at_period_end", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date
    /**
     * When the subscription ends (if scheduled)
     */
    )
], BaseSubscription.prototype, "cancelled_at", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date
    /**
     * Trial start date
     */
    )
], BaseSubscription.prototype, "ends_at", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date
    /**
     * Trial end date
     */
    )
], BaseSubscription.prototype, "trial_start", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date
    /**
     * Custom metadata
     */
    )
], BaseSubscription.prototype, "trial_end", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Object)
], BaseSubscription.prototype, "metadata", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Object)
], BaseSubscription.prototype, "provider_data", void 0);
__decorate([
    AllowNull(true),
    Index,
    Column,
    __metadata("design:type", Number)
], BaseSubscription.prototype, "user_id", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], BaseSubscription.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date
    // ==================== Helper Methods ====================
    /**
     * Check if subscription is active (including trialing)
     */
    )
], BaseSubscription.prototype, "updated_at", void 0);
