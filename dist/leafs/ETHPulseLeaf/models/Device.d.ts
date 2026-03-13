import { Model } from 'etherial/components/database/provider';
import { RegisterDeviceFormType } from '../forms/device_form.js';
export declare enum DevicePlatform {
    WEB = 1,
    ANDROID = 2,
    IOS = 3
}
export declare enum DevicePushTokenType {
    UNKNOWN = 0,
    EXPO = 1,
    SIGNAL = 2
}
export declare enum DevicePushTokenStatus {
    DISABLED = 0,
    ENABLED = 1
}
export interface DeviceAttributes {
    push_token: string;
    platform: DevicePlatform;
    device: string;
    brand: string;
    model: string;
}
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
export declare class BaseDevice extends Model<BaseDevice> {
    id: number;
    push_token: string;
    push_token_status: DevicePushTokenStatus;
    push_token_type: DevicePushTokenType;
    locale: string;
    tz: string;
    platform: DevicePlatform;
    device: string;
    brand: string;
    model: string;
    os_version: string;
    app_version: string;
    user_agent: string;
    status: boolean;
    last_activity: Date;
    user_id: number;
    static registerOrUpdateDevice(this: typeof BaseDevice, { form, user_agent, user_id }: {
        form: RegisterDeviceFormType;
        user_agent: string;
        user_id: number;
    }): Promise<BaseDevice>;
}
export { BaseDevice as Device };
