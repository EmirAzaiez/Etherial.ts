import * as yup from 'yup';
export declare const CampaignForm: yup.ObjectSchema<{
    message: string;
    url: string;
    data: {};
    target_logged_user: boolean;
    target_not_logged_user: boolean;
}, yup.AnyObject, {
    message: undefined;
    url: undefined;
    data: {};
    target_logged_user: true;
    target_not_logged_user: false;
}, "">;
export type CampaignFormType = yup.InferType<typeof CampaignForm>;
