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
} from 'etherial/components/database/provider'

/**
 * One back-office preference of one user (favorites, saved views, hidden
 * columns…), so they follow the account from one browser to the next.
 *
 * One row per key rather than one blob per user: the back-office writes each
 * key on its own, so two tabs saving different keys never overwrite each
 * other. `user_id` is a plain integer, like the login journal's: the leaf does
 * not know the project's user model.
 */
@Table({
    timestamps: true,
    tableName: 'admin_preferences',
    freezeTableName: true,
    indexes: [{ unique: true, fields: ['user_id', 'key'] }],
})
export class AdminPreference extends Model<AdminPreference> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column
    declare id: number

    @AllowNull(false)
    @Column(DataType.INTEGER)
    declare user_id: number

    @AllowNull(false)
    @Column(DataType.STRING(64))
    declare key: string

    @AllowNull(true)
    @Column(DataType.JSON)
    declare value: unknown

    @CreatedAt
    declare created_at: Date

    @UpdatedAt
    declare updated_at: Date
}
