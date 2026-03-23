import etherial from '../../../index.js'

import { Controller, Post, Get, Delete, Request, Response } from '../../../components/http/provider.js'

import { ShouldValidateYupForm } from '../../../components/http/yup.validator.js'
import { ShouldBeAuthenticated } from '../../../components/http.auth/provider.js'

import { MediaStatus } from '../models/Media.js'
import { Model } from '../../../components/database/provider.js'

import {
    MediaFormRequest,
    MediaFormRequestType,
} from '../forms/media_form.js'

// Models are retrieved dynamically from Sequelize registry
// This allows the Leaf to use the user's extended models (User, Media)
// instead of hardcoded imports that wouldn't exist in the Leaf package
const getModels = () => {
    const models = etherial.database!.sequelize.models
    return {
        User: models.User as unknown as typeof Model,
        Media: models.Media as any,
    }
}
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import mime from 'mime'

// Base user interface for type safety (user's model extends this)
interface UserBase {
    id: number
    [key: string]: any
}

@Controller()
export default class ETHMediaLeafMediaController {
    /**
     * Request Upload URL
     *
     * Generates a presigned URL for uploading a file to S3.
     * The client must then use this URL to upload the file directly to S3.
     * After upload, call confirmUpload to mark the media as uploaded.
     *
     * @route POST /medias/request
     * @access Private (requires authentication)
     */
    @Post('/medias/request')
    @ShouldValidateYupForm(MediaFormRequest)
    @ShouldBeAuthenticated()
    public async requestUpload(req: Request & { form: MediaFormRequestType; user: UserBase }, res: Response): Promise<any> {
        try {
            const { Media } = getModels()
            const rule = etherial.eth_media_leaf.config.rules.find((rule) => rule.folders.includes(req.form.folder))

            if (rule) {
                // Check quota first
                const quotaCheck = await etherial.eth_media_leaf.canUpload(req.user.id, req.form.file_size)
                if (!quotaCheck.allowed) {
                    return res.error({
                        status: 400,
                        errors: ['api.media.quota_exceeded'],
                    })
                }

                if (!rule.max_size || req.form.file_size <= rule.max_size) {
                    if (!rule.mime_types || rule.mime_types.includes(req.form.content_type)) {
                        const segment1 = Date.now().toString(36).padStart(8, '0').slice(-8)
                        const segment2 = Math.random().toString(36).substring(2, 10)
                        const segment3 = Buffer.from(Math.random().toString())
                            .toString('base64')
                            .replace(/[^a-zA-Z0-9]/g, '')
                            .substring(0, 8)

                        let extension = mime.getExtension(req.form.content_type)

                        const strongFilename = `${segment1}-${segment2}-${segment3}.${extension}`
                        const key = `${req.form.folder}/${strongFilename}`

                        const command = new PutObjectCommand({
                            Bucket: etherial.eth_media_leaf.bucket,
                            Key: key,
                            ACL: rule.visibility,
                            ContentType: req.form.content_type,
                            ContentLength: req.form.file_size,
                        })

                        const url = await getSignedUrl(etherial.eth_media_leaf.s3, command, { expiresIn: 60 * 15 })

                        let media = await Media.create({
                            key: key,
                            real_name: req.form.filename || strongFilename,
                            folder: req.form.folder,
                            name: strongFilename,
                            mime_type: req.form.content_type,
                            file_size: req.form.file_size,
                            status: MediaStatus.PENDING,
                            uploaded_by: req.user.id,
                            visibility: rule.visibility,
                        })

                        res.success({
                            status: 200,
                            data: {
                                id: media.id,
                                key: media.key,
                                upload_url: url,
                                expires_in: 60 * 15,
                            },
                        })
                    } else {
                        return res.error({
                            status: 400,
                            errors: [`api.media.mime_type_not_allowed`],
                        })
                    }
                } else {
                    return res.error({
                        status: 400,
                        errors: [`api.media.file_too_large`],
                    })
                }
            } else {
                return res.error({
                    status: 400,
                    errors: ['api.media.folder_not_found'],
                })
            }
        } catch (error) {
            console.error('Error requesting upload:', error)
            res.error({
                status: 500,
                errors: ['api.media.upload_request_failed'],
            })
        }
    }

    /**
     * Confirm Upload
     *
     * Confirms that the file has been uploaded to S3.
     * Verifies the file exists in S3 before marking as uploaded.
     *
     * @route POST /medias/:id(\\d+)/confirm
     * @access Private (requires authentication, must be owner)
     */
    @Post('/medias/:id(\\d+)/confirm')
    @ShouldBeAuthenticated()
    public async confirmUpload(req: Request & { user: UserBase }, res: Response): Promise<any> {
        try {
            const { Media } = getModels()
            const mediaId = parseInt(req.params.id, 10)

            const media = await Media.findOne({
                where: {
                    id: mediaId,
                    uploaded_by: req.user.id,
                },
            })

            if (!media) {
                return res.error({
                    status: 404,
                    errors: ['api.media.not_found'],
                })
            }

            if (media.status === MediaStatus.UPLOADED) {
                return res.error({
                    status: 400,
                    errors: ['api.media.already_confirmed'],
                })
            }

            // Verify file exists in S3
            const exists = await etherial.eth_media_leaf.fileExists(media.key)

            if (!exists) {
                return res.error({
                    status: 400,
                    errors: ['api.media.file_not_found_in_storage'],
                })
            }

            await media.update({
                status: MediaStatus.UPLOADED,
            })

            // Add to quota
            await etherial.eth_media_leaf.addToQuota(req.user.id, media.file_size)

            // Build response with URL
            let url: string | null = null

            if (media.visibility === 'public-read') {
                url = etherial.eth_media_leaf.getPublicUrl(media)
            }

            res.success({
                status: 200,
                data: {
                    id: media.id,
                    key: media.key,
                    name: media.name,
                    real_name: media.real_name,
                    mime_type: media.mime_type,
                    file_size: media.file_size,
                    visibility: media.visibility,
                    status: media.status,
                    url: url,
                },
            })
        } catch (error) {
            console.error('Error confirming upload:', error)
            res.error({
                status: 500,
                errors: ['api.media.confirm_failed'],
            })
        }
    }

    /**
     * Get Media
     *
     * Get a specific media by ID.
     * For private files, includes a signed URL if the user has access.
     *
     * @route GET /medias/:id
     * @access Private (requires authentication)
     */
    @Get('/medias/:id(\\d+)')
    @ShouldBeAuthenticated()
    public async getMedia(req: Request & { user: UserBase }, res: Response): Promise<any> {
        try {
            const { Media } = getModels()
            const mediaId = parseInt(req.params.id, 10)

            const media = await Media.findOne({
                where: {
                    id: mediaId,
                    status: MediaStatus.UPLOADED,
                },
            })

            if (!media) {
                return res.error({
                    status: 404,
                    errors: ['api.media.not_found'],
                })
            }

            // Check access
            const hasAccess = await etherial.eth_media_leaf.checkAccess(req, media)

            if (!hasAccess) {
                return res.error({
                    status: 403,
                    errors: ['api.media.access_denied'],
                })
            }

            // Build response with URL
            let url: string | null = null

            if (media.visibility === 'public-read') {
                url = etherial.eth_media_leaf.getPublicUrl(media)
            } else {
                // Private file - generate signed URL
                url = await etherial.eth_media_leaf.generateSignedUrl(media)
            }

            res.success({
                status: 200,
                data: {
                    id: media.id,
                    key: media.key,
                    name: media.name,
                    real_name: media.real_name,
                    folder: media.folder,
                    mime_type: media.mime_type,
                    file_size: media.file_size,
                    file_size_human: media.getHumanReadableSize(),
                    visibility: media.visibility,
                    url: url,
                    created_at: media.created_at,
                },
            })
        } catch (error) {
            console.error('Error getting media:', error)
            res.error({
                status: 500,
                errors: ['api.media.get_failed'],
            })
        }
    }

    /**
     * Get Media Access URL
     *
     * Generates a signed URL for accessing a private file.
     * Can specify custom expiration time.
     *
     * @route GET /medias/:id(\\d+)/access
     * @access Private (requires authentication + canAccess check)
     */
    @Get('/medias/:id(\\d+)/access')
    @ShouldBeAuthenticated()
    public async getMediaAccess(req: Request & { user: UserBase; query: { expires_in?: string } }, res: Response): Promise<any> {
        try {
            const { Media } = getModels()
            const mediaId = parseInt(req.params.id, 10)

            const media = await Media.findOne({
                where: {
                    id: mediaId,
                    status: MediaStatus.UPLOADED,
                },
            })

            if (!media) {
                return res.error({
                    status: 404,
                    errors: ['api.media.not_found'],
                })
            }

            // Check access using the rule's canAccess callback
            const hasAccess = await etherial.eth_media_leaf.checkAccess(req, media)

            if (!hasAccess) {
                return res.error({
                    status: 403,
                    errors: ['api.media.access_denied'],
                })
            }

            // For public files, just return the public URL
            if (media.visibility === 'public-read') {
                const url = etherial.eth_media_leaf.getPublicUrl(media)
                return res.success({
                    status: 200,
                    data: {
                        url: url,
                        expires_in: null,
                        is_public: true,
                    },
                })
            }

            // For private files, generate signed URL
            const expiresIn = req.query.expires_in ? parseInt(req.query.expires_in as string, 10) : undefined
            const url = await etherial.eth_media_leaf.generateSignedUrl(media, expiresIn)

            const rule = etherial.eth_media_leaf.getRuleForFolder(media.folder)
            const actualExpiration = expiresIn ?? rule?.signedUrlExpiration ?? 3600

            res.success({
                status: 200,
                data: {
                    url: url,
                    expires_in: actualExpiration,
                    is_public: false,
                },
            })
        } catch (error) {
            console.error('Error generating access URL:', error)
            res.error({
                status: 500,
                errors: ['api.media.access_url_failed'],
            })
        }
    }

    /**
     * Delete Media
     *
     * Delete a media file from both database and S3.
     * Only the owner can delete their own files.
     *
     * @route DELETE /medias/:id
     * @access Private (requires authentication, must be owner)
     */
    @Delete('/medias/:id')
    @ShouldBeAuthenticated()
    public async deleteMedia(req: Request & { user: UserBase }, res: Response): Promise<any> {
        try {
            const { Media } = getModels()
            const mediaId = parseInt(req.params.id, 10)

            const media = await Media.findOne({
                where: {
                    id: mediaId,
                    uploaded_by: req.user.id,
                },
            })

            if (!media) {
                return res.error({
                    status: 404,
                    errors: ['api.media.not_found'],
                })
            }

            // Delete from S3
            const deleted = await etherial.eth_media_leaf.deleteFile(media.key)

            if (!deleted) {
                console.warn(`Failed to delete file from S3: ${media.key}, but continuing with DB deletion`)
            }

            // Remove from quota
            await etherial.eth_media_leaf.removeFromQuota(req.user.id, media.file_size)

            // Delete from database
            await media.destroy()

            res.success({
                status: 200,
                data: {
                    deleted: true,
                    id: mediaId,
                },
            })
        } catch (error) {
            console.error('Error deleting media:', error)
            res.error({
                status: 500,
                errors: ['api.media.delete_failed'],
            })
        }
    }

    // ==================== BULK OPERATIONS ====================

    /**
     * Confirm Multiple Uploads
     *
     * Confirm that multiple files have been uploaded to S3.
     *
     * @route POST /medias/bulk/confirm
     * @access Private (requires authentication)
     */
    @Post('/medias/bulk/confirm')
    @ShouldBeAuthenticated()
    public async confirmBulk(req: Request & { user: UserBase; body: { ids: number[] } }, res: Response): Promise<any> {
        try {
            const { Media } = getModels()
            const { ids } = req.body

            if (!ids || !Array.isArray(ids) || ids.length === 0) {
                return res.error({
                    status: 400,
                    errors: ['api.media.ids_required'],
                })
            }

            if (ids.length > 50) {
                return res.error({
                    status: 400,
                    errors: ['api.media.too_many_ids'],
                })
            }

            const medias = await Media.findAll({
                where: {
                    id: ids,
                    uploaded_by: req.user.id,
                    status: MediaStatus.PENDING,
                },
            })

            const results: { id: number; success: boolean; error?: string }[] = []

            for (const media of medias) {
                try {
                    const exists = await etherial.eth_media_leaf.fileExists(media.key)

                    if (exists) {
                        await media.update({ status: MediaStatus.UPLOADED })

                        // Add to quota
                        await etherial.eth_media_leaf.addToQuota(req.user.id, media.file_size)

                        results.push({ id: media.id, success: true })
                    } else {
                        results.push({ id: media.id, success: false, error: 'file_not_found_in_storage' })
                    }
                } catch (error) {
                    results.push({ id: media.id, success: false, error: 'confirm_failed' })
                }
            }

            // Add not found ids
            const foundIds = medias.map(m => m.id)
            for (const id of ids) {
                if (!foundIds.includes(id)) {
                    results.push({ id, success: false, error: 'not_found_or_already_confirmed' })
                }
            }

            res.success({
                status: 200,
                data: {
                    total: ids.length,
                    confirmed: results.filter(r => r.success).length,
                    failed: results.filter(r => !r.success).length,
                    results,
                },
            })
        } catch (error) {
            console.error('Error confirming bulk upload:', error)
            res.error({
                status: 500,
                errors: ['api.media.bulk_confirm_failed'],
            })
        }
    }

    /**
     * Delete Multiple Medias
     *
     * Delete multiple media files from both database and S3.
     * Only the owner can delete their own files.
     *
     * @route DELETE /medias/bulk
     * @access Private (requires authentication)
     */
    @Delete('/medias/bulk')
    @ShouldBeAuthenticated()
    public async deleteBulk(req: Request & { user: UserBase; body: { ids: number[] } }, res: Response): Promise<any> {
        try {
            const { Media } = getModels()
            const { ids } = req.body

            if (!ids || !Array.isArray(ids) || ids.length === 0) {
                return res.error({
                    status: 400,
                    errors: ['api.media.ids_required'],
                })
            }

            if (ids.length > 50) {
                return res.error({
                    status: 400,
                    errors: ['api.media.too_many_ids'],
                })
            }

            const medias = await Media.findAll({
                where: {
                    id: ids,
                    uploaded_by: req.user.id,
                },
            })

            const results: { id: number; success: boolean; error?: string }[] = []

            for (const media of medias) {
                try {
                    // Delete from S3
                    await etherial.eth_media_leaf.deleteFile(media.key)

                    // Remove from quota
                    await etherial.eth_media_leaf.removeFromQuota(req.user.id, media.file_size)

                    // Delete from database
                    await media.destroy()

                    results.push({ id: media.id, success: true })
                } catch (error) {
                    results.push({ id: media.id, success: false, error: 'delete_failed' })
                }
            }

            // Add not found ids
            const foundIds = medias.map(m => m.id)
            for (const id of ids) {
                if (!foundIds.includes(id)) {
                    results.push({ id, success: false, error: 'not_found' })
                }
            }

            res.success({
                status: 200,
                data: {
                    total: ids.length,
                    deleted: results.filter(r => r.success).length,
                    failed: results.filter(r => !r.success).length,
                    results,
                },
            })
        } catch (error) {
            console.error('Error deleting bulk media:', error)
            res.error({
                status: 500,
                errors: ['api.media.bulk_delete_failed'],
            })
        }
    }

    // ==================== QUOTA ====================

    /**
     * Get User Quota
     *
     * Get the current user's storage quota and usage.
     *
     * @route GET /medias/quota
     * @access Private (requires authentication)
     */
    @Get('/medias/quota')
    @ShouldBeAuthenticated()
    public async getUserQuota(req: Request & { user: UserBase }, res: Response): Promise<any> {
        try {
            if (!etherial.eth_media_leaf.isQuotaEnabled()) {
                return res.success({
                    status: 200,
                    data: {
                        enabled: false,
                        message: 'Quota tracking is not enabled',
                    },
                })
            }

            const quota = await etherial.eth_media_leaf.getOrCreateQuota(req.user.id)
            const globalQuota = etherial.eth_media_leaf.getDefaultQuota()

            res.success({
                status: 200,
                data: {
                    enabled: true,
                    storage_used: Number(quota.storage_used),
                    storage_used_human: quota.getStorageUsedHuman(),
                    storage_limit: quota.custom_quota ?? globalQuota,
                    storage_limit_human: quota.getQuotaLimitHuman(globalQuota),
                    storage_remaining: quota.getRemainingStorage(globalQuota),
                    usage_percentage: quota.getUsagePercentage(globalQuota),
                    file_count: quota.file_count,
                    has_custom_quota: quota.custom_quota !== null,
                },
            })
        } catch (error) {
            console.error('Error getting user quota:', error)
            res.error({
                status: 500,
                errors: ['api.media.quota_failed'],
            })
        }
    }

    // ==================== TRANSFORMS ====================

    /**
     * Get Transformed Image
     *
     * Returns a transformed version of an image.
     * Supports resize, format conversion, and quality adjustment.
     *
     * Query params:
     * - w: width (max 2000)
     * - h: height (max 2000)
     * - fit: cover | contain | fill | inside | outside (default: cover)
     * - format: jpeg | webp | png | avif (default: webp)
     * - q: quality 1-100 (default: 80)
     *
     * @route GET /medias/:id(\\d+)/transform
     * @access Private (requires authentication + access check)
     */
    @Get('/medias/:id(\\d+)/transform')
    @ShouldBeAuthenticated()
    public async getMediaTransform(
        req: Request & {
            user: UserBase
            query: { w?: string; h?: string; fit?: string; format?: string; q?: string }
        },
        res: Response
    ): Promise<any> {
        try {
            const { Media } = getModels()

            if (!etherial.eth_media_leaf.isTransformEnabled()) {
                return res.error({
                    status: 400,
                    errors: ['api.media.transforms_not_enabled'],
                })
            }

            const mediaId = parseInt(req.params.id, 10)

            const media = await Media.findOne({
                where: {
                    id: mediaId,
                    status: MediaStatus.UPLOADED,
                },
            })

            if (!media) {
                return res.error({
                    status: 404,
                    errors: ['api.media.not_found'],
                })
            }

            // Check access
            const hasAccess = await etherial.eth_media_leaf.checkAccess(req, media)
            if (!hasAccess) {
                return res.error({
                    status: 403,
                    errors: ['api.media.access_denied'],
                })
            }

            // Check if media can be transformed
            if (!etherial.eth_media_leaf.canTransform(media)) {
                return res.error({
                    status: 400,
                    errors: ['api.media.cannot_transform'],
                })
            }

            // Parse and validate params
            const config = etherial.eth_media_leaf.getTransformConfig()
            const params: { w?: number; h?: number; fit?: any; format?: any; q?: number } = {}

            if (req.query.w) {
                params.w = Math.min(parseInt(req.query.w, 10), config.maxWidth)
            }
            if (req.query.h) {
                params.h = Math.min(parseInt(req.query.h, 10), config.maxHeight)
            }
            if (req.query.fit && ['cover', 'contain', 'fill', 'inside', 'outside'].includes(req.query.fit)) {
                params.fit = req.query.fit as any
            }
            if (req.query.format && config.allowedFormats.includes(req.query.format as any)) {
                params.format = req.query.format as any
            }
            if (req.query.q) {
                params.q = Math.min(Math.max(parseInt(req.query.q, 10), 1), 100)
            }

            // At least one dimension must be specified
            if (!params.w && !params.h) {
                return res.error({
                    status: 400,
                    errors: ['api.media.transform_dimensions_required'],
                })
            }

            // Transform the image
            const result = await etherial.eth_media_leaf.transformImage(media, params)

            res.success({
                status: 200,
                data: {
                    url: result.url,
                    cached: result.cached,
                    original: {
                        id: media.id,
                        name: media.name,
                        mime_type: media.mime_type,
                    },
                    transform: {
                        width: params.w,
                        height: params.h,
                        fit: params.fit || 'cover',
                        format: params.format || 'webp',
                        quality: params.q || config.defaultQuality,
                    },
                },
            })
        } catch (error) {
            console.error('Error transforming media:', error)
            res.error({
                status: 500,
                errors: ['api.media.transform_failed'],
            })
        }
    }
}
