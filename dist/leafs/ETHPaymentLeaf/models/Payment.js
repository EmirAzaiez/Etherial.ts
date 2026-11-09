var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Column, Model, AllowNull, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, Default, Index } from 'etherial/components/database/provider';
import { formatMoney, ZERO_DECIMAL_CURRENCIES, THREE_DECIMAL_CURRENCIES } from '../providers/base.js';
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
export class BasePayment extends Model {
    // ==================== Helper Methods ====================
    /**
     * Get amount in decimal format (e.g., 10.00 instead of 1000)
     */
    getFormattedAmount() {
        if (ZERO_DECIMAL_CURRENCIES.includes(this.currency)) {
            return this.amount.toLocaleString();
        }
        else if (THREE_DECIMAL_CURRENCIES.includes(this.currency)) {
            return (this.amount / 1000).toFixed(3);
        }
        return (this.amount / 100).toFixed(2);
    }
    /**
     * Get amount with currency symbol
     */
    getDisplayAmount() {
        return formatMoney({ amount: this.amount, currency: this.currency });
    }
    /**
     * Check if payment can be refunded
     */
    canRefund() {
        return (this.status === 'succeeded' || this.status === 'partially_refunded') && this.getRefundableAmount() > 0;
    }
    /**
     * Get remaining refundable amount
     */
    getRefundableAmount() {
        // BIGINT columns come back from Postgres as strings: compare and add them as numbers.
        return Number(this.amount) - Number(this.amount_refunded || 0);
    }
    /**
     * Records a refund in `amount_refunded` and the status, once per refund id:
     * the refund route and the provider's webhook both report the same refund.
     * Returns false when that refund was already counted.
     */
    recordRefund(refundId, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const counted = Array.isArray((_a = this.metadata) === null || _a === void 0 ? void 0 : _a.refund_ids) ? this.metadata.refund_ids : [];
            if (refundId && counted.includes(refundId))
                return false;
            const refunded = Math.min(Number(this.amount), Number(this.amount_refunded || 0) + Number(amount || 0));
            yield this.update(Object.assign({ amount_refunded: refunded, status: refunded >= Number(this.amount) ? 'refunded' : 'partially_refunded' }, (refundId ? { metadata: Object.assign(Object.assign({}, (this.metadata || {})), { refund_ids: [...counted, refundId] }) } : {})));
            return true;
        });
    }
    /**
     * Check if fully refunded
     */
    isFullyRefunded() {
        return Number(this.amount_refunded || 0) >= Number(this.amount);
    }
    /**
     * Get payment method details from provider_data (if available)
     */
    getPaymentMethodDetails() {
        var _a, _b, _c, _d;
        if (this.provider === 'stripe' && this.provider_data) {
            let charge = null;
            // 1. If provider_data is already a Charge object
            if (this.provider_data.object === 'charge') {
                charge = this.provider_data;
            }
            // 2. If provider_data is a PaymentIntent with expanded latest_charge
            else if (this.provider_data.object === 'payment_intent' && ((_a = this.provider_data.latest_charge) === null || _a === void 0 ? void 0 : _a.object) === 'charge') {
                charge = this.provider_data.latest_charge;
            }
            // 3. Fallback: check charges data array in PaymentIntent
            else if (((_c = (_b = this.provider_data.charges) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.length) > 0) {
                charge = this.provider_data.charges.data[0];
            }
            if (charge && ((_d = charge.payment_method_details) === null || _d === void 0 ? void 0 : _d.type) === 'card' && charge.payment_method_details.card) {
                const card = charge.payment_method_details.card;
                return {
                    brand: card.brand,
                    last4: card.last4,
                    exp_month: card.exp_month,
                    exp_year: card.exp_year
                };
            }
        }
        return null;
    }
}
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column,
    __metadata("design:type", Number)
], BasePayment.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Index,
    Column,
    __metadata("design:type", String)
], BasePayment.prototype, "provider", void 0);
__decorate([
    AllowNull(false),
    Index,
    Column,
    __metadata("design:type", String)
], BasePayment.prototype, "provider_payment_id", void 0);
__decorate([
    AllowNull(true),
    Index,
    Column,
    __metadata("design:type", String)
], BasePayment.prototype, "provider_checkout_id", void 0);
__decorate([
    AllowNull(true),
    Index,
    Column,
    __metadata("design:type", String)
], BasePayment.prototype, "provider_customer_id", void 0);
__decorate([
    AllowNull(false),
    Default('pending'),
    Column(DataType.ENUM('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded', 'partially_refunded')),
    __metadata("design:type", String)
], BasePayment.prototype, "status", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.BIGINT),
    __metadata("design:type", Number)
], BasePayment.prototype, "amount", void 0);
__decorate([
    AllowNull(false),
    Default('usd'),
    Column,
    __metadata("design:type", String)
], BasePayment.prototype, "currency", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.BIGINT),
    __metadata("design:type", Number)
], BasePayment.prototype, "amount_refunded", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], BasePayment.prototype, "customer_email", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], BasePayment.prototype, "description", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Object)
], BasePayment.prototype, "metadata", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Object)
], BasePayment.prototype, "provider_data", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date
    /**
     * User ID — declare in your subclass with @ForeignKey(() => User)
     */
    )
], BasePayment.prototype, "paid_at", void 0);
__decorate([
    AllowNull(true),
    Index,
    Column,
    __metadata("design:type", Number)
], BasePayment.prototype, "user_id", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], BasePayment.prototype, "invoice_url", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], BasePayment.prototype, "credit_note_url", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], BasePayment.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date
    // ==================== Helper Methods ====================
    /**
     * Get amount in decimal format (e.g., 10.00 instead of 1000)
     */
    )
], BasePayment.prototype, "updated_at", void 0);
