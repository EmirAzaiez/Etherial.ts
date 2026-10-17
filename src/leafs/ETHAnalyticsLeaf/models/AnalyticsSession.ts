import { Table, Column, Model, AllowNull, PrimaryKey, DataType, Default } from 'etherial/components/database/provider'

/**
 * One visit: from the moment someone opens the app until they leave it for
 * longer than the session timeout (30 minutes by default). Kept up to date as
 * the visit goes on, so the counts and the last screen are read without
 * walking the events.
 */
@Table({
    timestamps: false,
    tableName: 'analytics_sessions',
    freezeTableName: true,
    indexes: [
        { fields: ['started_at'] },
        { fields: ['last_seen_at'] },
        { fields: ['user_id', 'started_at'] },
        { fields: ['installation_id', 'last_seen_at'] },
    ],
})
export class AnalyticsSession extends Model<AnalyticsSession> {
    @PrimaryKey
    @AllowNull(false)
    @Column(DataType.STRING(36))
    declare id: string

    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare user_id: number | null

    @AllowNull(true)
    @Column(DataType.STRING(64))
    declare installation_id: string | null

    /** ios, android, web. */
    @AllowNull(true)
    @Column(DataType.STRING(16))
    declare platform: string | null

    @AllowNull(true)
    @Column(DataType.STRING(32))
    declare app_version: string | null

    @AllowNull(true)
    @Column(DataType.STRING(32))
    declare os_version: string | null

    @AllowNull(true)
    @Column(DataType.STRING(64))
    declare device_model: string | null

    @AllowNull(true)
    @Column(DataType.STRING(16))
    declare locale: string | null

    /** app when the app reported it, api when only its calls to the API were seen. */
    @AllowNull(false)
    @Default('api')
    @Column(DataType.STRING(8))
    declare source: string

    @AllowNull(false)
    @Column(DataType.DATE)
    declare started_at: Date

    @AllowNull(false)
    @Column(DataType.DATE)
    declare last_seen_at: Date

    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare screen_count: number

    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare event_count: number

    /** The first screen of the visit, and the last one: where they landed, where they left. */
    @AllowNull(true)
    @Column(DataType.STRING(128))
    declare entry_screen: string | null

    @AllowNull(true)
    @Column(DataType.STRING(128))
    declare exit_screen: string | null
}
