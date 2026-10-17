import {
    Table,
    Column,
    Model,
    AllowNull,
    PrimaryKey,
    AutoIncrement,
    DataType,
} from 'etherial/components/database/provider'

/**
 * One thing a user did: a screen they opened, a button they pressed, a call
 * their app made to the API, the app coming to the foreground.
 *
 * `name` is stored raw — the route name, the event key, `GET /users/me/tickets`
 * — and turned into words when it is shown, so a label can change without
 * rewriting history. `user_id` is a plain integer: the leaf does not know the
 * project's user model, and a guest has none.
 */
@Table({
    timestamps: false,
    tableName: 'analytics_events',
    freezeTableName: true,
    indexes: [
        { fields: ['created_at'] },
        { fields: ['type', 'name', 'created_at'] },
        { fields: ['user_id', 'created_at'] },
        { fields: ['session_id', 'created_at'] },
    ],
})
export class AnalyticsEvent extends Model<AnalyticsEvent> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column(DataType.BIGINT)
    declare id: number

    @AllowNull(false)
    @Column(DataType.STRING(36))
    declare session_id: string

    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare user_id: number | null

    /** The app install, so a guest's visits hang together until they sign in. */
    @AllowNull(true)
    @Column(DataType.STRING(64))
    declare installation_id: string | null

    /** screen, action, api or app (opened, backgrounded…). */
    @AllowNull(false)
    @Column(DataType.STRING(16))
    declare type: string

    @AllowNull(false)
    @Column(DataType.STRING(160))
    declare name: string

    /** The screen the user was on when it happened, when the app says so. */
    @AllowNull(true)
    @Column(DataType.STRING(128))
    declare screen: string | null

    /** A few details: the ticket opened, the tab picked. Never more than 2 KB. */
    @AllowNull(true)
    @Column(DataType.JSON)
    declare properties: Record<string, unknown> | null

    /** Time spent on the screen, or how long the API took to answer. */
    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare duration_ms: number | null

    /** The HTTP status of an API call. */
    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare status: number | null

    @AllowNull(true)
    @Column(DataType.STRING(16))
    declare platform: string | null

    @AllowNull(true)
    @Column(DataType.STRING(32))
    declare app_version: string | null

    @AllowNull(false)
    @Column(DataType.DATE)
    declare created_at: Date
}
