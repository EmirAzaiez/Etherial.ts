import etherial from 'etherial'

import { Controller, Put, Request, Response } from 'etherial/components/http/provider'

import { ShouldValidateYupForm } from 'etherial/components/http/yup.validator'

import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'

import { User } from '../../models/User'

import { UpdateBioForm, UpdateBioFormType, UpdateAvatarForm, UpdateAvatarFormType } from '../forms/user_form'
// import { S3FoldersKeys } from '../../constants.ts'

@Controller()
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
    @Put('/users/me/bio')
    @ShouldBeAuthenticated()
    @ShouldValidateYupForm(UpdateBioForm)
    public async updateUserMeBio(req: Request & { form: UpdateBioFormType; user: User }, res: Response): Promise<any> {
        try {
            await req.user.update({
                bio: req.form.bio,
            })

            res.success({
                status: 200,
                data: {
                    bio: req.user.bio,
                },
            })
        } catch (error) {
            console.error('Error updating user bio:', error)
            res.error({
                status: 500,
                errors: ['api.internal_error'],
            })
        }
    }

    @Put('/users/me/avatar')
    @ShouldBeAuthenticated()
    @ShouldValidateYupForm(UpdateAvatarForm)
    public async updateUserMeAvatar(req: Request & { form: UpdateAvatarFormType; user: User }, res: Response): Promise<any> {
        // try {
        //     if (req.user.avatar != req.form.avatar) {
        //         if (req.user.avatar !== etherial.eth_user_leaf.default_avatar) {
        //             await etherial.leaf_s3.deleteFile(S3FoldersKeys.USER_AVATAR, req.user.avatar)
        //         }

        //         await req.user.update({
        //             avatar: req.form.avatar,
        //         })
        //     }

        //     res.success({
        //         status: 200,
        //         data: {
        //             avatar: req.user.avatar,
        //         },
        //     })
        // } catch (error) {
        //     console.error('Error updating user avatar:', error)
        //     res.error({
        //         status: 500,
        //         errors: ['api.internal_error'],
        //     })
        // }
    }
}
