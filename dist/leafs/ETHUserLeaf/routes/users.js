var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import etherial from 'etherial';
import { Controller, Put } from 'etherial/components/http/provider';
import { ShouldValidateYupForm } from 'etherial/components/http/yup.validator';
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
import { UpdateBioForm, UpdateAvatarForm } from '../forms/user_form.js';
const getModels = () => {
    const models = etherial.database.sequelize.models;
    return {
        User: models.User,
    };
};
let ETHUserLeafController = class ETHUserLeafController {
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
    updateUserMeBio(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield req.user.update({
                    bio: req.form.bio,
                });
                res.success({
                    status: 200,
                    data: {
                        bio: req.user.bio,
                    },
                });
            }
            catch (error) {
                console.error('Error updating user bio:', error);
                res.error({
                    status: 500,
                    errors: ['api.internal_error'],
                });
            }
        });
    }
    updateUserMeAvatar(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (req.user.avatar != req.form.avatar) {
                    if (req.user.avatar !== etherial.eth_user_leaf.default_avatar) {
                        yield etherial.eth_media_leaf.deleteFile(`${etherial.eth_user_leaf.avatar_s3_folder}/${req.user.avatar}`);
                    }
                    yield req.user.update({
                        avatar: req.form.avatar,
                    });
                }
                res.success({
                    status: 200,
                    data: {
                        avatar: req.user.avatar,
                    },
                });
            }
            catch (error) {
                console.error('Error updating user avatar:', error);
                res.error({
                    status: 500,
                    errors: ['api.internal_error'],
                });
            }
        });
    }
};
__decorate([
    Put('/users/me/bio'),
    ShouldBeAuthenticated(),
    ShouldValidateYupForm(UpdateBioForm),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHUserLeafController.prototype, "updateUserMeBio", null);
__decorate([
    Put('/users/me/avatar'),
    ShouldBeAuthenticated(),
    ShouldValidateYupForm(UpdateAvatarForm),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHUserLeafController.prototype, "updateUserMeAvatar", null);
ETHUserLeafController = __decorate([
    Controller()
], ETHUserLeafController);
export default ETHUserLeafController;
