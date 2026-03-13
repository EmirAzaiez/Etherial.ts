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
} from '../../../components/database/provider'

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
 * import { BaseMedia } from '../ETHMediaLeaf/models/Media'
 * import { User } from './User'
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
     * Find all models that reference Media via BelongsTo associations
     * Scans all registered Sequelize models automatically
     *
     * @returns Array of { model, field, modelName } for each reference found
     */
    static findAllReferences(): { model: any; field: string; modelName: string }[] {
        const references: { model: any; field: string; modelName: string }[] = []
        const sequelize = (this as any).sequelize

        if (!sequelize) return references

        for (const [modelName, model] of Object.entries(sequelize.models) as [string, any][]) {
            if (!model.associations) continue

            for (const assoc of Object.values(model.associations) as any[]) {
                // Check if this is a BelongsTo pointing to medias table
                if (assoc.associationType === 'BelongsTo' && assoc.target?.tableName === 'medias') {
                    references.push({
                        model,
                        field: assoc.foreignKey,
                        modelName,
                    })
                }
            }
        }

        return references
    }

    /**
     * Find all orphan medias (confirmed but not referenced by any model)
     *
     * @param limit Max number of orphans to return (default: 100)
     * @returns Array of orphan Media records
     */
    static async findOrphans(limit: number = 100): Promise<BaseMedia[]> {
        const { Op } = require('sequelize')
        const references = this.findAllReferences()

        // Get all confirmed media IDs
        const allMedias = await this.findAll({
            where: { status: 'confirmed' },
            attributes: ['id'],
            raw: true,
        })

        if (allMedias.length === 0) return []

        // Collect all used media IDs
        const usedMediaIds = new Set<number>()

        for (const ref of references) {
            try {
                const records = await ref.model.findAll({
                    where: { [ref.field]: { [Op.ne]: null } },
                    attributes: [ref.field],
                    raw: true,
                })
                for (const record of records) {
                    if (record[ref.field]) {
                        usedMediaIds.add(record[ref.field])
                    }
                }
            } catch (err) {
                // Skip models that fail (e.g., table doesn't exist yet)
            }
        }

        // Find orphan IDs
        const orphanIds = allMedias
            .filter(m => !usedMediaIds.has(m.id))
            .map(m => m.id)
            .slice(0, limit)

        if (orphanIds.length === 0) return []

        // Return full Media records
        return await this.findAll({
            where: { id: { [Op.in]: orphanIds } },
        })
    }
}

// For backwards compatibility, also export as Media
// Projects should import from their own src/models/Media.ts instead
export { BaseMedia as Media }
