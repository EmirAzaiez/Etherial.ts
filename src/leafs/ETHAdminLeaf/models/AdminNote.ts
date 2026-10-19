import {
    Table,
    Column,
    Model,
    AllowNull,
    PrimaryKey,
    AutoIncrement,
    CreatedAt,
    UpdatedAt,
    DeletedAt,
    DataType,
    Index,
} from 'etherial/components/database/provider'

/**
 * An internal note left by staff on a record, never shown to the record's own
 * user.
 *
 * Keyed by collection and record id rather than by model, so a note follows the
 * screen people wrote it on. Paranoid: a note deleted by mistake can be brought
 * back from the database, and a mention notification pointing at it still has
 * something to explain it.
 */
@Table({
    timestamps: true,
    paranoid: true,
    tableName: 'admin_notes',
    freezeTableName: true,
    indexes: [{ fields: ['collection', 'record_id', 'id'] }],
})
export class AdminNote extends Model<AdminNote> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column
    declare id: number

    @AllowNull(false)
    @Column(DataType.STRING)
    declare collection: string

    @AllowNull(false)
    @Column(DataType.STRING)
    declare record_id: string

    @AllowNull(false)
    @Index
    @Column(DataType.INTEGER)
    declare author_id: number

    /** Plain text with mentions written as `@[Display Name](user:12)`. */
    @AllowNull(false)
    @Column(DataType.TEXT)
    declare body: string

    /** The user ids mentioned in `body`, kept so an edit only notifies the new ones. */
    @AllowNull(true)
    @Column(DataType.JSON)
    declare mentions: number[] | null

    @AllowNull(true)
    @Column(DataType.DATE)
    declare edited_at: Date | null

    @CreatedAt
    declare created_at: Date

    @UpdatedAt
    declare updated_at: Date

    @DeletedAt
    declare deleted_at: Date | null
}
