import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType } from 'etherial/components/database/provider'

/**
 * A notification text rewritten in the back-office, in one language. Without
 * a row, the code's text goes out.
 */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'pulse_texts',
    freezeTableName: true,
    indexes: [{ unique: true, fields: ['key', 'locale'] }],
})
export class PulseText extends Model<PulseText> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    @AllowNull(false)
    @Column(DataType.STRING(128))
    declare key: string

    @AllowNull(false)
    @Column(DataType.STRING(16))
    declare locale: string

    @AllowNull(false)
    @Column(DataType.TEXT)
    declare text: string

    /** The code's text when this one was saved: when the code changes, the back-office says so. */
    @AllowNull(true)
    @Column(DataType.STRING(64))
    declare default_hash: string | null

    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare updated_by: number | null

    declare created_at: Date
    declare updated_at: Date
}
