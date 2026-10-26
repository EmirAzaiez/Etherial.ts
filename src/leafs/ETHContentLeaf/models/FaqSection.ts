import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default, HasMany, BeforeSave } from 'etherial/components/database/provider'

import { cleanTexts, requiredLabel } from '../services/texts.js'
import { FaqQuestion } from './FaqQuestion.js'

/** A heading of the FAQ (General, Payments…) and its questions. The same FAQ for everyone. */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'content_faq_sections',
    freezeTableName: true,
    indexes: [{ fields: ['published', 'position'] }],
})
export class FaqSection extends Model<FaqSection> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    /** `{ en, ar }` */
    @AllowNull(false)
    @Default({})
    @Column(DataType.JSONB)
    declare title: Record<string, string>

    /** The title in the default language: the back-office's lists and search. Written by the leaf. */
    @AllowNull(false)
    @Default('')
    @Column(DataType.STRING(200))
    declare label: string

    /** Its place in the FAQ, the smallest first. */
    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare position: number

    /** Off: hidden in the app, with its questions. */
    @AllowNull(false)
    @Default(true)
    @Column(DataType.BOOLEAN)
    declare published: boolean

    @HasMany(() => FaqQuestion, { foreignKey: 'section_id', onDelete: 'CASCADE' })
    declare questions: FaqQuestion[]

    declare created_at: Date
    declare updated_at: Date

    @BeforeSave
    static fillLabel(section: FaqSection) {
        section.title = cleanTexts(section.title)
        section.label = requiredLabel(section.title, 'Title')
    }
}
