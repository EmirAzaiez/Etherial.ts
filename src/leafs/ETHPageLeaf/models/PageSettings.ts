import { Table, Column, Model, AllowNull, PrimaryKey, DataType, Default } from 'etherial/components/database/provider'

import type { PageFonts } from '../services/fonts.js'
import type { PageHead } from '../services/options.js'

/**
 * What the back-office sets for every page at once: their fonts, how they
 * open. One row, id 1; what is left out is the theme's.
 */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'content_page_settings',
    freezeTableName: true,
})
export class PageSettings extends Model<PageSettings> {
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    /** `{ title?: 'noto-naskh-arabic', text?: 'rubik' }` */
    @AllowNull(false)
    @Default({})
    @Column(DataType.JSONB)
    declare fonts: PageFonts

    /** How every page opens (cover, title): `{ align: 'center', upper: true… }`. Null: the theme's. */
    @AllowNull(true)
    @Column(DataType.JSONB)
    declare head: PageHead | null

    /** What the published HTML was last written with (the theme, the way it is drawn): another, and every page is written again. */
    @AllowNull(true)
    @Column(DataType.STRING(64))
    declare look: string | null

    declare created_at: Date
    declare updated_at: Date
}
