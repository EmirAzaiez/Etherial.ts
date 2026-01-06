import { Table, Column, Model, DataType, Default, PrimaryKey, AutoIncrement, AllowNull, BelongsTo, ForeignKey, Unique } from 'etherial/components/database/provider'

import { User } from '../../models/User'
import { RegisterDeviceFormType } from '../forms/device_form'
import * as ExpoPushService from '../services/expo.push'

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
@Table({
    tableName: 'devices',
    freezeTableName: true,
})
export class Device extends Model<Device> {
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

    @ForeignKey(() => User)
    @Column
    user_id: number

    @BelongsTo(() => User)
    user: User

    static async registerOrUpdateDevice({ form, user_agent, user_id }: { form: RegisterDeviceFormType; user_agent: string; user_id: number }) {
        const platformValue = (form.platform as DevicePlatform) ?? DevicePlatform.WEB

        let device = await Device.findOne({
            where: {
                device: form.device,
            },
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
            device = await Device.create({
                user_id: user_id,
                device: form.device,
                platform: platformValue,
                brand: form.brand,
                model: form.model,
                os_version: form.os_version,
                app_version: form.app_version,
                user_agent: user_agent,
                status: true,
                last_activity: new Date(),
                ...pushObject,
            })
        } else if (device.user_id === user_id || device.user_id === null) {
            await device.update({
                user_id: user_id,
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
    }

    async sendPushNotification(message: string, data: any) {
        if (this.push_token_type === DevicePushTokenType.EXPO) {
            await ExpoPushService.push([this], { message: message, data: data })
        }
    }

    static async sendPushNotification(devices: Device[], message: string, data: any) {
        let expoDevices = devices.filter((device) => device.push_token_type === DevicePushTokenType.EXPO)
        if (expoDevices.length > 0) {
            await ExpoPushService.push(expoDevices, { message: message, data: data })
        }
    }
}
