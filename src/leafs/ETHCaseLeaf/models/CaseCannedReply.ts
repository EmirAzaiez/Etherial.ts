import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default } from 'etherial/components/database/provider'

/**
 * A reply staff pick instead of typing it again. `{{customer_name}}`,
 * `{{reference}}`, `{{subject}}` and `{{staff_name}}` are filled in for the
 * case it is used on. Without a kind, it is offered on every case.
 */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'case_canned_replies',
    freezeTableName: true,
})
export class CaseCannedReply extends Model<CaseCannedReply> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    @AllowNull(false)
    @Column(DataType.STRING(120))
    declare title: string

    @AllowNull(false)
    @Column(DataType.TEXT)
    declare body: string

    /** Offered on the cases of this kind only; null for all. */
    @AllowNull(true)
    @Column(DataType.STRING(64))
    declare kind: string | null

    @AllowNull(false)
    @Default(true)
    @Column(DataType.BOOLEAN)
    declare active: boolean

    /** How many replies were sent from it: the list puts the most used first. */
    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare used_count: number

    declare created_at: Date
    declare updated_at: Date
}
