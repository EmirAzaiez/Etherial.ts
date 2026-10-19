import {
    Table,
    Column,
    Model,
    AllowNull,
    PrimaryKey,
    AutoIncrement,
    CreatedAt,
    UpdatedAt,
    DataType,
    Index,
} from 'etherial/components/database/provider'

/**
 * One line in one back-office user's inbox: a mention, a flow step, a campaign
 * that finished.
 *
 * A notification sent to five people is five rows, not one row and a join
 * table: each recipient reads it on their own, and the bell only ever asks
 * "how many unread for me", which `(user_id, read_at)` answers from the index.
 * `user_id` and `actor_id` are plain integers for the same reason as in the
 * audit log: the leaf does not know the project's user model.
 */
@Table({
    timestamps: true,
    tableName: 'admin_notifications',
    freezeTableName: true,
    indexes: [{ fields: ['user_id', 'read_at'] }, { fields: ['created_at'] }],
})
export class AdminNotification extends Model<AdminNotification> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column
    declare id: number

    @AllowNull(false)
    @Column(DataType.INTEGER)
    declare user_id: number

    /** mention, flow, campaign, or any name a project gives its own. */
    @AllowNull(false)
    @Index
    @Column(DataType.STRING(32))
    declare type: string

    @AllowNull(false)
    @Column(DataType.STRING)
    declare title: string

    @AllowNull(true)
    @Column(DataType.TEXT)
    declare body: string | null

    /** A back-office path, e.g. `/orders/12`: the bell navigates to it. */
    @AllowNull(true)
    @Column(DataType.STRING(512))
    declare link: string | null

    @AllowNull(true)
    @Column(DataType.STRING)
    declare collection: string | null

    @AllowNull(true)
    @Column(DataType.STRING)
    declare record_id: string | null

    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare actor_id: number | null

    @AllowNull(true)
    @Column(DataType.JSON)
    declare data: Record<string, unknown> | null

    @AllowNull(true)
    @Column(DataType.DATE)
    declare read_at: Date | null

    /** Set once an email went out for it, so the digest never sends it twice. */
    @AllowNull(true)
    @Column(DataType.DATE)
    declare emailed_at: Date | null

    @CreatedAt
    declare created_at: Date

    @UpdatedAt
    declare updated_at: Date
}
