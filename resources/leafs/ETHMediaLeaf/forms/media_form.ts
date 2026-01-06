import { EtherialYup } from 'etherial/components/http/yup.validator'
import { InferType } from 'yup'

/**
 * Form for requesting a presigned upload URL
 */
export const MediaFormRequest = EtherialYup.object({
    folder: EtherialYup.string().required(),
    content_type: EtherialYup.string().required(),
    filename: EtherialYup.string().optional(),
    file_size: EtherialYup.number().required().positive('File size must be positive'),
}).required()

export type MediaFormRequestType = InferType<typeof MediaFormRequest>

/**
 * Query params for getting a signed access URL
 */
export const MediaAccessForm = EtherialYup.object({
    expires_in: EtherialYup.number()
        .optional()
        .min(60, 'Minimum expiration is 60 seconds')
        .max(604800, 'Maximum expiration is 7 days (604800 seconds)'),
})

export type MediaAccessFormType = InferType<typeof MediaAccessForm>
