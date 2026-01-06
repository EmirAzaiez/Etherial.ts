import etherial from 'etherial'

import { Controller, Post, Get, Delete, Request, Response } from 'etherial/components/http/provider'

import { ShouldValidateYupForm } from 'etherial/components/http/yup.validator'
import { ShouldBeAuthentificate } from 'etherial/components/http.security/provider'

import { User } from '../../models/User'
import { Media, MediaStatus } from '../models/Media'

import {
    MediaFormRequest,
    MediaFormRequestType,
    MediaAccessForm,
    MediaAccessFormType,
} from '../forms/media_form'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import mime from 'mime'

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
    @ShouldBeAuthentificate()
    public async requestUpload(req: Request & { form: MediaFormRequestType; user: User }, res: Response): Promise<any> {
        try {
            const rule = etherial.eth_media_leaf.config.rules.find((rule) => rule.folders.includes(req.form.folder))

            if (rule) {
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
     * @route POST /medias/:id/confirm
     * @access Private (requires authentication, must be owner)
     */
    @Post('/medias/:id/confirm')
    @ShouldBeAuthentificate()
    public async confirmUpload(req: Request & { user: User }, res: Response): Promise<any> {
        try {
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
    @Get('/medias/:id')
    @ShouldBeAuthentificate()
    public async getMedia(req: Request & { user: User }, res: Response): Promise<any> {
        try {
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
     * @route GET /medias/:id/access
     * @access Private (requires authentication + canAccess check)
     */
    @Get('/medias/:id/access')
    @ShouldBeAuthentificate()
    public async getMediaAccess(req: Request & { user: User; query: MediaAccessFormType }, res: Response): Promise<any> {
        try {
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
    @ShouldBeAuthentificate()
    public async deleteMedia(req: Request & { user: User }, res: Response): Promise<any> {
        try {
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
}
