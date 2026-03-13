import { EtherialYup } from 'etherial/components/http/yup.validator';
export const UpdatePasswordForm = EtherialYup.object({
    current_password: EtherialYup.string().required(),
    new_password: EtherialYup.string().required(),
}).required();
export const PasswordResetRequestForm = EtherialYup.object({
    email: EtherialYup.string().email().required(),
}).required();
export const PasswordResetConfirmForm = EtherialYup.object({
    email: EtherialYup.string().email().required(),
    token: EtherialYup.string().required(),
    new_password: EtherialYup.string().required(),
}).required();
export const EmailValidationSendForm = EtherialYup.object({}).required();
export const EmailValidationConfirmForm = EtherialYup.object({
    token: EtherialYup.string().required(),
}).required();
export const UpdateBioForm = EtherialYup.object({
    bio: EtherialYup.string().required(),
}).required();
export const CreatePasswordForm = EtherialYup.object({
    password: EtherialYup.string().required(),
}).required();
export const UpdateAvatarForm = EtherialYup.object({
    avatar: EtherialYup.string()
        // .shouldBeS3File(S3FoldersKeys.USER_AVATAR, 'Avatar must be a valid file')
        .required(),
}).required();
