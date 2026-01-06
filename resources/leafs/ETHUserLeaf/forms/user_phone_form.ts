import { EtherialYup } from 'etherial/components/http/yup.validator'
import { User } from '../../models/User'
import { InferType } from 'yup'

export const PhoneValidationSendForm = EtherialYup.object({
    phone: EtherialYup.string()
        .optional()
        .shouldNotExistInModel(User, 'phone', `phone already exists in database`)
        .matches(/^\+\d{1,15}$/, 'Phone number must include country code, e.g., +123456789'),
}).required()

export type PhoneValidationSendFormType = InferType<typeof PhoneValidationSendForm>

export const PhoneValidationConfirmForm = EtherialYup.object({
    token: EtherialYup.string().required(),
}).required()

export type PhoneValidationConfirmFormType = InferType<typeof PhoneValidationConfirmForm>
