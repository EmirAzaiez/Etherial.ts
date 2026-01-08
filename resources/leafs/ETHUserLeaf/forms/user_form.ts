import { EtherialYup } from 'etherial/components/http/yup.validator'
// import { EtherialYupS3 } from 'etherial/leafs/s3/extensions/http/yup.validator'
// import { S3FoldersKeys } from '../../constants.ts'
import { InferType } from 'yup'

export const UpdatePasswordForm = EtherialYup.object({
    current_password: EtherialYup.string().required(),
    new_password: EtherialYup.string().required(),
}).required()

export const PasswordResetRequestForm = EtherialYup.object({
    email: EtherialYup.string().email().required(),
}).required()

export const PasswordResetConfirmForm = EtherialYup.object({
    email: EtherialYup.string().email().required(),
    token: EtherialYup.string().required(),
    new_password: EtherialYup.string().required(),
}).required()

export const EmailValidationSendForm = EtherialYup.object({}).required()

export const EmailValidationConfirmForm = EtherialYup.object({
    token: EtherialYup.string().required(),
}).required()

export const UpdateBioForm = EtherialYup.object({
    bio: EtherialYup.string().required(),
}).required()

export const CreatePasswordForm = EtherialYup.object({
    password: EtherialYup.string().required(),
}).required()

export const UpdateAvatarForm = EtherialYup.object({
    avatar: EtherialYup.string().required(),
    // avatar: EtherialYupS3.string().shouldBeS3File(S3FoldersKeys.USER_AVATAR, 'Avatar must be a valid file').required(),
}).required()

export type UpdatePasswordFormType = InferType<typeof UpdatePasswordForm>
export type PasswordResetRequestFormType = InferType<typeof PasswordResetRequestForm>
export type PasswordResetConfirmFormType = InferType<typeof PasswordResetConfirmForm>
export type EmailValidationSendFormType = InferType<typeof EmailValidationSendForm>
export type EmailValidationConfirmFormType = InferType<typeof EmailValidationConfirmForm>
export type UpdateBioFormType = InferType<typeof UpdateBioForm>
export type CreatePasswordFormType = InferType<typeof CreatePasswordForm>
export type UpdateAvatarFormType = InferType<typeof UpdateAvatarForm>
