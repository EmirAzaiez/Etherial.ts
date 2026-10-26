import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default, HasMany, BeforeSave } from 'etherial/components/database/provider'

import { AUDIENCES, Audience, ContentError } from '../services/options.js'
import { cleanTexts, requiredLabel } from '../services/texts.js'
import { StorySlide } from './StorySlide.js'

/**
 * A bubble of the home screen and the full-screen slides behind it.
 * `cover` is the project's media row (an association the leaf adds at boot).
 */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'content_stories',
    freezeTableName: true,
    indexes: [{ fields: ['published', 'position'] }],
})
export class Story extends Model<Story> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    /** `{ en, ar }`, under the bubble. */
    @AllowNull(false)
    @Default({})
    @Column(DataType.JSONB)
    declare title: Record<string, string>

    /** The title in the default language: the back-office's lists and search. Written by the leaf. */
    @AllowNull(false)
    @Default('')
    @Column(DataType.STRING(200))
    declare label: string

    /** The bubble's picture. Empty: the first slide's. */
    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare cover_id: number | null

    declare cover?: any

    @AllowNull(false)
    @Default('everyone')
    @Column(DataType.STRING(20))
    declare audience: Audience

    @AllowNull(true)
    @Column(DataType.DATE)
    declare starts_at: Date | null

    @AllowNull(true)
    @Column(DataType.DATE)
    declare ends_at: Date | null

    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare position: number

    /** Off: a draft, the app doesn't see it. */
    @AllowNull(false)
    @Default(false)
    @Column(DataType.BOOLEAN)
    declare published: boolean

    /** Its first publication: the app marks a story it hasn't opened since as new. */
    @AllowNull(true)
    @Column(DataType.DATE)
    declare published_at: Date | null

    @HasMany(() => StorySlide, { foreignKey: 'story_id', onDelete: 'CASCADE' })
    declare slides: StorySlide[]

    declare created_at: Date
    declare updated_at: Date

    @BeforeSave
    static check(story: Story) {
        story.title = cleanTexts(story.title)
        story.label = requiredLabel(story.title, 'Title')
        if (!AUDIENCES.includes(story.audience)) throw new ContentError(`Audience: one of ${AUDIENCES.join(', ')}.`)
        if (story.starts_at && story.ends_at && new Date(story.ends_at) <= new Date(story.starts_at)) {
            throw new ContentError('The end must come after the start.')
        }
        if (story.published && !story.published_at) story.published_at = new Date()
    }
}
