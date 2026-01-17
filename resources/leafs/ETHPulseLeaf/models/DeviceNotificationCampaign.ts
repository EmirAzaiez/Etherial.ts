import {
    Table,
    Column,
    Model,
    AllowNull,
    PrimaryKey,
    AutoIncrement,
    ForeignKey,
    CreatedAt,
} from 'etherial/components/database/provider'
import { NotificationCampaign } from './NotificationCampaign'
import { Device } from './Device'

@Table({
    tableName: 'device_notification_campaigns',
    freezeTableName: true,
})
export class DeviceNotificationCampaign extends Model<DeviceNotificationCampaign> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column
    id: number

    @ForeignKey(() => NotificationCampaign)
    @AllowNull(false)
    @Column
    campaign_id: number

    @ForeignKey(() => Device)
    @AllowNull(false)
    @Column
    device_id: number

    @CreatedAt
    created_at: Date
}
