import etherial from 'etherial'
import { EtherialYup } from 'etherial/components/http/yup.validator'
import { InferType } from 'yup'

const getUserModel = () => etherial.database!.sequelize.models.User as any

export const PhoneValidationSendForm = EtherialYup.object({
    phone: EtherialYup.string()
        .optional()
        .shouldNotExistInModel(getUserModel(), 'phone', `phone already exists in database`)
        .matches(/^\+\d{1,15}$/, 'Phone number must include country code, e.g., +123456789'),
}).required()

export type PhoneValidationSendFormType = InferType<typeof PhoneValidationSendForm>

export const PhoneValidationConfirmForm = EtherialYup.object({
    token: EtherialYup.string().required(),
}).required()

export type PhoneValidationConfirmFormType = InferType<typeof PhoneValidationConfirmForm>
