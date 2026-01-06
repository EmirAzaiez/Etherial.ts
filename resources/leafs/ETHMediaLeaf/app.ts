import etherial, { Etherial } from 'etherial'

import * as path from 'path'

import { PutBucketCorsCommand, S3Client, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand } from '@aws-sdk/client-s3'

import { Request } from 'etherial/components/http/provider'
import { Media } from './models/Media'

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
        database?.addModels([path.join(__dirname, 'models')])
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
        ]
    }
}

export const AvailableRouteMethods = {
    media: [
        'requestUpload',      // POST /medias/request - Request presigned URL for upload
        'confirmUpload',      // POST /medias/:id/confirm - Confirm upload is complete
        'getMedia',           // GET /medias/:id - Get media details (with access URL if private)
        'getMediaAccess',     // GET /medias/:id/access - Get signed URL for private file
        'getUserMedia',       // GET /medias - List user's medias
        'deleteMedia',        // DELETE /medias/:id - Delete a media
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
}
