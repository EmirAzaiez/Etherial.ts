import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default, BeforeSave, BeforeValidate } from 'etherial/components/database/provider'

import { ContentError, slugify } from '../services/options.js'
import { cleanTexts, orNull, ownText, requiredLabel } from '../services/texts.js'

/**
 * A text the app must show as written: the terms of use, the privacy
 * policy… Its text (HTML), or a page of the project's website to open.
 */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'content_legal_documents',
    freezeTableName: true,
    // An index, not a unique column: the alter-sync adds a unique constraint again on every boot.
    indexes: [{ name: 'content_legal_documents_slug_unique', unique: true, fields: ['slug'] }],
})
export class LegalDocument extends Model<LegalDocument> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    /** What the app asks for: `terms`, `privacy`. Left empty, made from the title. */
    @AllowNull(false)
    @Default('')
    @Column(DataType.STRING(80))
    declare slug: string

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

    /** `{ en: '<p>…</p>', ar: '…' }`: HTML, from the back-office's editor. */
    @AllowNull(false)
    @Default({})
    @Column(DataType.JSONB)
    declare body: Record<string, string>

    /** `{ en: 'https://…/privacy' }`: a page of the website, which the app opens instead of the text. */
    @AllowNull(false)
    @Default({})
    @Column(DataType.JSONB)
    declare url: Record<string, string>

    /** `2026-10`, `v3`: what the app shows under the title. */
    @AllowNull(true)
    @Column(DataType.STRING(40))
    declare version: string | null

    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare position: number

    /** Off: a draft, the app doesn't see it. */
    @AllowNull(false)
    @Default(false)
    @Column(DataType.BOOLEAN)
    declare published: boolean

    @AllowNull(true)
    @Column(DataType.DATE)
    declare published_at: Date | null

    declare created_at: Date
    declare updated_at: Date

    /** Sequelize checks NOT NULL before `check` runs: an address left empty waits for it as ''. */
    @BeforeValidate
    static emptySlug(doc: LegalDocument) {
        if (doc.slug == null) doc.slug = ''
    }

    @BeforeSave
    static check(doc: LegalDocument) {
        doc.title = cleanTexts(doc.title)
        doc.body = cleanTexts(doc.body)
        doc.url = cleanTexts(doc.url)
        doc.label = requiredLabel(doc.title, 'Title')
        doc.slug = slugify(String(doc.slug ?? '').trim() || doc.label)
        if (!doc.slug) throw new ContentError('Address: letters, digits and dashes (privacy-policy).')
        doc.version = orNull(doc.version)
        if (doc.published && !ownText(doc.body) && !ownText(doc.url)) {
            throw new ContentError('Write the text, or give the address of a page of your website, before publishing.')
        }
        if (doc.published && !doc.published_at) doc.published_at = new Date()
    }
}
