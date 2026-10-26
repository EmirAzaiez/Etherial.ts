import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default, ForeignKey, BelongsTo, BeforeSave } from 'etherial/components/database/provider'

import { labelOf } from '../services/options.js'
import { languages } from '../services/state.js'
import { cleanTexts, orNull } from '../services/texts.js'
import { Story } from './Story.js'
// Typed through the type alone: the decorators' metadata would read Story while the two files load each other.
import type { Story as StoryRow } from './Story.js'

/** One full-screen slide of a story, written in the story's form. `image` is the project's media row. */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'content_story_slides',
    freezeTableName: true,
    indexes: [{ fields: ['story_id', 'position'] }],
})
export class StorySlide extends Model<StorySlide> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    @ForeignKey(() => Story)
    @AllowNull(false)
    @Column(DataType.INTEGER)
    declare story_id: number

    @BelongsTo(() => Story, { foreignKey: 'story_id', onDelete: 'CASCADE' })
    declare story: StoryRow

    @AllowNull(false)
    @Column(DataType.INTEGER)
    declare image_id: number

    declare image?: any

    /** `{ en, ar }`, on the image. Empty: the image alone. */
    @AllowNull(false)
    @Default({})
    @Column(DataType.JSONB)
    declare title: Record<string, string>

    @AllowNull(false)
    @Default({})
    @Column(DataType.JSONB)
    declare text: Record<string, string>

    /** The button's words, `{ en: 'Learn more' }`. Needs a link. */
    @AllowNull(false)
    @Default({})
    @Column(DataType.JSONB)
    declare button: Record<string, string>

    /** `https://…`, or a link of the app's own. */
    @AllowNull(true)
    @Column(DataType.STRING(500))
    declare link: string | null

    /** How long it stays before the next one, in seconds. */
    @AllowNull(false)
    @Default(5)
    @Column(DataType.INTEGER)
    declare duration: number

    /** The title in the default language: its card's title in the story's form. Written by the leaf. */
    @AllowNull(false)
    @Default('')
    @Column(DataType.STRING(200))
    declare label: string

    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare position: number

    declare created_at: Date
    declare updated_at: Date

    @BeforeSave
    static check(slide: StorySlide) {
        slide.title = cleanTexts(slide.title)
        slide.text = cleanTexts(slide.text)
        slide.button = cleanTexts(slide.button)
        slide.label = labelOf(slide.title, languages().default)
        slide.link = orNull(slide.link)
        slide.duration = Math.min(Math.max(Math.round(Number(slide.duration) || 5), 2), 30)
    }
}
