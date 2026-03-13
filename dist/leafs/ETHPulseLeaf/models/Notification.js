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
import { Column, Model, AllowNull, Default, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, AfterCreate, } from 'etherial/components/database/provider';
import etherial from 'etherial';
/**
 * Base Notification Model for ETHPulseLeaf
 *
 * Provides:
 * - Core notification fields (title, location, etc.)
 * - Automatic push notification on create (via ETHPulseLeaf)
 * - Soft delete support (deleted_at)
 *
 * Usage in your project:
 * ```typescript
 * import { BaseNotification } from '../ETHPulseLeaf/models/Notification.js'
 *
 * @Table({ tableName: 'notifications' })
 * export class Notification extends BaseNotification {
 *     @ForeignKey(() => User)
 *     @Column
 *     declare created_for_user_id: number
 *
 *     @BelongsTo(() => User)
 *     declare created_for_user: User
 * }
 * ```
 */
export class BaseNotification extends Model {
    /**
     * Hook: Send push notification after creation
     * Automatically sends push to the user's devices
     */
    static sendPushNotification(instance) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const pulseLeaf = etherial.eth_pulse_leaf;
                if (!pulseLeaf) {
                    console.warn('[BaseNotification] ETHPulseLeaf not configured, skipping push');
                    return;
                }
                // Get the Device model from project (not ETHPulseLeaf)
                // This allows the project to use its own Device model with User relationship
                const sequelize = instance.sequelize;
                const DeviceModel = (_a = sequelize === null || sequelize === void 0 ? void 0 : sequelize.models) === null || _a === void 0 ? void 0 : _a.Device;
                if (!DeviceModel) {
                    console.warn('[BaseNotification] Device model not found, skipping push');
                    return;
                }
                // Import DevicePushTokenStatus enum
                const { DevicePushTokenStatus } = yield import('./Device.js');
                // Get user's active devices
                const devices = yield DeviceModel.findAll({
                    where: {
                        user_id: instance.created_for_user_id,
                        push_token_status: DevicePushTokenStatus.ENABLED,
                        status: true,
                    },
                });
                if (devices.length === 0) {
                    return;
                }
                const tokens = devices.map((d) => d.push_token).filter(Boolean);
                if (tokens.length === 0) {
                    return;
                }
                // Build notification data
                const notificationData = instance.buildPushData();
                // Send push
                yield pulseLeaf.push().sendMultiple(tokens, {
                    body: instance.title || '',
                    data: notificationData,
                });
                console.log(`[BaseNotification] Push sent to ${tokens.length} devices for notification ${instance.id}`);
            }
            catch (error) {
                console.error('[BaseNotification] Push notification error:', error);
            }
        });
    }
    /**
     * Get the push notification title
     * Override in child class for custom title logic
     */
    getPushTitle() {
        var _a, _b, _c;
        return ((_c = (_b = (_a = etherial.eth_pulse_leaf) === null || _a === void 0 ? void 0 : _a.config) === null || _b === void 0 ? void 0 : _b.push) === null || _c === void 0 ? void 0 : _c.defaultNotificationTitle) || 'Notification';
    }
    /**
     * Build the push notification data payload
     * Override in child class to add custom fields
     */
    buildPushData() {
        return {
            model: 'Notification',
            id: this.id,
            location: this.location,
            location_id: this.location_id,
            location_title: this.location_title,
            sub_location: this.sub_location,
            sub_location_id: this.sub_location_id,
            sub_location_title: this.sub_location_title,
        };
    }
    /**
     * Mark notification as opened
     */
    markAsOpened() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.is_opened) {
                yield this.update({ is_opened: true });
            }
        });
    }
    /**
     * Soft delete the notification
     */
    softDelete() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.update({ deleted_at: new Date() });
        });
    }
}
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column,
    __metadata("design:type", Number)
], BaseNotification.prototype, "id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], BaseNotification.prototype, "title", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], BaseNotification.prototype, "location", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Number)
], BaseNotification.prototype, "location_id", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], BaseNotification.prototype, "location_title", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], BaseNotification.prototype, "sub_location", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Number)
], BaseNotification.prototype, "sub_location_id", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], BaseNotification.prototype, "sub_location_title", void 0);
__decorate([
    AllowNull(false),
    Default(false),
    Column,
    __metadata("design:type", Boolean)
], BaseNotification.prototype, "is_opened", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date
    // User relationships - to be defined with @ForeignKey/@BelongsTo in child class
    )
], BaseNotification.prototype, "deleted_at", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], BaseNotification.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date
    /**
     * Hook: Send push notification after creation
     * Automatically sends push to the user's devices
     */
    )
], BaseNotification.prototype, "updated_at", void 0);
__decorate([
    AfterCreate,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BaseNotification]),
    __metadata("design:returntype", Promise)
], BaseNotification, "sendPushNotification", null);
// Re-export for backwards compatibility
export { BaseNotification as ETHPulseLeafNotificationBaseModel };
