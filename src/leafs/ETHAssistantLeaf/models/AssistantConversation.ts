import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType } from 'etherial/components/database/provider'

/**
 * One person's conversation with the assistant, kept to be reopened from the
 * panel and carried on. Only with the leaf's `history` on: unlike the log, it
 * holds the answers, which are made of the project's data.
 *
 * The turns are kept as the panel shows them — the question, the page it was
 * asked from, the answer, its look-ups, the changes it proposed and what the
 * person decided — in one JSON column: they are only ever read back whole,
 * by their owner.
 */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'assistant_conversations',
    freezeTableName: true,
    indexes: [{ fields: ['user_id', 'updated_at'] }, { fields: ['updated_at'] }],
})
export class AssistantConversation extends Model<AssistantConversation> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    @AllowNull(false)
    @Column(DataType.INTEGER)
    declare user_id: number

    /** The first question, until the person renames it. */
    @AllowNull(false)
    @Column(DataType.STRING(200))
    declare title: string

    /**
     * `[{ id, task, prompt, context, where, answer, proposals, at }]`, oldest
     * first. No column default (MySQL takes none on JSON): always written.
     */
    @AllowNull(false)
    @Column(DataType.JSON)
    declare turns: any[]

    declare created_at: Date
    declare updated_at: Date
}
