import { Table, Column, Model, AllowNull, PrimaryKey, DataType, Default } from 'etherial/components/database/provider'

import type { PageFonts } from '../services/fonts.js'

/**
 * What the back-office sets for every page at once: their fonts. One row,
 * id 1; a font left out is the theme's.
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

    declare created_at: Date
    declare updated_at: Date
}
