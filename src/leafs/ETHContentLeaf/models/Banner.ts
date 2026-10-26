import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default, BeforeSave } from 'etherial/components/database/provider'

import { AUDIENCES, Audience, ContentError, labelOf } from '../services/options.js'
import { languages } from '../services/state.js'
import { cleanTexts, orNull } from '../services/texts.js'

/**
 * A slide of the home screen's carousel: an image, words on it if need be,
 * and where a tap goes. `image` is the project's media row (an association
 * the leaf adds at boot).
 */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'content_banners',
    freezeTableName: true,
    indexes: [{ fields: ['published', 'position'] }],
})
export class Banner extends Model<Banner> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

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
    declare subtitle: Record<string, string>

    /** The button's words, `{ en: 'Discover' }`. Empty: the whole banner is the link. */
    @AllowNull(false)
    @Default({})
    @Column(DataType.JSONB)
    declare button: Record<string, string>

    /** `https://…`, or a link of the app's own (its routes). Empty: nothing opens. */
    @AllowNull(true)
    @Column(DataType.STRING(500))
    declare link: string | null

    /** The title in the default language: the back-office's lists and search. Written by the leaf. */
    @AllowNull(false)
    @Default('')
    @Column(DataType.STRING(200))
    declare label: string

    @AllowNull(false)
    @Default('everyone')
    @Column(DataType.STRING(20))
    declare audience: Audience

    /** Shown from then. Empty: as soon as it is published. */
    @AllowNull(true)
    @Column(DataType.DATE)
    declare starts_at: Date | null

    /** Hidden from then. Empty: until it is unpublished. */
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

    declare created_at: Date
    declare updated_at: Date

    @BeforeSave
    static check(banner: Banner) {
        banner.title = cleanTexts(banner.title)
        banner.subtitle = cleanTexts(banner.subtitle)
        banner.button = cleanTexts(banner.button)
        banner.label = labelOf(banner.title, languages().default)
        banner.link = orNull(banner.link)
        if (!AUDIENCES.includes(banner.audience)) throw new ContentError(`Audience: one of ${AUDIENCES.join(', ')}.`)
        if (banner.starts_at && banner.ends_at && new Date(banner.ends_at) <= new Date(banner.starts_at)) {
            throw new ContentError('The end must come after the start.')
        }
    }
}
