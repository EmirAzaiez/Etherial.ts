import {
    Table,
    Column,
    Model,
    AllowNull,
    PrimaryKey,
    AutoIncrement,
    CreatedAt,
    UpdatedAt,
    DataType,
    ForeignKey,
    BelongsTo,
    Default,
    Index,
} from 'etherial/components/database/provider'

import { User } from '../../models/User'

export enum MediaStatus {
    PENDING = 'pending',
    UPLOADED = 'uploaded',
}

@Table({
    timestamps: true,
    tableName: 'medias',
    freezeTableName: true,
})
export class Media extends Model<Media> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column
    id: number

    @AllowNull(false)
    @Index
    @Column
    key: string

    @AllowNull(false)
    @Column
    real_name: string

    @AllowNull(true)
    @Column
    folder: string

    @AllowNull(false)
    @Column
    name: string

    @AllowNull(false)
    @Column
    mime_type: string

    @AllowNull(false)
    @Column(DataType.BIGINT)
    file_size: number

    @AllowNull(true)
    @Column
    file_extension: string

    @AllowNull(true)
    @Column
    signed_url: string

    @AllowNull(true)
    @Column(DataType.JSON)
    metadata: Record<string, any>

    @AllowNull(false)
    @Column
    visibility: 'public-read' | 'private'

    @AllowNull(false)
    @Default(false)
    @Column
    status: MediaStatus

    @AllowNull(true)
    @Column
    expires_at: Date

    @ForeignKey(() => User)
    @AllowNull(false)
    @Column
    uploaded_by: number

    @BelongsTo(() => User, 'uploaded_by')
    uploader: User

    @AllowNull(true)
    @Column
    deleted_at: Date

    @CreatedAt
    created_at: Date

    @UpdatedAt
    updated_at: Date

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
}
