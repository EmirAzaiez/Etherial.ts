import { InferType } from 'yup';
/**
 * Form for requesting a presigned upload URL
 */
export declare const MediaFormRequest: import("yup").ObjectSchema<{
    folder: string;
    content_type: string;
    filename: string;
    file_size: number;
}, import("yup").AnyObject, {
    folder: undefined;
    content_type: undefined;
    filename: undefined;
    file_size: undefined;
}, "">;
export type MediaFormRequestType = InferType<typeof MediaFormRequest>;
/**
 * Query params for getting a signed access URL
 */
export declare const MediaAccessForm: import("yup").ObjectSchema<{
    expires_in: number;
}, import("yup").AnyObject, {
    expires_in: undefined;
}, "">;
export type MediaAccessFormType = InferType<typeof MediaAccessForm>;
