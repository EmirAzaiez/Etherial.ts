import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType } from 'etherial/components/database/provider'

/**
 * An address that asked for no more campaigns. Campaigns skip it; the
 * emails a person needs (a sign-in code, an appointment) still go out.
 */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    tableName: 'mail_unsubscribes',
    freezeTableName: true,
})
export class MailUnsubscribe extends Model<MailUnsubscribe> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    /** Lower case. */
    @AllowNull(false)
    @Column({ type: DataType.STRING(320), unique: true })
    declare email: string

    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare user_id: number | null

    /** The campaign whose link was used. */
    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare campaign_id: number | null

    declare created_at: Date
}
