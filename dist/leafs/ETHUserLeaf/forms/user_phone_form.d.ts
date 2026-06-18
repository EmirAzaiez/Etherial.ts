import { InferType } from 'yup';
export declare const PhoneValidationSendForm: import("yup").ObjectSchema<{
    phone: string;
}, import("yup").AnyObject, {
    phone: undefined;
}, "">;
export type PhoneValidationSendFormType = InferType<typeof PhoneValidationSendForm>;
export declare const PhoneValidationConfirmForm: import("yup").ObjectSchema<{
    token: string;
}, import("yup").AnyObject, {
    token: undefined;
}, "">;
export type PhoneValidationConfirmFormType = InferType<typeof PhoneValidationConfirmForm>;
