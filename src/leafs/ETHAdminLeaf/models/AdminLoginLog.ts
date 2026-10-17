import {
    Table,
    Column,
    Model,
    AllowNull,
    Default,
    PrimaryKey,
    AutoIncrement,
    CreatedAt,
    DataType,
    Index,
} from 'etherial/components/database/provider'

/**
 * One attempt to sign in to the back-office, kept whether it worked or not.
 *
 * The leaf owns the table, so every project that turns `features.loginJournal`
 * on gets it on its next sync. `user_id` is a plain integer rather than a
 * foreign key: the leaf does not know the project's user model, and a failed
 * attempt on an unknown address has no user at all.
 */
@Table({
    timestamps: true,
    updatedAt: false,
    tableName: 'admin_login_logs',
    freezeTableName: true,
})
export class AdminLoginLog extends Model<AdminLoginLog> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column
    declare id: number

    @AllowNull(true)
    @Index
    @Column(DataType.INTEGER)
    declare user_id: number | null

    /** What was typed in the login field (an email, usually), lower-cased. */
    @AllowNull(true)
    @Index
    @Column(DataType.STRING)
    declare identifier: string | null

    @AllowNull(false)
    @Default(false)
    @Column(DataType.BOOLEAN)
    declare success: boolean

    /** Why it failed: the API's own error, or `no_admin_access` for a valid account with no back-office access. */
    @AllowNull(true)
    @Column(DataType.STRING)
    declare reason: string | null

    @AllowNull(true)
    @Column(DataType.STRING)
    declare ip: string | null

    /** "Chrome 141 on macOS", read from the user agent when it was logged. */
    @AllowNull(true)
    @Column(DataType.STRING)
    declare client: string | null

    @AllowNull(true)
    @Column(DataType.TEXT)
    declare user_agent: string | null

    @CreatedAt
    declare created_at: Date
}
