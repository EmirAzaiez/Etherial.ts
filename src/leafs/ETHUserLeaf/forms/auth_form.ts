import { EtherialYup } from 'etherial/components/http/yup.validator'
import { InferType } from 'yup'

export const AuthFormEmail = EtherialYup.object({
    email: EtherialYup.string().email().required(),
    password: EtherialYup.string().required(),
    device: EtherialYup.string()
        .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, 'device must be a valid UUID v4')
        .optional(),
}).required()

export type AuthFormEmailType = InferType<typeof AuthFormEmail>

export const AuthFormUsername = EtherialYup.object({
    username: EtherialYup.string().required(),
    password: EtherialYup.string().required(),
    device: EtherialYup.string()
        .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, 'device must be a valid UUID v4')
        .optional(),
}).required()

export type AuthFormUsernameType = InferType<typeof AuthFormUsername>

export const AuthFormGoogle = EtherialYup.object({
    google_token: EtherialYup.string().required(),
}).required()

export type AuthFormGoogleType = InferType<typeof AuthFormGoogle>

export const AuthFormApple = EtherialYup.object({
    apple_token: EtherialYup.string().required(),
    firstname: EtherialYup.string().optional(),
    lastname: EtherialYup.string().optional(),
}).required()

export type AuthFormAppleType = InferType<typeof AuthFormApple>
