import { Column, Model, DataType, Default, PrimaryKey, AutoIncrement, AllowNull, Unique } from 'etherial/components/database/provider'
import { RegisterDeviceFormType } from '../forms/device_form'

export enum DevicePlatform {
    WEB = 1,
    ANDROID = 2,
    IOS = 3,
}

export enum DevicePushTokenType {
    UNKNOWN = 0,
    EXPO = 1,
    SIGNAL = 2,
}

export enum DevicePushTokenStatus {
    DISABLED = 0,
    ENABLED = 1,
}

export interface DeviceAttributes {
    push_token: string
    platform: DevicePlatform
    device: string
    brand: string
    model: string
}

/**
 * Base Device Model (no @Table - define it in your project)
 *
 * @example
 * ```typescript
 * import { BaseDevice } from '../ETHPulseLeaf/models/Device'
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
export class BaseDevice extends Model<BaseDevice> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column
    id: number

    @AllowNull(true)
    @Column(DataType.STRING)
    push_token: string

    @AllowNull(true)
    @Default(DevicePushTokenStatus.DISABLED)
    @Column(DataType.INTEGER)
    push_token_status: DevicePushTokenStatus

    @AllowNull(true)
    @Default(DevicePushTokenType.UNKNOWN)
    @Column(DataType.INTEGER)
    push_token_type: DevicePushTokenType

    @AllowNull(true)
    @Default('fr-FR')
    @Column(DataType.STRING)
    locale: string

    @AllowNull(true)
    @Default('Europe/Paris')
    @Column(DataType.STRING)
    tz: string

    @Default(DevicePlatform.WEB)
    @AllowNull(false)
    @Column(DataType.STRING)
    platform: DevicePlatform

    @AllowNull(false)
    @Unique('uniq_user_device')
    @Column(DataType.STRING)
    device: string

    @AllowNull(true)
    @Column(DataType.STRING)
    brand: string

    @AllowNull(true)
    @Column(DataType.STRING)
    model: string

    @AllowNull(true)
    @Column(DataType.STRING)
    os_version: string

    @AllowNull(true)
    @Column(DataType.STRING)
    app_version: string

    @AllowNull(true)
    @Column(DataType.STRING)
    user_agent: string

    @Default(true)
    @AllowNull(false)
    @Column(DataType.BOOLEAN)
    status: boolean

    @AllowNull(true)
    @Column
    last_activity: Date

    // user_id is defined in the child class with @ForeignKey
    declare user_id: number

    static async registerOrUpdateDevice(
        this: typeof BaseDevice,
        { form, user_agent, user_id }: { form: RegisterDeviceFormType; user_agent: string; user_id: number }
    ) {
        const platformValue = (form.platform as DevicePlatform) ?? DevicePlatform.WEB

        let device = await this.findOne({
            where: { device: form.device }
        })

        let pushObject = {}
        if (form.push_token) {
            pushObject = {
                push_token: form.push_token,
                push_token_status: DevicePushTokenStatus.ENABLED,
                push_token_type: DevicePushTokenType.EXPO,
            }
        }

        if (!device) {
            device = await this.create({
                user_id,
                device: form.device,
                platform: platformValue,
                brand: form.brand,
                model: form.model,
                os_version: form.os_version,
                app_version: form.app_version,
                user_agent,
                status: true,
                last_activity: new Date(),
                ...pushObject,
            } as any)
        } else if (device.user_id === user_id || device.user_id === null) {
            await device.update({
                user_id,
                platform: platformValue,
                brand: form.brand ?? device.brand,
                model: form.model ?? device.model,
                os_version: form.os_version ?? device.os_version,
                app_version: form.app_version ?? device.app_version,
                user_agent: user_agent ?? device.user_agent,
                status: true,
                last_activity: new Date(),
                ...pushObject,
            })
        }

        return device
    }
}

// Alias for backwards compatibility
export { BaseDevice as Device }
