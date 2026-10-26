import { Op } from 'sequelize'
import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default, BeforeSave } from 'etherial/components/database/provider'

import { ContentError, PLATFORMS, PLATFORM_NAMES, PROMPTS, Platform, Prompt, parseVersion } from '../services/options.js'
import { cleanTexts } from '../services/texts.js'

/**
 * A version of the app out on a store, and what an older app does: nothing,
 * a banner that asks to update, or a block until it is updated (`prompt`).
 * Published once it is on the store: before, its button would lead to the
 * version before.
 */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'content_app_releases',
    freezeTableName: true,
    // An index, not unique columns: the alter-sync adds a unique constraint again on every boot.
    indexes: [{ name: 'content_app_releases_platform_version_unique', unique: true, fields: ['platform', 'version'] }],
})
export class AppRelease extends Model<AppRelease> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    /** `ios`, `android`. */
    @AllowNull(false)
    @Column(DataType.STRING(10))
    declare platform: Platform

    /** `2.0.0`, as on the store. */
    @AllowNull(false)
    @Column(DataType.STRING(20))
    declare version: string

    /** `iOS 2.0.0`, for the back-office. */
    @AllowNull(false)
    @Default('')
    @Column(DataType.STRING(40))
    declare label: string

    /** `auto`, `banner`, `required` (PROMPTS). */
    @AllowNull(false)
    @Default('auto')
    @Column(DataType.STRING(10))
    declare prompt: Prompt

    /** The banner's or the block's title. Empty: the leaf's, in the app's language. */
    @AllowNull(false)
    @Default({})
    @Column(DataType.JSONB)
    declare title: Record<string, string>

    @AllowNull(false)
    @Default({})
    @Column(DataType.JSONB)
    declare message: Record<string, string>

    @AllowNull(false)
    @Default(false)
    @Column(DataType.BOOLEAN)
    declare published: boolean

    @AllowNull(true)
    @Column(DataType.DATE)
    declare published_at: Date | null

    declare created_at: Date
    declare updated_at: Date

    @BeforeSave
    static async check(release: AppRelease) {
        if (!PLATFORMS.includes(release.platform)) throw new ContentError(`Platform: one of ${PLATFORMS.join(', ')}.`)
        release.version = String(release.version ?? '').trim()
        if (!parseVersion(release.version)) throw new ContentError('Version: numbers between dots, as on the store (2.0.0).')
        if (!PROMPTS.includes(release.prompt)) throw new ContentError(`Prompt: one of ${PROMPTS.join(', ')}.`)
        release.title = cleanTexts(release.title)
        release.message = cleanTexts(release.message)
        release.label = `${PLATFORM_NAMES[release.platform]} ${release.version}`
        const twin = await AppRelease.findOne({
            where: { platform: release.platform, version: release.version, ...(release.id ? { id: { [Op.ne]: release.id } } : {}) },
            attributes: ['id'],
        })
        if (twin) throw new ContentError(`${release.label} is already listed.`)
        if (release.published && !release.published_at) release.published_at = new Date()
    }
}
