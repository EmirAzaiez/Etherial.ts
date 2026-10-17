import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType } from 'etherial/components/database/provider'

/**
 * The leaf's settings that live in the database: the brand as the back-office
 * changed it (`theme`), the secret that signs unsubscribe links.
 */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'mail_settings',
    freezeTableName: true,
})
export class MailSetting extends Model<MailSetting> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    @AllowNull(false)
    @Column({ type: DataType.STRING(64), unique: true })
    declare key: string

    @AllowNull(true)
    @Column(DataType.JSON)
    declare value: any

    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare updated_by: number | null

    declare created_at: Date
    declare updated_at: Date
}
