import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType } from 'etherial/components/database/provider'

/**
 * The back-office's version of one email in one language. While it exists it
 * is sent instead of the one written in the project's code; deleting it goes
 * back to the code's.
 */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'mail_templates',
    freezeTableName: true,
    indexes: [{ unique: true, fields: ['key', 'locale'] }],
})
export class MailTemplate extends Model<MailTemplate> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    /** The email's key, from the project's config. */
    @AllowNull(false)
    @Column(DataType.STRING(128))
    declare key: string

    @AllowNull(false)
    @Column(DataType.STRING(16))
    declare locale: string

    @AllowNull(false)
    @Column(DataType.TEXT)
    declare subject: string

    @AllowNull(true)
    @Column(DataType.TEXT)
    declare preheader: string | null

    @AllowNull(false)
    @Column(DataType.JSON)
    declare blocks: any[]

    /** Who saved it last. */
    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare updated_by: number | null

    /** The code's version when this one was saved: if the code changes since, the back-office says so. */
    @AllowNull(true)
    @Column(DataType.STRING(40))
    declare default_hash: string | null

    declare created_at: Date
    declare updated_at: Date
}
