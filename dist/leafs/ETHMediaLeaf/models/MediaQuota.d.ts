import { Model } from '../../../components/database/provider.js';
export declare class BaseMediaQuota extends Model<BaseMediaQuota> {
    id: number;
    user_id: number;
    /**
     * Total storage used in bytes
     */
    storage_used: number;
    /**
     * Number of files uploaded
     */
    file_count: number;
    /**
     * Custom quota limit for this user (overrides global)
     * null = use global quota
     */
    custom_quota: number | null;
    created_at: Date;
    updated_at: Date;
    /**
     * Get human readable storage used
     */
    getStorageUsedHuman(): string;
    /**
     * Get human readable quota limit
     */
    getQuotaLimitHuman(globalQuota: number): string;
    /**
     * Check if user has exceeded quota
     */
    hasExceededQuota(globalQuota: number): boolean;
    /**
     * Check if adding a file would exceed quota
     */
    wouldExceedQuota(fileSize: number, globalQuota: number): boolean;
    /**
     * Get remaining storage in bytes
     */
    getRemainingStorage(globalQuota: number): number;
    /**
     * Get usage percentage (0-100)
     */
    getUsagePercentage(globalQuota: number): number;
    private formatBytes;
    /**
     * Increment storage usage
     */
    addUsage(fileSize: number): Promise<void>;
    /**
     * Decrement storage usage
     */
    removeUsage(fileSize: number): Promise<void>;
}
