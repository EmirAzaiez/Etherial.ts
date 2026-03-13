import { Etherial } from 'etherial';
import { S3Client } from '@aws-sdk/client-s3';
import { Request } from 'etherial/components/http/provider';
import { BaseMedia as Media } from './models/Media.js';
import { BaseMediaQuota as MediaQuota } from './models/MediaQuota.js';
export type MediaAccessChecker = (req: Request & {
    user?: any;
}, media: Media) => boolean | Promise<boolean>;
export interface MediaRule {
    folders: string[];
    visibility: 'public-read' | 'private';
    max_size?: number;
    mime_types?: string[];
    /**
     * Access control callback for private files
     * Called when someone tries to get access to a private file
     *
     * @example
     * canAccess: (req, media) => {
     *     // Owner can access their own files
     *     if (media.uploaded_by === req.user?.id) return true
     *     // Admin can access all files
     *     if (req.user?.role === 'admin') return true
     *     return false
     * }
     */
    canAccess?: MediaAccessChecker;
    /**
     * Signed URL expiration time in seconds (default: 3600 = 1 hour)
     */
    signedUrlExpiration?: number;
    /**
     * Allow image transforms for this folder (default: false)
     */
    allowTransforms?: boolean;
}
export interface QuotaConfig {
    /**
     * Enable quota tracking (default: false)
     */
    enabled: boolean;
    /**
     * Default quota per user in bytes (default: 100MB)
     */
    defaultQuota?: number;
}
export interface TransformConfig {
    /**
     * Enable image transforms (default: false)
     */
    enabled: boolean;
    /**
     * Cache folder in S3 for transformed images (default: '_cache')
     */
    cacheFolder?: string;
    /**
     * Max width allowed (default: 2000)
     */
    maxWidth?: number;
    /**
     * Max height allowed (default: 2000)
     */
    maxHeight?: number;
    /**
     * Default quality for JPEG/WebP (default: 80)
     */
    defaultQuality?: number;
    /**
     * Allowed formats (default: ['jpeg', 'webp', 'png'])
     */
    allowedFormats?: ('jpeg' | 'webp' | 'png' | 'avif')[];
}
export type TransformFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
export interface TransformParams {
    w?: number;
    h?: number;
    fit?: TransformFit;
    format?: 'jpeg' | 'webp' | 'png' | 'avif';
    q?: number;
}
export default class EthMediaLeaf {
    etherial_module_name: string;
    private routes;
    s3: S3Client;
    bucket: string;
    config: ETHMediaLeafConfig;
    constructor(config: ETHMediaLeafConfig);
    beforeRun({ database }: Etherial): void;
    run({ http, database }: Etherial): void;
    /**
     * Get the rule for a specific folder
     */
    getRuleForFolder(folder: string): MediaRule | undefined;
    /**
     * Check if a user can access a specific media file
     * Returns true if access is granted, false otherwise
     */
    checkAccess(req: Request & {
        user?: any;
    }, media: Media): Promise<boolean>;
    /**
     * Generate a signed URL for accessing a private file
     * @param media The media to generate URL for
     * @param expiresIn Expiration time in seconds (default from rule or 3600)
     */
    generateSignedUrl(media: Media, expiresIn?: number): Promise<string>;
    /**
     * Get the public URL for a media file (only for public-read files)
     * Uses CDN URL if configured, otherwise constructs from endpoint
     */
    getPublicUrl(media: Media): string | null;
    /**
     * Check if a file exists in S3
     */
    fileExists(key: string): Promise<boolean>;
    /**
     * Delete a file from S3
     */
    deleteFile(key: string): Promise<boolean>;
    /**
     * Check if quota is enabled
     */
    isQuotaEnabled(): boolean;
    /**
     * Get default quota in bytes
     */
    getDefaultQuota(): number;
    /**
     * Get or create quota for a user
     */
    getOrCreateQuota(userId: number): Promise<MediaQuota>;
    /**
     * Check if user can upload a file of given size
     */
    canUpload(userId: number, fileSize: number): Promise<{
        allowed: boolean;
        reason?: string;
        quota?: MediaQuota;
    }>;
    /**
     * Add file to user's quota
     */
    addToQuota(userId: number, fileSize: number): Promise<void>;
    /**
     * Remove file from user's quota
     */
    removeFromQuota(userId: number, fileSize: number): Promise<void>;
    /**
     * Check if transforms are enabled
     */
    isTransformEnabled(): boolean;
    /**
     * Get transform config with defaults
     */
    getTransformConfig(): Required<TransformConfig>;
    /**
     * Check if a media can be transformed (is an image)
     */
    canTransform(media: Media): boolean;
    /**
     * Generate cache key for transformed image
     */
    getTransformCacheKey(media: Media, params: TransformParams): string;
    /**
     * Check if transformed image exists in cache
     */
    transformCacheExists(cacheKey: string): Promise<boolean>;
    /**
     * Get URL for cached transform (public or signed)
     */
    getTransformUrl(media: Media, cacheKey: string): Promise<string>;
    /**
     * Transform an image and save to cache
     */
    transformImage(media: Media, params: TransformParams): Promise<{
        url: string;
        cacheKey: string;
        cached: boolean;
    }>;
    commands(): ({
        command: string;
        description: string;
        warn: boolean;
        action: () => Promise<import("@aws-sdk/client-s3").PutBucketCorsCommandOutput | {
            success: boolean;
            message: any;
        }>;
        options?: undefined;
    } | {
        command: string;
        description: string;
        action: () => Promise<{
            success: boolean;
            message: any;
        }>;
        warn?: undefined;
        options?: undefined;
    } | {
        command: string;
        description: string;
        options: {
            flag: string;
            description: string;
        }[];
        action: (options: {
            dryRun?: boolean;
            limit?: string;
            verbose?: boolean;
        }) => Promise<{
            success: boolean;
            message: string;
            data: {
                orphanCount: number;
                wouldFreeBytes: number;
                references: string[];
                deleted?: undefined;
                freedBytes?: undefined;
                s3Errors?: undefined;
                dbErrors?: undefined;
            };
        } | {
            success: boolean;
            message: string;
            data: {
                deleted: number;
                freedBytes: number;
                s3Errors: number;
                dbErrors: number;
                orphanCount?: undefined;
                wouldFreeBytes?: undefined;
                references?: undefined;
            };
        } | {
            success: boolean;
            message: any;
            data?: undefined;
        }>;
        warn?: undefined;
    } | {
        command: string;
        description: string;
        options: {
            flag: string;
            description: string;
        }[];
        action: (options: {
            days?: string;
            dryRun?: boolean;
        }) => Promise<{
            success: boolean;
            message: any;
        }>;
        warn?: undefined;
    })[];
}
export declare const AvailableRouteMethods: {
    readonly media: readonly ["requestUpload", "confirmUpload", "confirmBulk", "getMedia", "getMediaAccess", "getMediaTransform", "getUserMedia", "getUserQuota", "deleteMedia", "deleteBulk"];
};
export type MediaMethods = (typeof AvailableRouteMethods.media)[number];
export interface ETHMediaLeafConfig {
    access_key_id: string;
    secret_access_key: string;
    region: string;
    server: string;
    bucket: string;
    /**
     * Optional CDN URL for public files (e.g., 'https://cdn.example.com')
     */
    cdn_url?: string;
    routes: {
        media: MediaMethods[];
    };
    rules: MediaRule[];
    /**
     * Quota configuration for storage limits
     */
    quota?: QuotaConfig;
    /**
     * Image transform configuration
     */
    transforms?: TransformConfig;
}
