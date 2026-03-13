import { Request, Response } from '../../../components/http/provider.js';
import { MediaFormRequestType } from '../forms/media_form.js';
interface UserBase {
    id: number;
    [key: string]: any;
}
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
    requestUpload(req: Request & {
        form: MediaFormRequestType;
        user: UserBase;
    }, res: Response): Promise<any>;
    /**
     * Confirm Upload
     *
     * Confirms that the file has been uploaded to S3.
     * Verifies the file exists in S3 before marking as uploaded.
     *
     * @route POST /medias/:id(\\d+)/confirm
     * @access Private (requires authentication, must be owner)
     */
    confirmUpload(req: Request & {
        user: UserBase;
    }, res: Response): Promise<any>;
    /**
     * Get Media
     *
     * Get a specific media by ID.
     * For private files, includes a signed URL if the user has access.
     *
     * @route GET /medias/:id
     * @access Private (requires authentication)
     */
    getMedia(req: Request & {
        user: UserBase;
    }, res: Response): Promise<any>;
    /**
     * Get Media Access URL
     *
     * Generates a signed URL for accessing a private file.
     * Can specify custom expiration time.
     *
     * @route GET /medias/:id(\\d+)/access
     * @access Private (requires authentication + canAccess check)
     */
    getMediaAccess(req: Request & {
        user: UserBase;
        query: {
            expires_in?: string;
        };
    }, res: Response): Promise<any>;
    /**
     * Delete Media
     *
     * Delete a media file from both database and S3.
     * Only the owner can delete their own files.
     *
     * @route DELETE /medias/:id
     * @access Private (requires authentication, must be owner)
     */
    deleteMedia(req: Request & {
        user: UserBase;
    }, res: Response): Promise<any>;
    /**
     * Confirm Multiple Uploads
     *
     * Confirm that multiple files have been uploaded to S3.
     *
     * @route POST /medias/bulk/confirm
     * @access Private (requires authentication)
     */
    confirmBulk(req: Request & {
        user: UserBase;
        body: {
            ids: number[];
        };
    }, res: Response): Promise<any>;
    /**
     * Delete Multiple Medias
     *
     * Delete multiple media files from both database and S3.
     * Only the owner can delete their own files.
     *
     * @route DELETE /medias/bulk
     * @access Private (requires authentication)
     */
    deleteBulk(req: Request & {
        user: UserBase;
        body: {
            ids: number[];
        };
    }, res: Response): Promise<any>;
    /**
     * Get User Quota
     *
     * Get the current user's storage quota and usage.
     *
     * @route GET /medias/quota
     * @access Private (requires authentication)
     */
    getUserQuota(req: Request & {
        user: UserBase;
    }, res: Response): Promise<any>;
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
    getMediaTransform(req: Request & {
        user: UserBase;
        query: {
            w?: string;
            h?: string;
            fit?: string;
            format?: string;
            q?: string;
        };
    }, res: Response): Promise<any>;
}
export {};
