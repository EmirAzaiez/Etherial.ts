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
import { Column, Model, DataType, Default, PrimaryKey, AutoIncrement, AllowNull, Unique, CreatedAt, UpdatedAt } from 'etherial/components/database/provider';
export var DevicePlatform;
(function (DevicePlatform) {
    DevicePlatform[DevicePlatform["WEB"] = 1] = "WEB";
    DevicePlatform[DevicePlatform["ANDROID"] = 2] = "ANDROID";
    DevicePlatform[DevicePlatform["IOS"] = 3] = "IOS";
})(DevicePlatform || (DevicePlatform = {}));
export var DevicePushTokenType;
(function (DevicePushTokenType) {
    DevicePushTokenType[DevicePushTokenType["UNKNOWN"] = 0] = "UNKNOWN";
    DevicePushTokenType[DevicePushTokenType["EXPO"] = 1] = "EXPO";
    DevicePushTokenType[DevicePushTokenType["SIGNAL"] = 2] = "SIGNAL";
})(DevicePushTokenType || (DevicePushTokenType = {}));
export var DevicePushTokenStatus;
(function (DevicePushTokenStatus) {
    DevicePushTokenStatus[DevicePushTokenStatus["DISABLED"] = 0] = "DISABLED";
    DevicePushTokenStatus[DevicePushTokenStatus["ENABLED"] = 1] = "ENABLED";
})(DevicePushTokenStatus || (DevicePushTokenStatus = {}));
/**
 * Base Device Model (no @Table - define it in your project)
 *
 * @example
 * ```typescript
 * import { BaseDevice } from '../ETHPulseLeaf/models/Device.js'
 *
 * @Table({ tableName: 'devices', freezeTableName: true })
 * export class Device extends BaseDevice {
 *     @ForeignKey(() => User)
 *     declare user_id: number
 *
 *     @BelongsTo(() => User)
 *     user: User
 * }
 * ```
 */
export class BaseDevice extends Model {
    static registerOrUpdateDevice(_a) {
        return __awaiter(this, arguments, void 0, function* ({ form, user_agent, user_id }) {
            var _b, _c, _d, _e, _f;
            const platformValue = (_b = form.platform) !== null && _b !== void 0 ? _b : DevicePlatform.WEB;
            let device = yield this.findOne({
                where: { device: form.device },
            });
            let pushObject = {};
            if (form.push_token) {
                pushObject = {
                    push_token: form.push_token,
                    push_token_status: DevicePushTokenStatus.ENABLED,
                    push_token_type: DevicePushTokenType.EXPO,
                };
            }
            if (!device) {
                device = yield this.create(Object.assign({ user_id, device: form.device, platform: platformValue, brand: form.brand, model: form.model, os_version: form.os_version, app_version: form.app_version, user_agent, status: true, last_activity: new Date() }, pushObject));
            }
            else if (device.user_id === user_id || device.user_id === null) {
                yield device.update(Object.assign({ user_id, platform: platformValue, brand: (_c = form.brand) !== null && _c !== void 0 ? _c : device.brand, model: (_d = form.model) !== null && _d !== void 0 ? _d : device.model, os_version: (_e = form.os_version) !== null && _e !== void 0 ? _e : device.os_version, app_version: (_f = form.app_version) !== null && _f !== void 0 ? _f : device.app_version, user_agent: user_agent !== null && user_agent !== void 0 ? user_agent : device.user_agent, status: true, last_activity: new Date() }, pushObject));
            }
            return device;
        });
    }
}
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column,
    __metadata("design:type", Number)
], BaseDevice.prototype, "id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseDevice.prototype, "push_token", void 0);
__decorate([
    AllowNull(true),
    Default(DevicePushTokenStatus.DISABLED),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseDevice.prototype, "push_token_status", void 0);
__decorate([
    AllowNull(true),
    Default(DevicePushTokenType.UNKNOWN),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseDevice.prototype, "push_token_type", void 0);
__decorate([
    AllowNull(true),
    Default('fr-FR'),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseDevice.prototype, "locale", void 0);
__decorate([
    AllowNull(true),
    Default('Europe/Paris'),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseDevice.prototype, "tz", void 0);
__decorate([
    Default(DevicePlatform.WEB),
    AllowNull(false),
    Column(DataType.STRING),
    __metadata("design:type", Number)
], BaseDevice.prototype, "platform", void 0);
__decorate([
    AllowNull(false),
    Unique('uniq_user_device'),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseDevice.prototype, "device", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseDevice.prototype, "brand", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseDevice.prototype, "model", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseDevice.prototype, "os_version", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseDevice.prototype, "app_version", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseDevice.prototype, "user_agent", void 0);
__decorate([
    Default(true),
    AllowNull(false),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], BaseDevice.prototype, "status", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date)
], BaseDevice.prototype, "last_activity", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], BaseDevice.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date
    // user_id is defined in the child class with @ForeignKey
    )
], BaseDevice.prototype, "updated_at", void 0);
// Alias for backwards compatibility
export { BaseDevice as Device };
