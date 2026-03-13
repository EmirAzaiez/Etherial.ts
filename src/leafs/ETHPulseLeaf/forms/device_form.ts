import { EtherialYup } from 'etherial/components/http/yup.validator'
import { InferType } from 'yup'

import { DevicePlatform } from '../models/Device'

export const RegisterDeviceForm = EtherialYup.object({
    device: EtherialYup.string()
        .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, 'device must be a valid UUID v4')
        .required(),
    platform: EtherialYup.number().oneOf([DevicePlatform.WEB, DevicePlatform.ANDROID, DevicePlatform.IOS]).optional(),
    push_token: EtherialYup.string().optional(),
    locale: EtherialYup.string().optional(),
    tz: EtherialYup.string().optional(),
    brand: EtherialYup.string().optional(),
    model: EtherialYup.string().optional(),
    os_version: EtherialYup.string().optional(),
    app_version: EtherialYup.string().optional(),
    user_agent: EtherialYup.string().optional(),
}).required()

export type RegisterDeviceFormType = InferType<typeof RegisterDeviceForm>

export const RevokeDeviceForm = EtherialYup.object({
    device: EtherialYup.string()
        .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, 'device must be a valid UUID v4')
        .required(),
}).required()

export type RevokeDeviceFormType = InferType<typeof RevokeDeviceForm>
