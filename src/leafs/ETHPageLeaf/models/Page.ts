import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default } from 'etherial/components/database/provider'

import type { PageBlocks } from '../services/options.js'

/**
 * A page written in the back-office: a title and blocks in each language.
 * The app draws the blocks itself; the same page is also published as HTML in
 * the bucket, for a shared link and for the app's web view.
 */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'content_pages',
    freezeTableName: true,
    // An index, not a unique column: the alter-sync adds a unique constraint again on every boot.
    indexes: [{ unique: true, fields: ['slug'] }, { fields: ['published', 'position'] }],
})
export class Page extends Model<Page> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    /** Its address: `pages/<slug>/<locale>.html` in the bucket, `page:<slug>` in a link. */
    @AllowNull(false)
    @Column(DataType.STRING(80))
    declare slug: string

    /** `{ en, ar }` */
    @AllowNull(false)
    @Default({})
    @Column(DataType.JSONB)
    declare title: Record<string, string>

    /** A line under the title, and in the app's list of pages. `{ en, ar }` */
    @AllowNull(false)
    @Default({})
    @Column(DataType.JSONB)
    declare summary: Record<string, string>

    /** `{ en: [blocks], ar: [blocks] }` */
    @AllowNull(false)
    @Default({})
    @Column(DataType.JSONB)
    declare blocks: PageBlocks

    /** Off: the app no longer sees it, and its HTML leaves the bucket. */
    @AllowNull(false)
    @Default(false)
    @Column(DataType.BOOLEAN)
    declare published: boolean

    /** Listed in the app's menu. Off, it opens only from a link, a push or a banner. */
    @AllowNull(false)
    @Default(true)
    @Column(DataType.BOOLEAN)
    declare in_menu: boolean

    /**
     * The collection of the record the page is the content of (a news): it is
     * written in that record's form and deleted with it, never in the menu nor
     * in the back-office's Pages. Null: a page of its own.
     */
    @AllowNull(true)
    @Column(DataType.STRING(80))
    declare owner: string | null

    /** Its place in the app's menu, the smallest first. */
    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare position: number

    /** The HTML in the bucket, per language: `{ en: 'https://…/pages/<slug>/en.html' }`. Written by the leaf. */
    @AllowNull(false)
    @Default({})
    @Column(DataType.JSONB)
    declare html: Record<string, string>

    /** The address the HTML is under in the bucket, to take it down when the page moves or goes. */
    @AllowNull(true)
    @Column(DataType.STRING(80))
    declare published_slug: string | null

    @AllowNull(true)
    @Column(DataType.DATE)
    declare published_at: Date | null

    /**
     * The key of its preview link (`/pages/preview/<key>`): whoever has the
     * link sees the page as last saved, a draft too. Null: not shared. No
     * index: the plain sync that runs before the alter-sync would build it
     * on a column not added yet, and the boot fails.
     */
    @AllowNull(true)
    @Column(DataType.STRING(48))
    declare preview_key: string | null

    declare created_at: Date
    declare updated_at: Date
}
