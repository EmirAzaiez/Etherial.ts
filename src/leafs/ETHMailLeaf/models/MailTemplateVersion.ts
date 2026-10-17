import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType } from 'etherial/components/database/provider'

/**
 * Every save of an email in the back-office, and every reset to the code's
 * version: what the email said, who changed it, when. Read by the editor's
 * history, which can bring an old version back.
 */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    tableName: 'mail_template_versions',
    freezeTableName: true,
    indexes: [{ fields: ['key', 'locale', 'id'] }],
})
export class MailTemplateVersion extends Model<MailTemplateVersion> {
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

    /** `save`: this content went out from then on. `reset`: back to the code's version (no content). */
    @AllowNull(false)
    @Column(DataType.STRING(16))
    declare action: 'save' | 'reset'

    @AllowNull(true)
    @Column(DataType.TEXT)
    declare subject: string | null

    @AllowNull(true)
    @Column(DataType.TEXT)
    declare preheader: string | null

    @AllowNull(true)
    @Column(DataType.JSON)
    declare blocks: any[] | null

    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare created_by: number | null

    /** The version this save brought back, when it came from the history. */
    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare restored_from: number | null

    declare created_at: Date
}
