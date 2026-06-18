import { InferType } from 'yup';
export declare const UpdatePasswordForm: import("yup").ObjectSchema<{
    current_password: string;
    new_password: string;
}, import("yup").AnyObject, {
    current_password: undefined;
    new_password: undefined;
}, "">;
export declare const PasswordResetRequestForm: import("yup").ObjectSchema<{
    email: string;
}, import("yup").AnyObject, {
    email: undefined;
}, "">;
export declare const PasswordResetConfirmForm: import("yup").ObjectSchema<{
    email: string;
    token: string;
    new_password: string;
}, import("yup").AnyObject, {
    email: undefined;
    token: undefined;
    new_password: undefined;
}, "">;
export declare const EmailValidationSendForm: import("yup").ObjectSchema<{}, import("yup").AnyObject, {}, "">;
export declare const EmailValidationConfirmForm: import("yup").ObjectSchema<{
    token: string;
}, import("yup").AnyObject, {
    token: undefined;
}, "">;
export declare const UpdateBioForm: import("yup").ObjectSchema<{
    bio: string;
}, import("yup").AnyObject, {
    bio: undefined;
}, "">;
export declare const CreatePasswordForm: import("yup").ObjectSchema<{
    password: string;
}, import("yup").AnyObject, {
    password: undefined;
}, "">;
export declare const UpdateAvatarForm: import("yup").ObjectSchema<{
    avatar: string;
}, import("yup").AnyObject, {
    avatar: undefined;
}, "">;
export type UpdatePasswordFormType = InferType<typeof UpdatePasswordForm>;
export type PasswordResetRequestFormType = InferType<typeof PasswordResetRequestForm>;
export type PasswordResetConfirmFormType = InferType<typeof PasswordResetConfirmForm>;
export type EmailValidationSendFormType = InferType<typeof EmailValidationSendForm>;
export type EmailValidationConfirmFormType = InferType<typeof EmailValidationConfirmForm>;
export type UpdateBioFormType = InferType<typeof UpdateBioForm>;
export type CreatePasswordFormType = InferType<typeof CreatePasswordForm>;
export type UpdateAvatarFormType = InferType<typeof UpdateAvatarForm>;
