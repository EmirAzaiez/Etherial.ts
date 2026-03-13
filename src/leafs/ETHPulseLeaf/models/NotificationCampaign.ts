import {
    Column,
    Model,
    AllowNull,
    Default,
    PrimaryKey,
    AutoIncrement,
    CreatedAt,
    UpdatedAt,
    DataType,
} from 'etherial/components/database/provider'

/**
 * Base NotificationCampaign Model (no @Table - define it in your project)
 */
export class BaseNotificationCampaign extends Model<BaseNotificationCampaign> {
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

    // created_by_user_id is defined in the child class with @ForeignKey
    declare created_by_user_id: number

    @CreatedAt
    created_at: Date

    @UpdatedAt
    updated_at: Date
}

// Alias for backwards compatibility
export { BaseNotificationCampaign as NotificationCampaign }
