import {
    Column,
    Model,
    AllowNull,
    Default,
    PrimaryKey,
    AutoIncrement,
    CreatedAt,
    UpdatedAt,
    ForeignKey,
    BelongsTo,
    DataType,
} from 'etherial/components/database/provider'

import { User } from '../../models/User'

export abstract class ETHPulseLeafNotificationBaseModel extends Model<any> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column
    id: number

    @AllowNull(true)
    @Column(DataType.TEXT)
    title: string

    @AllowNull(true)
    @Column
    location: string

    @AllowNull(true)
    @Column
    location_id: number

    @AllowNull(true)
    @Column
    location_title: string

    @AllowNull(true)
    @Column
    sub_location: string

    @AllowNull(true)
    @Column
    sub_location_id: number

    @AllowNull(true)
    @Column
    sub_location_title: string

    @AllowNull(false)
    @Default(false)
    @Column
    is_opened: boolean

    @AllowNull(true)
    @Column
    deleted_at: Date

    @ForeignKey(() => User)
    @Column
    created_for_user_id: number

    @BelongsTo(() => User)
    created_for_user: User

    @ForeignKey(() => User)
    @Column
    created_by_user_id: number

    @BelongsTo(() => User)
    created_by_user: User

    @CreatedAt
    created_at: Date

    @UpdatedAt
    updated_at: Date

    async pushToUser(message: string, data: any) {
        let user = await User.findByPk(this.created_for_user_id)
        if (user) {
            await user.sendPushNotification(message, data)
        }
    }
}
