import { Model } from '../../../components/database/provider.js';
/**
 * Tells the orphan cleanup about media ids no column holds: photos listed in
 * a JSON column, say. Without it, `cleanup:orphans` deletes them.
 *
 *     registerMediaReferences(async () => (await Case.findAll({ attributes: ['attachments'] })).flatMap((c) => c.attachments.map((a) => a.id)))
 */
export declare function registerMediaReferences(list: () => Promise<Iterable<number | string>>): void;
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
     * Every column holding a media id: the `@BelongsTo(() => Media)` of the
     * registered models, and the join tables of their `@BelongsToMany`.
     *
     * @returns Array of { model, field, modelName } for each reference found
     */
    static findAllReferences(): {
        model: any;
        field: string;
        modelName: string;
    }[];
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
    static findOrphans(limit?: number, options?: {
        olderThanMs?: number;
    }): Promise<BaseMedia[]>;
}
export { BaseMedia as Media };
