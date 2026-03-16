import * as yup from 'yup'

export const CampaignForm = yup.object({
    message: yup.string().required('message_required').min(1).max(500),
    url: yup.string().url().optional().nullable(),
    data: yup.object().optional().nullable(),
    target_logged_user: yup.boolean().default(true),
    target_not_logged_user: yup.boolean().default(false),
})

export type CampaignFormType = yup.InferType<typeof CampaignForm>
