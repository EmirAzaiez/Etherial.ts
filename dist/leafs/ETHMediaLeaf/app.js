var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as path from 'path';
import { PutBucketCorsCommand, S3Client, DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BaseMedia as Media } from './models/Media';
import { BaseMediaQuota as MediaQuota } from './models/MediaQuota';
import sharp from 'sharp';
export default class EthMediaLeaf {
    constructor(config) {
        this.etherial_module_name = 'eth_media_leaf';
        this.routes = [];
        this.config = config;
        if (config.routes) {
            if (config.routes.media && config.routes.media.length > 0) {
                this.routes.push({ route: path.join(__dirname, 'routes/media'), methods: config.routes.media });
            }
        }
        this.bucket = config.bucket;
        this.s3 = new S3Client({
            endpoint: config.server,
            region: config.region,
            credentials: {
                accessKeyId: config.access_key_id,
                secretAccessKey: config.secret_access_key,
            },
        });
    }
    beforeRun({ database }) {
        // database?.addModels([path.join(__dirname, 'models')])
    }
    run({ http, database }) {
        var _a;
        (_a = http === null || http === void 0 ? void 0 : http.routes_leafs) === null || _a === void 0 ? void 0 : _a.push(...this.routes);
    }
    /**
     * Get the rule for a specific folder
     */
    getRuleForFolder(folder) {
        return this.config.rules.find((rule) => rule.folders.includes(folder));
    }
    /**
     * Check if a user can access a specific media file
     * Returns true if access is granted, false otherwise
     */
    checkAccess(req, media) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const rule = this.getRuleForFolder(media.folder);
            // No rule found = deny access
            if (!rule)
                return false;
            // Public files are always accessible
            if (rule.visibility === 'public-read')
                return true;
            // Private files: check canAccess callback
            if (rule.canAccess) {
                return yield rule.canAccess(req, media);
            }
            // No canAccess defined for private files = only owner can access
            return media.uploaded_by === ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id);
        });
    }
    /**
     * Generate a signed URL for accessing a private file
     * @param media The media to generate URL for
     * @param expiresIn Expiration time in seconds (default from rule or 3600)
     */
    generateSignedUrl(media, expiresIn) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const rule = this.getRuleForFolder(media.folder);
            const expiration = (_a = expiresIn !== null && expiresIn !== void 0 ? expiresIn : rule === null || rule === void 0 ? void 0 : rule.signedUrlExpiration) !== null && _a !== void 0 ? _a : 3600;
            const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: media.key,
            });
            return yield getSignedUrl(this.s3, command, { expiresIn: expiration });
        });
    }
    /**
     * Get the public URL for a media file (only for public-read files)
     * Uses CDN URL if configured, otherwise constructs from endpoint
     */
    getPublicUrl(media) {
        const rule = this.getRuleForFolder(media.folder);
        if ((rule === null || rule === void 0 ? void 0 : rule.visibility) !== 'public-read')
            return null;
        if (this.config.cdn_url) {
            return `${this.config.cdn_url.replace(/\/$/, '')}/${media.key}`;
        }
        // Construct URL from S3 endpoint
        const endpoint = this.config.server.replace(/\/$/, '');
        return `${endpoint}/${this.bucket}/${media.key}`;
    }
    /**
     * Check if a file exists in S3
     */
    fileExists(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.s3.send(new HeadObjectCommand({
                    Bucket: this.bucket,
                    Key: key,
                }));
                return true;
            }
            catch (error) {
                return false;
            }
        });
    }
    /**
     * Delete a file from S3
     */
    deleteFile(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.s3.send(new DeleteObjectCommand({
                    Bucket: this.bucket,
                    Key: key,
                }));
                return true;
            }
            catch (error) {
                console.error('Failed to delete file from S3:', error);
                return false;
            }
        });
    }
    // ==================== QUOTA METHODS ====================
    /**
     * Check if quota is enabled
     */
    isQuotaEnabled() {
        var _a, _b;
        return (_b = (_a = this.config.quota) === null || _a === void 0 ? void 0 : _a.enabled) !== null && _b !== void 0 ? _b : false;
    }
    /**
     * Get default quota in bytes
     */
    getDefaultQuota() {
        var _a, _b;
        return (_b = (_a = this.config.quota) === null || _a === void 0 ? void 0 : _a.defaultQuota) !== null && _b !== void 0 ? _b : 100 * 1024 * 1024; // 100MB default
    }
    /**
     * Get or create quota for a user
     */
    getOrCreateQuota(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            let quota = yield MediaQuota.findOne({ where: { user_id: userId } });
            if (!quota) {
                quota = yield MediaQuota.create({ user_id: userId });
            }
            return quota;
        });
    }
    /**
     * Check if user can upload a file of given size
     */
    canUpload(userId, fileSize) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isQuotaEnabled()) {
                return { allowed: true };
            }
            const quota = yield this.getOrCreateQuota(userId);
            const globalQuota = this.getDefaultQuota();
            if (quota.wouldExceedQuota(fileSize, globalQuota)) {
                return {
                    allowed: false,
                    reason: 'quota_exceeded',
                    quota
                };
            }
            return { allowed: true, quota };
        });
    }
    /**
     * Add file to user's quota
     */
    addToQuota(userId, fileSize) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isQuotaEnabled())
                return;
            const quota = yield this.getOrCreateQuota(userId);
            yield quota.addUsage(fileSize);
        });
    }
    /**
     * Remove file from user's quota
     */
    removeFromQuota(userId, fileSize) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isQuotaEnabled())
                return;
            const quota = yield this.getOrCreateQuota(userId);
            yield quota.removeUsage(fileSize);
        });
    }
    // ==================== TRANSFORM METHODS ====================
    /**
     * Check if transforms are enabled
     */
    isTransformEnabled() {
        var _a, _b;
        return (_b = (_a = this.config.transforms) === null || _a === void 0 ? void 0 : _a.enabled) !== null && _b !== void 0 ? _b : false;
    }
    /**
     * Get transform config with defaults
     */
    getTransformConfig() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        return {
            enabled: (_b = (_a = this.config.transforms) === null || _a === void 0 ? void 0 : _a.enabled) !== null && _b !== void 0 ? _b : false,
            cacheFolder: (_d = (_c = this.config.transforms) === null || _c === void 0 ? void 0 : _c.cacheFolder) !== null && _d !== void 0 ? _d : '_cache',
            maxWidth: (_f = (_e = this.config.transforms) === null || _e === void 0 ? void 0 : _e.maxWidth) !== null && _f !== void 0 ? _f : 2000,
            maxHeight: (_h = (_g = this.config.transforms) === null || _g === void 0 ? void 0 : _g.maxHeight) !== null && _h !== void 0 ? _h : 2000,
            defaultQuality: (_k = (_j = this.config.transforms) === null || _j === void 0 ? void 0 : _j.defaultQuality) !== null && _k !== void 0 ? _k : 80,
            allowedFormats: (_m = (_l = this.config.transforms) === null || _l === void 0 ? void 0 : _l.allowedFormats) !== null && _m !== void 0 ? _m : ['jpeg', 'webp', 'png'],
        };
    }
    /**
     * Check if a media can be transformed (is an image)
     */
    canTransform(media) {
        if (!this.isTransformEnabled())
            return false;
        const rule = this.getRuleForFolder(media.folder);
        if (!(rule === null || rule === void 0 ? void 0 : rule.allowTransforms))
            return false;
        const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
        return imageTypes.includes(media.mime_type);
    }
    /**
     * Generate cache key for transformed image
     */
    getTransformCacheKey(media, params) {
        const config = this.getTransformConfig();
        const parts = [
            config.cacheFolder,
            media.folder,
            media.name.replace(/\.[^.]+$/, ''), // Remove extension
            `w${params.w || 0}_h${params.h || 0}_${params.fit || 'cover'}_q${params.q || config.defaultQuality}.${params.format || 'webp'}`
        ];
        return parts.join('/');
    }
    /**
     * Check if transformed image exists in cache
     */
    transformCacheExists(cacheKey) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.fileExists(cacheKey);
        });
    }
    /**
     * Get URL for cached transform (public or signed)
     */
    getTransformUrl(media, cacheKey) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const rule = this.getRuleForFolder(media.folder);
            if ((rule === null || rule === void 0 ? void 0 : rule.visibility) === 'public-read') {
                if (this.config.cdn_url) {
                    return `${this.config.cdn_url.replace(/\/$/, '')}/${cacheKey}`;
                }
                const endpoint = this.config.server.replace(/\/$/, '');
                return `${endpoint}/${this.bucket}/${cacheKey}`;
            }
            // Private: generate signed URL
            const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: cacheKey,
            });
            return yield getSignedUrl(this.s3, command, { expiresIn: (_a = rule === null || rule === void 0 ? void 0 : rule.signedUrlExpiration) !== null && _a !== void 0 ? _a : 3600 });
        });
    }
    /**
     * Transform an image and save to cache
     */
    transformImage(media, params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const config = this.getTransformConfig();
            const cacheKey = this.getTransformCacheKey(media, params);
            // Check cache first
            if (yield this.transformCacheExists(cacheKey)) {
                const url = yield this.getTransformUrl(media, cacheKey);
                return { url, cacheKey, cached: true };
            }
            // Download original from S3
            const getCommand = new GetObjectCommand({
                Bucket: this.bucket,
                Key: media.key,
            });
            const response = yield this.s3.send(getCommand);
            const originalBuffer = yield ((_a = response.Body) === null || _a === void 0 ? void 0 : _a.transformToByteArray());
            if (!originalBuffer) {
                throw new Error('Failed to download original image');
            }
            // Transform with Sharp
            let transformer = sharp(Buffer.from(originalBuffer));
            // Resize
            const width = params.w ? Math.min(params.w, config.maxWidth) : undefined;
            const height = params.h ? Math.min(params.h, config.maxHeight) : undefined;
            if (width || height) {
                transformer = transformer.resize(width, height, {
                    fit: params.fit || 'cover',
                    withoutEnlargement: true,
                });
            }
            // Format & quality
            const format = params.format || 'webp';
            const quality = params.q || config.defaultQuality;
            switch (format) {
                case 'jpeg':
                    transformer = transformer.jpeg({ quality });
                    break;
                case 'webp':
                    transformer = transformer.webp({ quality });
                    break;
                case 'png':
                    transformer = transformer.png({ quality });
                    break;
                case 'avif':
                    transformer = transformer.avif({ quality });
                    break;
            }
            const transformedBuffer = yield transformer.toBuffer();
            // Upload to cache
            const rule = this.getRuleForFolder(media.folder);
            const putCommand = new PutObjectCommand({
                Bucket: this.bucket,
                Key: cacheKey,
                Body: transformedBuffer,
                ContentType: `image/${format}`,
                ACL: (rule === null || rule === void 0 ? void 0 : rule.visibility) || 'private',
            });
            yield this.s3.send(putCommand);
            const url = yield this.getTransformUrl(media, cacheKey);
            return { url, cacheKey, cached: false };
        });
    }
    commands() {
        return [
            {
                command: 'cors',
                description: 'Configure cors for *.',
                warn: true,
                action: () => __awaiter(this, void 0, void 0, function* () {
                    try {
                        return yield this.s3.send(new PutBucketCorsCommand({
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
                        }));
                    }
                    catch (error) {
                        return { success: false, message: error.message };
                    }
                }),
            },
            {
                command: 'cleanup:pending',
                description: 'Delete pending uploads older than 24 hours.',
                action: () => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const { Op } = require('sequelize');
                        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
                        const pendingMedias = yield Media.findAll({
                            where: {
                                status: 'pending',
                                created_at: { [Op.lt]: cutoff },
                            },
                        });
                        let deleted = 0;
                        for (const media of pendingMedias) {
                            yield media.destroy();
                            deleted++;
                        }
                        return { success: true, message: `Deleted ${deleted} pending uploads.` };
                    }
                    catch (error) {
                        return { success: false, message: error.message };
                    }
                }),
            },
            {
                command: 'cleanup:orphans',
                description: 'Find and delete orphan medias not referenced by any model. Use --dry-run to preview.',
                options: [
                    { flag: '-d, --dry-run', description: 'Preview orphans without deleting them' },
                    { flag: '-l, --limit <number>', description: 'Max orphans to delete (default: 100)' },
                    { flag: '-v, --verbose', description: 'Show detailed progress' },
                ],
                action: (options) => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b;
                    try {
                        const dryRun = (_a = options.dryRun) !== null && _a !== void 0 ? _a : false;
                        const limit = parseInt(options.limit || '100', 10);
                        const verbose = (_b = options.verbose) !== null && _b !== void 0 ? _b : false;
                        console.log(`\n🔍 Finding orphan medias...`);
                        console.log(`   Mode: ${dryRun ? 'DRY RUN (no deletions)' : 'LIVE (will delete)'}`);
                        console.log(`   Limit: ${limit}`);
                        // Auto-detect all models that reference Media
                        const references = Media.findAllReferences();
                        if (references.length === 0) {
                            return {
                                success: false,
                                message: 'No models with Media associations found. Make sure your models have @BelongsTo(() => Media) decorators.'
                            };
                        }
                        console.log(`\n   Auto-detected ${references.length} Media references:`);
                        for (const ref of references) {
                            console.log(`      - ${ref.modelName}.${ref.field}`);
                        }
                        // Find orphans using Media's static method
                        const orphans = yield Media.findOrphans(limit);
                        console.log(`\n🗑️  Orphan medias found: ${orphans.length}`);
                        if (orphans.length === 0) {
                            return { success: true, message: 'No orphan medias found. All medias are in use!' };
                        }
                        const totalSize = orphans.reduce((sum, m) => sum + (m.file_size || 0), 0);
                        console.log(`📋 Will process ${orphans.length} orphans (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
                        if (verbose) {
                            console.log('\nOrphan list:');
                            for (const m of orphans.slice(0, 20)) {
                                console.log(`   - [${m.id}] ${m.folder}/${m.name} (${(m.file_size / 1024).toFixed(1)} KB)`);
                            }
                            if (orphans.length > 20) {
                                console.log(`   ... and ${orphans.length - 20} more`);
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
                            };
                        }
                        // Delete orphans
                        console.log('\n🗑️  Deleting orphans...');
                        let deletedCount = 0;
                        let deletedSize = 0;
                        let s3Errors = 0;
                        let dbErrors = 0;
                        for (const orphan of orphans) {
                            try {
                                // Delete from S3
                                const s3Deleted = yield this.deleteFile(orphan.key);
                                if (!s3Deleted) {
                                    s3Errors++;
                                    if (verbose)
                                        console.log(`   ⚠️  S3 delete failed: ${orphan.key}`);
                                }
                                // Delete from database
                                yield orphan.destroy();
                                deletedCount++;
                                deletedSize += orphan.file_size || 0;
                                if (verbose && deletedCount % 10 === 0) {
                                    console.log(`   Progress: ${deletedCount}/${orphans.length}`);
                                }
                            }
                            catch (err) {
                                dbErrors++;
                                if (verbose)
                                    console.log(`   ⚠️  DB delete failed [${orphan.id}]: ${err.message}`);
                            }
                        }
                        console.log(`\n✅ Cleanup complete!`);
                        console.log(`   Deleted: ${deletedCount} medias`);
                        console.log(`   Freed: ${(deletedSize / 1024 / 1024).toFixed(2)} MB`);
                        if (s3Errors > 0)
                            console.log(`   S3 errors: ${s3Errors}`);
                        if (dbErrors > 0)
                            console.log(`   DB errors: ${dbErrors}`);
                        return {
                            success: true,
                            message: `Deleted ${deletedCount} orphan medias, freed ${(deletedSize / 1024 / 1024).toFixed(2)} MB.`,
                            data: { deleted: deletedCount, freedBytes: deletedSize, s3Errors, dbErrors },
                        };
                    }
                    catch (error) {
                        return { success: false, message: error.message };
                    }
                }),
            },
            {
                command: 'cleanup:cache',
                description: 'Delete transform cache files older than N days.',
                options: [
                    { flag: '-d, --days <number>', description: 'Delete cache older than N days (default: 30)' },
                    { flag: '--dry-run', description: 'Preview without deleting' },
                ],
                action: (options) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    try {
                        const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
                        const config = this.getTransformConfig();
                        const cacheFolder = config.cacheFolder;
                        const daysOld = parseInt(options.days || '30', 10);
                        const dryRun = (_a = options.dryRun) !== null && _a !== void 0 ? _a : false;
                        const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
                        console.log(`\n🔍 Finding cache files older than ${daysOld} days...`);
                        console.log(`   Cache folder: ${cacheFolder}/`);
                        console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
                        // List all objects in cache folder
                        let continuationToken;
                        let totalFound = 0;
                        let totalDeleted = 0;
                        let totalSize = 0;
                        do {
                            const listCommand = new ListObjectsV2Command({
                                Bucket: this.bucket,
                                Prefix: `${cacheFolder}/`,
                                ContinuationToken: continuationToken,
                            });
                            const response = yield this.s3.send(listCommand);
                            const objects = response.Contents || [];
                            for (const obj of objects) {
                                if (obj.LastModified && obj.LastModified < cutoff) {
                                    totalFound++;
                                    totalSize += obj.Size || 0;
                                    if (!dryRun) {
                                        yield this.deleteFile(obj.Key);
                                        totalDeleted++;
                                    }
                                }
                            }
                            continuationToken = response.NextContinuationToken;
                        } while (continuationToken);
                        if (dryRun) {
                            return {
                                success: true,
                                message: `DRY RUN: Would delete ${totalFound} cache files (${(totalSize / 1024 / 1024).toFixed(2)} MB).`,
                            };
                        }
                        return {
                            success: true,
                            message: `Deleted ${totalDeleted} cache files, freed ${(totalSize / 1024 / 1024).toFixed(2)} MB.`,
                        };
                    }
                    catch (error) {
                        return { success: false, message: error.message };
                    }
                }),
            },
        ];
    }
}
export const AvailableRouteMethods = {
    media: [
        'requestUpload', // POST /medias/request - Request presigned URL for upload
        'confirmUpload', // POST /medias/:id/confirm - Confirm upload is complete
        'confirmBulk', // POST /medias/bulk/confirm - Confirm multiple uploads
        'getMedia', // GET /medias/:id - Get media details (with access URL if private)
        'getMediaAccess', // GET /medias/:id/access - Get signed URL for private file
        'getMediaTransform', // GET /medias/:id/transform - Get transformed image
        'getUserMedia', // GET /medias - List user's medias
        'getUserQuota', // GET /medias/quota - Get user's storage quota
        'deleteMedia', // DELETE /medias/:id - Delete a media
        'deleteBulk', // DELETE /medias/bulk - Delete multiple medias
    ],
};
