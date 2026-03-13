import { Etherial } from 'etherial'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

import { PutBucketCorsCommand, S3Client, DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { Request } from 'etherial/components/http/provider'
import { BaseMedia as Media } from './models/Media'
import { BaseMediaQuota as MediaQuota } from './models/MediaQuota'
import sharp from 'sharp'

// Type for the access control callback
export type MediaAccessChecker = (req: Request & { user?: any }, media: Media) => boolean | Promise<boolean>

export interface MediaRule {
    folders: string[]
    visibility: 'public-read' | 'private'
    max_size?: number
    mime_types?: string[]
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
    canAccess?: MediaAccessChecker
    /**
     * Signed URL expiration time in seconds (default: 3600 = 1 hour)
     */
    signedUrlExpiration?: number
    /**
     * Allow image transforms for this folder (default: false)
     */
    allowTransforms?: boolean
}

export interface QuotaConfig {
    /**
     * Enable quota tracking (default: false)
     */
    enabled: boolean
    /**
     * Default quota per user in bytes (default: 100MB)
     */
    defaultQuota?: number
}

export interface TransformConfig {
    /**
     * Enable image transforms (default: false)
     */
    enabled: boolean
    /**
     * Cache folder in S3 for transformed images (default: '_cache')
     */
    cacheFolder?: string
    /**
     * Max width allowed (default: 2000)
     */
    maxWidth?: number
    /**
     * Max height allowed (default: 2000)
     */
    maxHeight?: number
    /**
     * Default quality for JPEG/WebP (default: 80)
     */
    defaultQuality?: number
    /**
     * Allowed formats (default: ['jpeg', 'webp', 'png'])
     */
    allowedFormats?: ('jpeg' | 'webp' | 'png' | 'avif')[]
}

export type TransformFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside'

export interface TransformParams {
    w?: number
    h?: number
    fit?: TransformFit
    format?: 'jpeg' | 'webp' | 'png' | 'avif'
    q?: number
}

export default class EthMediaLeaf {
    etherial_module_name = 'eth_media_leaf'

    private routes: { route: string; methods: string[] }[] = []
    s3: S3Client
    bucket: string
    config: ETHMediaLeafConfig

    constructor(config: ETHMediaLeafConfig) {
        this.config = config

        if (config.routes) {
            if (config.routes.media && config.routes.media.length > 0) {
                this.routes.push({ route: path.join(__dirname, 'routes/media'), methods: config.routes.media })
            }
        }

        this.bucket = config.bucket

        this.s3 = new S3Client({
            endpoint: config.server,
            region: config.region,
            credentials: {
                accessKeyId: config.access_key_id,
                secretAccessKey: config.secret_access_key,
            },
        })
    }

    beforeRun({ database }: Etherial) {
        // database?.addModels([path.join(__dirname, 'models')])
    }

    run({ http, database }: Etherial) {
        http?.routes_leafs?.push(...this.routes)
    }

    /**
     * Get the rule for a specific folder
     */
    getRuleForFolder(folder: string): MediaRule | undefined {
        return this.config.rules.find((rule) => rule.folders.includes(folder))
    }

    /**
     * Check if a user can access a specific media file
     * Returns true if access is granted, false otherwise
     */
    async checkAccess(req: Request & { user?: any }, media: Media): Promise<boolean> {
        const rule = this.getRuleForFolder(media.folder)

        // No rule found = deny access
        if (!rule) return false

        // Public files are always accessible
        if (rule.visibility === 'public-read') return true

        // Private files: check canAccess callback
        if (rule.canAccess) {
            return await rule.canAccess(req, media)
        }

        // No canAccess defined for private files = only owner can access
        return media.uploaded_by === req.user?.id
    }

    /**
     * Generate a signed URL for accessing a private file
     * @param media The media to generate URL for
     * @param expiresIn Expiration time in seconds (default from rule or 3600)
     */
    async generateSignedUrl(media: Media, expiresIn?: number): Promise<string> {
        const rule = this.getRuleForFolder(media.folder)
        const expiration = expiresIn ?? rule?.signedUrlExpiration ?? 3600

        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: media.key,
        })

        return await getSignedUrl(this.s3, command, { expiresIn: expiration })
    }

    /**
     * Get the public URL for a media file (only for public-read files)
     * Uses CDN URL if configured, otherwise constructs from endpoint
     */
    getPublicUrl(media: Media): string | null {
        const rule = this.getRuleForFolder(media.folder)

        if (rule?.visibility !== 'public-read') return null

        if (this.config.cdn_url) {
            return `${this.config.cdn_url.replace(/\/$/, '')}/${media.key}`
        }

        // Construct URL from S3 endpoint
        const endpoint = this.config.server.replace(/\/$/, '')
        return `${endpoint}/${this.bucket}/${media.key}`
    }

    /**
     * Check if a file exists in S3
     */
    async fileExists(key: string): Promise<boolean> {
        try {
            await this.s3.send(new HeadObjectCommand({
                Bucket: this.bucket,
                Key: key,
            }))
            return true
        } catch (error) {
            return false
        }
    }

    /**
     * Delete a file from S3
     */
    async deleteFile(key: string): Promise<boolean> {
        try {
            await this.s3.send(new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: key,
            }))
            return true
        } catch (error) {
            console.error('Failed to delete file from S3:', error)
            return false
        }
    }

    // ==================== QUOTA METHODS ====================

    /**
     * Check if quota is enabled
     */
    isQuotaEnabled(): boolean {
        return this.config.quota?.enabled ?? false
    }

    /**
     * Get default quota in bytes
     */
    getDefaultQuota(): number {
        return this.config.quota?.defaultQuota ?? 100 * 1024 * 1024 // 100MB default
    }

    /**
     * Get or create quota for a user
     */
    async getOrCreateQuota(userId: number): Promise<MediaQuota> {
        let quota = await MediaQuota.findOne({ where: { user_id: userId } })
        if (!quota) {
            quota = await MediaQuota.create({ user_id: userId })
        }
        return quota
    }

    /**
     * Check if user can upload a file of given size
     */
    async canUpload(userId: number, fileSize: number): Promise<{ allowed: boolean; reason?: string; quota?: MediaQuota }> {
        if (!this.isQuotaEnabled()) {
            return { allowed: true }
        }

        const quota = await this.getOrCreateQuota(userId)
        const globalQuota = this.getDefaultQuota()

        if (quota.wouldExceedQuota(fileSize, globalQuota)) {
            return {
                allowed: false,
                reason: 'quota_exceeded',
                quota
            }
        }

        return { allowed: true, quota }
    }

    /**
     * Add file to user's quota
     */
    async addToQuota(userId: number, fileSize: number): Promise<void> {
        if (!this.isQuotaEnabled()) return
        const quota = await this.getOrCreateQuota(userId)
        await quota.addUsage(fileSize)
    }

    /**
     * Remove file from user's quota
     */
    async removeFromQuota(userId: number, fileSize: number): Promise<void> {
        if (!this.isQuotaEnabled()) return
        const quota = await this.getOrCreateQuota(userId)
        await quota.removeUsage(fileSize)
    }

    // ==================== TRANSFORM METHODS ====================

    /**
     * Check if transforms are enabled
     */
    isTransformEnabled(): boolean {
        return this.config.transforms?.enabled ?? false
    }

    /**
     * Get transform config with defaults
     */
    getTransformConfig(): Required<TransformConfig> {
        return {
            enabled: this.config.transforms?.enabled ?? false,
            cacheFolder: this.config.transforms?.cacheFolder ?? '_cache',
            maxWidth: this.config.transforms?.maxWidth ?? 2000,
            maxHeight: this.config.transforms?.maxHeight ?? 2000,
            defaultQuality: this.config.transforms?.defaultQuality ?? 80,
            allowedFormats: this.config.transforms?.allowedFormats ?? ['jpeg', 'webp', 'png'],
        }
    }

    /**
     * Check if a media can be transformed (is an image)
     */
    canTransform(media: Media): boolean {
        if (!this.isTransformEnabled()) return false

        const rule = this.getRuleForFolder(media.folder)
        if (!rule?.allowTransforms) return false

        const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
        return imageTypes.includes(media.mime_type)
    }

    /**
     * Generate cache key for transformed image
     */
    getTransformCacheKey(media: Media, params: TransformParams): string {
        const config = this.getTransformConfig()
        const parts = [
            config.cacheFolder,
            media.folder,
            media.name.replace(/\.[^.]+$/, ''), // Remove extension
            `w${params.w || 0}_h${params.h || 0}_${params.fit || 'cover'}_q${params.q || config.defaultQuality}.${params.format || 'webp'}`
        ]
        return parts.join('/')
    }

    /**
     * Check if transformed image exists in cache
     */
    async transformCacheExists(cacheKey: string): Promise<boolean> {
        return this.fileExists(cacheKey)
    }

    /**
     * Get URL for cached transform (public or signed)
     */
    async getTransformUrl(media: Media, cacheKey: string): Promise<string> {
        const rule = this.getRuleForFolder(media.folder)

        if (rule?.visibility === 'public-read') {
            if (this.config.cdn_url) {
                return `${this.config.cdn_url.replace(/\/$/, '')}/${cacheKey}`
            }
            const endpoint = this.config.server.replace(/\/$/, '')
            return `${endpoint}/${this.bucket}/${cacheKey}`
        }

        // Private: generate signed URL
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: cacheKey,
        })
        return await getSignedUrl(this.s3, command, { expiresIn: rule?.signedUrlExpiration ?? 3600 })
    }

    /**
     * Transform an image and save to cache
     */
    async transformImage(media: Media, params: TransformParams): Promise<{ url: string; cacheKey: string; cached: boolean }> {
        const config = this.getTransformConfig()
        const cacheKey = this.getTransformCacheKey(media, params)

        // Check cache first
        if (await this.transformCacheExists(cacheKey)) {
            const url = await this.getTransformUrl(media, cacheKey)
            return { url, cacheKey, cached: true }
        }

        // Download original from S3
        const getCommand = new GetObjectCommand({
            Bucket: this.bucket,
            Key: media.key,
        })
        const response = await this.s3.send(getCommand)
        const originalBuffer = await response.Body?.transformToByteArray()

        if (!originalBuffer) {
            throw new Error('Failed to download original image')
        }

        // Transform with Sharp
        let transformer = sharp(Buffer.from(originalBuffer))

        // Resize
        const width = params.w ? Math.min(params.w, config.maxWidth) : undefined
        const height = params.h ? Math.min(params.h, config.maxHeight) : undefined

        if (width || height) {
            transformer = transformer.resize(width, height, {
                fit: params.fit || 'cover',
                withoutEnlargement: true,
            })
        }

        // Format & quality
        const format = params.format || 'webp'
        const quality = params.q || config.defaultQuality

        switch (format) {
            case 'jpeg':
                transformer = transformer.jpeg({ quality })
                break
            case 'webp':
                transformer = transformer.webp({ quality })
                break
            case 'png':
                transformer = transformer.png({ quality })
                break
            case 'avif':
                transformer = transformer.avif({ quality })
                break
        }

        const transformedBuffer = await transformer.toBuffer()

        // Upload to cache
        const rule = this.getRuleForFolder(media.folder)
        const putCommand = new PutObjectCommand({
            Bucket: this.bucket,
            Key: cacheKey,
            Body: transformedBuffer,
            ContentType: `image/${format}`,
            ACL: rule?.visibility || 'private',
        })
        await this.s3.send(putCommand)

        const url = await this.getTransformUrl(media, cacheKey)
        return { url, cacheKey, cached: false }
    }

    commands() {
        return [
            {
                command: 'cors',
                description: 'Configure cors for *.',
                warn: true,
                action: async () => {
                    try {
                        return await this.s3.send(
                            new PutBucketCorsCommand({
                                Bucket: this.bucket,
                                CORSConfiguration: {
                                    CORSRules: [
                                        {
                                            AllowedHeaders: ['*'],
                                            AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                                            AllowedOrigins: ['*'],
                                            ExposeHeaders: ['ETag'],
                                            MaxAgeSeconds: 3000,
                                        },
                                    ],
                                },
                            })
                        )
                    } catch (error) {
                        return { success: false, message: error.message }
                    }
                },
            },
            {
                command: 'cleanup:pending',
                description: 'Delete pending uploads older than 24 hours.',
                action: async () => {
                    try {
                        const { Op } = require('sequelize')
                        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)

                        const pendingMedias = await Media.findAll({
                            where: {
                                status: 'pending',
                                created_at: { [Op.lt]: cutoff },
                            },
                        })

                        let deleted = 0
                        for (const media of pendingMedias) {
                            await media.destroy()
                            deleted++
                        }

                        return { success: true, message: `Deleted ${deleted} pending uploads.` }
                    } catch (error) {
                        return { success: false, message: error.message }
                    }
                },
            },
            {
                command: 'cleanup:orphans',
                description: 'Find and delete orphan medias not referenced by any model. Use --dry-run to preview.',
                options: [
                    { flag: '-d, --dry-run', description: 'Preview orphans without deleting them' },
                    { flag: '-l, --limit <number>', description: 'Max orphans to delete (default: 100)' },
                    { flag: '-v, --verbose', description: 'Show detailed progress' },
                ],
                action: async (options: { dryRun?: boolean; limit?: string; verbose?: boolean }) => {
                    try {
                        const dryRun = options.dryRun ?? false
                        const limit = parseInt(options.limit || '100', 10)
                        const verbose = options.verbose ?? false

                        console.log(`\n🔍 Finding orphan medias...`)
                        console.log(`   Mode: ${dryRun ? 'DRY RUN (no deletions)' : 'LIVE (will delete)'}`)
                        console.log(`   Limit: ${limit}`)

                        // Auto-detect all models that reference Media
                        const references = Media.findAllReferences()

                        if (references.length === 0) {
                            return {
                                success: false,
                                message: 'No models with Media associations found. Make sure your models have @BelongsTo(() => Media) decorators.'
                            }
                        }

                        console.log(`\n   Auto-detected ${references.length} Media references:`)
                        for (const ref of references) {
                            console.log(`      - ${ref.modelName}.${ref.field}`)
                        }

                        // Find orphans using Media's static method
                        const orphans = await Media.findOrphans(limit)

                        console.log(`\n🗑️  Orphan medias found: ${orphans.length}`)

                        if (orphans.length === 0) {
                            return { success: true, message: 'No orphan medias found. All medias are in use!' }
                        }

                        const totalSize = orphans.reduce((sum, m) => sum + (m.file_size || 0), 0)
                        console.log(`📋 Will process ${orphans.length} orphans (${(totalSize / 1024 / 1024).toFixed(2)} MB)`)

                        if (verbose) {
                            console.log('\nOrphan list:')
                            for (const m of orphans.slice(0, 20)) {
                                console.log(`   - [${m.id}] ${m.folder}/${m.name} (${(m.file_size / 1024).toFixed(1)} KB)`)
                            }
                            if (orphans.length > 20) {
                                console.log(`   ... and ${orphans.length - 20} more`)
                            }
                        }

                        if (dryRun) {
                            return {
                                success: true,
                                message: `DRY RUN: Would delete ${orphans.length} orphan medias (${(totalSize / 1024 / 1024).toFixed(2)} MB). Run without --dry-run to delete.`,
                                data: {
                                    orphanCount: orphans.length,
                                    wouldFreeBytes: totalSize,
                                    references: references.map(r => `${r.modelName}.${r.field}`),
                                }
                            }
                        }

                        // Delete orphans
                        console.log('\n🗑️  Deleting orphans...')

                        let deletedCount = 0
                        let deletedSize = 0
                        let s3Errors = 0
                        let dbErrors = 0

                        for (const orphan of orphans) {
                            try {
                                // Delete from S3
                                const s3Deleted = await this.deleteFile(orphan.key)
                                if (!s3Deleted) {
                                    s3Errors++
                                    if (verbose) console.log(`   ⚠️  S3 delete failed: ${orphan.key}`)
                                }

                                // Delete from database
                                await orphan.destroy()

                                deletedCount++
                                deletedSize += orphan.file_size || 0

                                if (verbose && deletedCount % 10 === 0) {
                                    console.log(`   Progress: ${deletedCount}/${orphans.length}`)
                                }
                            } catch (err: any) {
                                dbErrors++
                                if (verbose) console.log(`   ⚠️  DB delete failed [${orphan.id}]: ${err.message}`)
                            }
                        }

                        console.log(`\n✅ Cleanup complete!`)
                        console.log(`   Deleted: ${deletedCount} medias`)
                        console.log(`   Freed: ${(deletedSize / 1024 / 1024).toFixed(2)} MB`)
                        if (s3Errors > 0) console.log(`   S3 errors: ${s3Errors}`)
                        if (dbErrors > 0) console.log(`   DB errors: ${dbErrors}`)

                        return {
                            success: true,
                            message: `Deleted ${deletedCount} orphan medias, freed ${(deletedSize / 1024 / 1024).toFixed(2)} MB.`,
                            data: { deleted: deletedCount, freedBytes: deletedSize, s3Errors, dbErrors },
                        }
                    } catch (error: any) {
                        return { success: false, message: error.message }
                    }
                },
            },
            {
                command: 'cleanup:cache',
                description: 'Delete transform cache files older than N days.',
                options: [
                    { flag: '-d, --days <number>', description: 'Delete cache older than N days (default: 30)' },
                    { flag: '--dry-run', description: 'Preview without deleting' },
                ],
                action: async (options: { days?: string; dryRun?: boolean }) => {
                    try {
                        const { ListObjectsV2Command } = require('@aws-sdk/client-s3') as typeof import('@aws-sdk/client-s3')
                        const config = this.getTransformConfig()
                        const cacheFolder = config.cacheFolder
                        const daysOld = parseInt(options.days || '30', 10)
                        const dryRun = options.dryRun ?? false
                        const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)

                        console.log(`\n🔍 Finding cache files older than ${daysOld} days...`)
                        console.log(`   Cache folder: ${cacheFolder}/`)
                        console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)

                        // List all objects in cache folder
                        let continuationToken: string | undefined
                        let totalFound = 0
                        let totalDeleted = 0
                        let totalSize = 0

                        do {
                            const listCommand = new ListObjectsV2Command({
                                Bucket: this.bucket,
                                Prefix: `${cacheFolder}/`,
                                ContinuationToken: continuationToken,
                            })

                            const response: any = await this.s3.send(listCommand)
                            const objects = response.Contents || []

                            for (const obj of objects) {
                                if (obj.LastModified && obj.LastModified < cutoff) {
                                    totalFound++
                                    totalSize += obj.Size || 0

                                    if (!dryRun) {
                                        await this.deleteFile(obj.Key)
                                        totalDeleted++
                                    }
                                }
                            }

                            continuationToken = response.NextContinuationToken
                        } while (continuationToken)

                        if (dryRun) {
                            return {
                                success: true,
                                message: `DRY RUN: Would delete ${totalFound} cache files (${(totalSize / 1024 / 1024).toFixed(2)} MB).`,
                            }
                        }

                        return {
                            success: true,
                            message: `Deleted ${totalDeleted} cache files, freed ${(totalSize / 1024 / 1024).toFixed(2)} MB.`,
                        }
                    } catch (error: any) {
                        return { success: false, message: error.message }
                    }
                },
            },
        ]
    }
}

export const AvailableRouteMethods = {
    media: [
        'requestUpload',        // POST /medias/request - Request presigned URL for upload
        'confirmUpload',        // POST /medias/:id/confirm - Confirm upload is complete
        'confirmBulk',          // POST /medias/bulk/confirm - Confirm multiple uploads
        'getMedia',             // GET /medias/:id - Get media details (with access URL if private)
        'getMediaAccess',       // GET /medias/:id/access - Get signed URL for private file
        'getMediaTransform',    // GET /medias/:id/transform - Get transformed image
        'getUserMedia',         // GET /medias - List user's medias
        'getUserQuota',         // GET /medias/quota - Get user's storage quota
        'deleteMedia',          // DELETE /medias/:id - Delete a media
        'deleteBulk',           // DELETE /medias/bulk - Delete multiple medias
    ],
} as const

export type MediaMethods = (typeof AvailableRouteMethods.media)[number]

export interface ETHMediaLeafConfig {
    access_key_id: string
    secret_access_key: string
    region: string
    server: string
    bucket: string
    /**
     * Optional CDN URL for public files (e.g., 'https://cdn.example.com')
     */
    cdn_url?: string
    routes: {
        media: MediaMethods[]
    }
    rules: MediaRule[]
    /**
     * Quota configuration for storage limits
     */
    quota?: QuotaConfig
    /**
     * Image transform configuration
     */
    transforms?: TransformConfig
}
