import { Request, Response } from 'etherial/components/http/provider';
import { UserLeafBase } from '../models/User.js';
import { UpdateBioFormType, UpdateAvatarFormType } from '../forms/user_form.js';
export default class ETHUserLeafController {
    /**
     * Update User Bio
     *
     * Updates the authenticated user's bio field.
     *
     * @route PUT /users/me/bio
     * @access Private (requires authentication)
     * @param {Request} req - Request object containing form data and authenticated user
     * @param {string} req.form.bio - New bio text (validated by UpdateBioForm)
     * @param {Response} res - Response object
     *
     * @returns {Promise<any>} JSON response with success/error status
     *
     * @success {200} Bio updated successfully
     * @error {400} Invalid bio data (handled by form validation)
     * @error {404} User not found
     * @error {500} Internal server error
     *
     * @example
     * Request Body:
     * {
     *   "bio": "This is my new bio"
     * }
     *
     * Success Response:
     * {
     *   "status": 200,
     *   "data": {
     *     "message": "Bio updated successfully",
     *     "bio": "This is my new bio"
     *   }
     * }
     */
    updateUserMeBio(req: Request & {
        form: UpdateBioFormType;
        user: UserLeafBase;
    }, res: Response): Promise<any>;
    updateUserMeAvatar(req: Request & {
        form: UpdateAvatarFormType;
        user: UserLeafBase;
    }, res: Response): Promise<any>;
}
