import {
    Column,
    Model,
    AllowNull,
    PrimaryKey,
    AutoIncrement,
    CreatedAt,
    UpdatedAt,
    DataType,
    Default,
} from '../../../components/database/provider.js'
import { Op } from 'sequelize'

/** Lists of media ids kept where no column points to them (JSON). */
const mediaReferenceLists: (() => Promise<Iterable<number | string>>)[] = []

/**
 * Tells the orphan cleanup about media ids no column holds: photos listed in
 * a JSON column, say. Without it, `cleanup:orphans` deletes them.
 *
 *     registerMediaReferences(async () => (await Case.findAll({ attributes: ['attachments'] })).flatMap((c) => c.attachments.map((a) => a.id)))
 */
export function registerMediaReferences(list: () => Promise<Iterable<number | string>>): void {
    mediaReferenceLists.push(list)
}

export enum MediaStatus {
    PENDING = 'pending',
    UPLOADED = 'uploaded',
}

/**
 * BaseMedia - Base class for Media model
 *
 * This class should be extended in your project to add:
 * - @Table decorator with table name
 * - @ForeignKey and @BelongsTo for User relationship
 *
 * @example
 * ```typescript
 * import { Table, ForeignKey, BelongsTo, Column, AllowNull } from 'etherial/components/database/provider'
 * import { BaseMedia } from '../ETHMediaLeaf/models/Media.js'
 * import { User } from './User.js'
 *
 * @Table({ tableName: 'medias', freezeTableName: true })
 * export class Media extends BaseMedia {
 *     @ForeignKey(() => User)
 *     @AllowNull(false)
 *     @Column
 *     declare uploaded_by: number
 *
 *     @BelongsTo(() => User, 'uploaded_by')
 *     declare uploader: User
 * }
 * ```
 */
export class BaseMedia extends Model<BaseMedia> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column
    declare id: number

    @AllowNull(false)
    @Column
    declare key: string

    @AllowNull(false)
    @Column
    declare real_name: string

    @AllowNull(true)
    @Column
    declare folder: string

    @AllowNull(false)
    @Column
    declare name: string

    @AllowNull(false)
    @Column
    declare mime_type: string

    @AllowNull(false)
    @Column(DataType.BIGINT)
    declare file_size: number

    @AllowNull(true)
    @Column
    declare file_extension: string

    @AllowNull(true)
    @Column
    declare signed_url: string

    @AllowNull(true)
    @Column(DataType.JSON)
    declare metadata: Record<string, any>

    @AllowNull(false)
    @Column
    declare visibility: 'public-read' | 'private'

    @AllowNull(false)
    @Default(MediaStatus.PENDING)
    @Column
    declare status: MediaStatus

    @AllowNull(true)
    @Column
    declare expires_at: Date

    // uploaded_by will be defined in the extending class with @ForeignKey
    declare uploaded_by: number

    @AllowNull(true)
    @Column
    declare deleted_at: Date

    @CreatedAt
    declare created_at: Date

    @UpdatedAt
    declare updated_at: Date

    getFileExtension(): string {
        if (this.file_extension) {
            return this.file_extension
        }

        const parts = this.real_name.split('.')
        return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
    }

    getHumanReadableSize(): string {
        const units = ['B', 'KB', 'MB', 'GB', 'TB']
        let size = this.file_size
        let unitIndex = 0

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024
            unitIndex++
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`
    }

    /**
     * Check if media is an image
     */
    isImage(): boolean {
        return this.mime_type.startsWith('image/')
    }

    /**
     * Check if media is a video
     */
    isVideo(): boolean {
        return this.mime_type.startsWith('video/')
    }

    /**
     * Check if media is audio
     */
    isAudio(): boolean {
        return this.mime_type.startsWith('audio/')
    }

    /**
     * Check if media is a document (PDF, DOC, etc.)
     */
    isDocument(): boolean {
        const docTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]
        return docTypes.includes(this.mime_type)
    }

    /**
     * Every column holding a media id: the `@BelongsTo(() => Media)` of the
     * registered models, and the join tables of their `@BelongsToMany`.
     *
     * @returns Array of { model, field, modelName } for each reference found
     */
    static findAllReferences(): { model: any; field: string; modelName: string }[] {
        const references: { model: any; field: string; modelName: string }[] = []
        const sequelize = (this as any).sequelize

        if (!sequelize) return references
        const table = (this as any).tableName ?? 'medias'

        for (const [modelName, model] of Object.entries(sequelize.models) as [string, any][]) {
            if (!model.associations) continue

            for (const assoc of Object.values(model.associations) as any[]) {
                if (assoc.target?.tableName !== table) continue
                if (assoc.associationType === 'BelongsTo') {
                    references.push({ model, field: assoc.foreignKey, modelName })
                } else if (assoc.associationType === 'BelongsToMany' && assoc.through?.model) {
                    references.push({ model: assoc.through.model, field: assoc.otherKey, modelName: `${modelName} (${assoc.through.model.name})` })
                }
            }
        }

        return references
    }

    /**
     * Uploaded medias nothing points to: no column found by
     * `findAllReferences`, nor any id the project lists through
     * `registerMediaReferences` (ids kept in JSON). Only those uploaded more
     * than `olderThanMs` ago (default a day): a form may still be about to
     * save the one just uploaded.
     *
     * A reference that can't be read stops the search: deleting on a partial
     * list would remove files in use.
     *
     * @param limit Max number of orphans to return (default: 100)
     * @returns Array of orphan Media records
     */
    static async findOrphans(limit: number = 100, options: { olderThanMs?: number } = {}): Promise<BaseMedia[]> {
        const references = this.findAllReferences()
        const cutoff = new Date(Date.now() - (options.olderThanMs ?? 24 * 60 * 60 * 1000))

        const allMedias = await this.findAll({
            where: { status: MediaStatus.UPLOADED, created_at: { [Op.lt]: cutoff } } as any,
            attributes: ['id'],
            raw: true,
        })

        if (allMedias.length === 0) return []

        const usedMediaIds = new Set<number>()

        for (const ref of references) {
            const records = await ref.model.findAll({
                where: { [ref.field]: { [Op.ne]: null } },
                attributes: [ref.field],
                raw: true,
            })
            for (const record of records) {
                if (record[ref.field]) usedMediaIds.add(Number(record[ref.field]))
            }
        }
        for (const list of mediaReferenceLists) {
            for (const id of await list()) usedMediaIds.add(Number(id))
        }

        const orphanIds = allMedias
            .filter(m => !usedMediaIds.has(Number(m.id)))
            .map(m => m.id)
            .slice(0, limit)

        if (orphanIds.length === 0) return []

        return await this.findAll({
            where: { id: { [Op.in]: orphanIds } },
        })
    }
}

// For backwards compatibility, also export as Media
// Projects should import from their own src/models/Media.ts instead
export { BaseMedia as Media }
