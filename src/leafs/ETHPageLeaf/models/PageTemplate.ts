import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default } from 'etherial/components/database/provider'

import type { PageBlocks } from '../services/options.js'

/**
 * Blocks saved from the back-office's editor to start another page from:
 * a layout the team likes (a hero, the hours, the contact) kept with its
 * words and images. Read as drafts: a template may hold an unfinished block.
 */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'content_page_templates',
    freezeTableName: true,
})
export class PageTemplate extends Model<PageTemplate> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    @AllowNull(false)
    @Column(DataType.STRING(120))
    declare name: string

    /** `{ en: [blocks], ar: [blocks] }` */
    @AllowNull(false)
    @Default({})
    @Column(DataType.JSONB)
    declare blocks: PageBlocks

    declare created_at: Date
    declare updated_at: Date
}
