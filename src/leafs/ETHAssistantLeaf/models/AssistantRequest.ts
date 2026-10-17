import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default } from 'etherial/components/database/provider'

/**
 * One question put to the assistant: who asked, what, what it read to answer,
 * and what it cost. The answer itself is not kept — it is made of the
 * project's data, which already lives where it belongs.
 */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'assistant_requests',
    freezeTableName: true,
    indexes: [{ fields: ['user_id', 'created_at'] }, { fields: ['created_at'] }],
})
export class AssistantRequest extends Model<AssistantRequest> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    @AllowNull(false)
    @Column(DataType.INTEGER)
    declare user_id: number

    /** ask, summarize, draft. */
    @AllowNull(false)
    @Column(DataType.STRING(16))
    declare task: string

    /** The last thing the person typed, or what they asked for on a record. */
    @AllowNull(true)
    @Column(DataType.TEXT)
    declare question: string | null

    /** The page they were on: a collection, and a record of it. */
    @AllowNull(true)
    @Column(DataType.STRING(64))
    declare collection: string | null

    @AllowNull(true)
    @Column(DataType.STRING(64))
    declare record_id: string | null

    /** The collections it read to answer, comma separated. */
    @AllowNull(true)
    @Column(DataType.STRING(512))
    declare collections_read: string | null

    /** How many look-ups it made. */
    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare steps: number

    @AllowNull(true)
    @Column(DataType.STRING(64))
    declare model: string | null

    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare input_tokens: number

    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare output_tokens: number

    /** Input read back from the prompt cache, billed at a tenth. */
    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare cached_tokens: number

    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare duration_ms: number

    /** ok, failed. */
    @AllowNull(false)
    @Default('ok')
    @Column(DataType.STRING(16))
    declare status: string

    @AllowNull(true)
    @Column(DataType.STRING(255))
    declare error: string | null

    declare created_at: Date
    declare updated_at: Date
}
