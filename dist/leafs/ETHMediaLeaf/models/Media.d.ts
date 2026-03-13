import { Model } from '../../../components/database/provider.js';
export declare enum MediaStatus {
    PENDING = "pending",
    UPLOADED = "uploaded"
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
export declare class BaseMedia extends Model<BaseMedia> {
    id: number;
    key: string;
    real_name: string;
    folder: string;
    name: string;
    mime_type: string;
    file_size: number;
    file_extension: string;
    signed_url: string;
    metadata: Record<string, any>;
    visibility: 'public-read' | 'private';
    status: MediaStatus;
    expires_at: Date;
    uploaded_by: number;
    deleted_at: Date;
    created_at: Date;
    updated_at: Date;
    getFileExtension(): string;
    getHumanReadableSize(): string;
    /**
     * Check if media is an image
     */
    isImage(): boolean;
    /**
     * Check if media is a video
     */
    isVideo(): boolean;
    /**
     * Check if media is audio
     */
    isAudio(): boolean;
    /**
     * Check if media is a document (PDF, DOC, etc.)
     */
    isDocument(): boolean;
    /**
     * Find all models that reference Media via BelongsTo associations
     * Scans all registered Sequelize models automatically
     *
     * @returns Array of { model, field, modelName } for each reference found
     */
    static findAllReferences(): {
        model: any;
        field: string;
        modelName: string;
    }[];
    /**
     * Find all orphan medias (confirmed but not referenced by any model)
     *
     * @param limit Max number of orphans to return (default: 100)
     * @returns Array of orphan Media records
     */
    static findOrphans(limit?: number): Promise<BaseMedia[]>;
}
export { BaseMedia as Media };
