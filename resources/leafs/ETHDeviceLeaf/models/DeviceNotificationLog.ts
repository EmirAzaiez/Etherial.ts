import { Table, Column, Model, DataType, Default, PrimaryKey, AutoIncrement, AllowNull, BelongsTo, ForeignKey, Unique } from 'etherial/components/database/provider'

import { User } from '../../models/User'
import { RegisterDeviceFormType } from '../forms/device_form'
import * as ExpoPushService from '../services/expo.push'
import { Device } from './Device'

@Table({
    tableName: 'devices_notification_logs',
    freezeTableName: true,
})
export class DeviceNotificationLog extends Model<DeviceNotificationLog> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column
    id: number

    @ForeignKey(() => Device)
    @Column
    device_id: number

    @BelongsTo(() => Device)
    device: Device

    @AllowNull(false)
    @Column(DataType.STRING)
    device_token: string

    @AllowNull(true)
    @Column(DataType.STRING)
    push_token: string

    @AllowNull(true)
    @Column(DataType.STRING)
    receipt_id: string

    @AllowNull(true)
    @Column(DataType.STRING)
    message: string

    @AllowNull(true)
    @Column(DataType.STRING)
    status: string

    @AllowNull(true)
    @Column(DataType.STRING)
    error_message: string
}
