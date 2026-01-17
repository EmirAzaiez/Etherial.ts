import {
    Table,
    Column,
    Model,
    AllowNull,
    Default,
    PrimaryKey,
    AutoIncrement,
    CreatedAt,
    UpdatedAt,
    DataType,
    ForeignKey,
    BelongsTo,
    BelongsToMany,
} from 'etherial/components/database/provider'

@Table({
    tableName: 'notification_campaigns',
    freezeTableName: true,
})
export class NotificationCampaign extends Model<NotificationCampaign> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column
    id: number

    @AllowNull(false)
    @Column(DataType.TEXT)
    message: string

    @AllowNull(true)
    @Column(DataType.JSONB)
    data: any

    @AllowNull(true)
    @Column(DataType.TEXT)
    url: string

    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    devices_count: number

    @AllowNull(false)
    @Default(true)
    @Column(DataType.BOOLEAN)
    target_logged_user: boolean

    @AllowNull(false)
    @Default(false)
    @Column(DataType.BOOLEAN)
    target_not_logged_user: boolean

    @AllowNull(true)
    @Column
    created_by_user_id: number

    @CreatedAt
    created_at: Date

    @UpdatedAt
    updated_at: Date
}
