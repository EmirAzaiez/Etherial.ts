import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default, ForeignKey, BelongsTo, BeforeSave } from 'etherial/components/database/provider'

import { cleanTexts, requiredLabel } from '../services/texts.js'
import { FaqSection } from './FaqSection.js'
// Typed through the type alone: the decorators' metadata would read FaqSection while the two files load each other.
import type { FaqSection as FaqSectionRow } from './FaqSection.js'

/** One question of the FAQ and its answer, written in its section's form. */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'content_faq_questions',
    freezeTableName: true,
    indexes: [{ fields: ['section_id', 'position'] }],
})
export class FaqQuestion extends Model<FaqQuestion> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    @ForeignKey(() => FaqSection)
    @AllowNull(false)
    @Column(DataType.INTEGER)
    declare section_id: number

    @BelongsTo(() => FaqSection, { foreignKey: 'section_id', onDelete: 'CASCADE' })
    declare section: FaqSectionRow

    /** `{ en, ar }` */
    @AllowNull(false)
    @Default({})
    @Column(DataType.JSONB)
    declare question: Record<string, string>

    /** `{ en, ar }`, plain paragraphs with a blank line between two. */
    @AllowNull(false)
    @Default({})
    @Column(DataType.JSONB)
    declare answer: Record<string, string>

    /** The question in the default language: its card's title in the section's form. Written by the leaf. */
    @AllowNull(false)
    @Default('')
    @Column(DataType.STRING(200))
    declare label: string

    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare position: number

    /** Off: hidden in the app. */
    @AllowNull(false)
    @Default(true)
    @Column(DataType.BOOLEAN)
    declare published: boolean

    declare created_at: Date
    declare updated_at: Date

    @BeforeSave
    static fillLabel(question: FaqQuestion) {
        question.question = cleanTexts(question.question)
        question.answer = cleanTexts(question.answer)
        question.label = requiredLabel(question.question, 'Question')
        requiredLabel(question.answer, `"${question.label}"'s answer`)
    }
}
