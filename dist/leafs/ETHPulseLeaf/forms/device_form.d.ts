import { InferType } from 'yup';
export declare const RegisterDeviceForm: import("yup").ObjectSchema<{
    device: string;
    platform: number;
    push_token: string;
    locale: string;
    tz: string;
    brand: string;
    model: string;
    os_version: string;
    app_version: string;
    user_agent: string;
}, import("yup").AnyObject, {
    device: undefined;
    platform: undefined;
    push_token: undefined;
    locale: undefined;
    tz: undefined;
    brand: undefined;
    model: undefined;
    os_version: undefined;
    app_version: undefined;
    user_agent: undefined;
}, "">;
export type RegisterDeviceFormType = InferType<typeof RegisterDeviceForm>;
export declare const RevokeDeviceForm: import("yup").ObjectSchema<{
    device: string;
}, import("yup").AnyObject, {
    device: undefined;
}, "">;
export type RevokeDeviceFormType = InferType<typeof RevokeDeviceForm>;
