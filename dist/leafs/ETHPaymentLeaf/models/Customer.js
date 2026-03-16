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
import { Column, Model, AllowNull, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, Index, } from 'etherial/components/database/provider';
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
export class BasePaymentCustomer extends Model {
    // ==================== Static Helpers ====================
    /**
     * Find or create a customer for a user and provider.
     * Uses findOrCreate to avoid race conditions.
     */
    static findOrCreateForUser(userId, provider, providerCustomerId, email, name) {
        return __awaiter(this, void 0, void 0, function* () {
            const ModelClass = this;
            const [customer, created] = yield ModelClass.findOrCreate({
                where: { user_id: userId, provider },
                defaults: {
                    user_id: userId,
                    provider,
                    provider_customer_id: providerCustomerId,
                    email,
                    name,
                },
            });
            if (!created && customer.provider_customer_id !== providerCustomerId) {
                yield customer.update({ provider_customer_id: providerCustomerId, email, name });
            }
            return customer;
        });
    }
    /**
     * Get provider customer ID for a user
     */
    static getProviderCustomerId(userId, provider) {
        return __awaiter(this, void 0, void 0, function* () {
            const ModelClass = this;
            const customer = yield ModelClass.findOne({
                where: { user_id: userId, provider },
            });
            return (customer === null || customer === void 0 ? void 0 : customer.provider_customer_id) || null;
        });
    }
}
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column,
    __metadata("design:type", Number)
], BasePaymentCustomer.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Index,
    Column,
    __metadata("design:type", String)
], BasePaymentCustomer.prototype, "provider", void 0);
__decorate([
    AllowNull(false),
    Index,
    Column,
    __metadata("design:type", String)
], BasePaymentCustomer.prototype, "provider_customer_id", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], BasePaymentCustomer.prototype, "email", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], BasePaymentCustomer.prototype, "name", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], BasePaymentCustomer.prototype, "default_payment_method_id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Object)
], BasePaymentCustomer.prototype, "metadata", void 0);
__decorate([
    AllowNull(false),
    Index,
    Column,
    __metadata("design:type", Number)
], BasePaymentCustomer.prototype, "user_id", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], BasePaymentCustomer.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date
    // ==================== Static Helpers ====================
    /**
     * Find or create a customer for a user and provider.
     * Uses findOrCreate to avoid race conditions.
     */
    )
], BasePaymentCustomer.prototype, "updated_at", void 0);
