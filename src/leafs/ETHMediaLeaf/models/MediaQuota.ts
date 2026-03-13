import {
    Table,
    Column,
    Model,
    AllowNull,
    PrimaryKey,
    AutoIncrement,
    Default,
    CreatedAt,
    UpdatedAt,
    Unique,
    DataType,
} from '../../../components/database/provider'

export class BaseMediaQuota extends Model<BaseMediaQuota> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column
    declare id: number

    @Unique
    @AllowNull(false)
    @Column
    declare user_id: number

    /**
     * Total storage used in bytes
     */
    @AllowNull(false)
    @Default(0)
    @Column(DataType.BIGINT)
    declare storage_used: number

    /**
     * Number of files uploaded
     */
    @AllowNull(false)
    @Default(0)
    @Column
    declare file_count: number

    /**
     * Custom quota limit for this user (overrides global)
     * null = use global quota
     */
    @AllowNull(true)
    @Column(DataType.BIGINT)
    declare custom_quota: number | null

    @CreatedAt
    declare created_at: Date

    @UpdatedAt
    declare updated_at: Date

    /**
     * Get human readable storage used
     */
    getStorageUsedHuman(): string {
        return this.formatBytes(this.storage_used)
    }

    /**
     * Get human readable quota limit
     */
    getQuotaLimitHuman(globalQuota: number): string {
        const limit = this.custom_quota ?? globalQuota
        return this.formatBytes(limit)
    }

    /**
     * Check if user has exceeded quota
     */
    hasExceededQuota(globalQuota: number): boolean {
        const limit = this.custom_quota ?? globalQuota
        return this.storage_used >= limit
    }

    /**
     * Check if adding a file would exceed quota
     */
    wouldExceedQuota(fileSize: number, globalQuota: number): boolean {
        const limit = this.custom_quota ?? globalQuota
        return (this.storage_used + fileSize) > limit
    }

    /**
     * Get remaining storage in bytes
     */
    getRemainingStorage(globalQuota: number): number {
        const limit = this.custom_quota ?? globalQuota
        return Math.max(0, limit - this.storage_used)
    }

    /**
     * Get usage percentage (0-100)
     */
    getUsagePercentage(globalQuota: number): number {
        const limit = this.custom_quota ?? globalQuota
        if (limit === 0) return 100
        return Math.min(100, Math.round((this.storage_used / limit) * 100))
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    /**
     * Increment storage usage
     */
    async addUsage(fileSize: number): Promise<void> {
        this.storage_used = Number(this.storage_used) + fileSize
        this.file_count = this.file_count + 1
        await this.save()
    }

    /**
     * Decrement storage usage
     */
    async removeUsage(fileSize: number): Promise<void> {
        this.storage_used = Math.max(0, Number(this.storage_used) - fileSize)
        this.file_count = Math.max(0, this.file_count - 1)
        await this.save()
    }
}
