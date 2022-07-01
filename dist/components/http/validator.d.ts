import { body, query, ValidationChain } from 'express-validator';
export { ValidationChain };
export { body };
export { query };
export declare const FormGenerator: (elements: any) => any[];
export declare const Form: () => ClassDecorator;
export declare const AddValidation: (cb: any) => PropertyDecorator;
export declare const Body: () => PropertyDecorator;
export declare const Query: () => PropertyDecorator;
export declare const ShouldExist: () => PropertyDecorator;
export declare const ShouldBeNotEmpty: () => PropertyDecorator;
export declare const ShouldMatch: (regex: any) => PropertyDecorator;
export declare const ShouldBeEmail: (options: any) => PropertyDecorator;
export declare const ShouldExistInModel: (model: any, column: any) => PropertyDecorator;
export declare const ShouldNotExistInModel: (model: any, column: any) => PropertyDecorator;
export declare const ShouldCustom: (cb: any) => PropertyDecorator;
export declare const ShouldBeS3File: (s3: any, folder: any) => PropertyDecorator;
export declare const ShouldBeEqualTo: (field: any) => PropertyDecorator;
export declare const ShouldBeISO8601Date: () => PropertyDecorator;
export declare const ShouldHaveMinMaxLength: (min: any, max: any) => PropertyDecorator;
export declare const ShouldHaveMinLength: (min: any) => PropertyDecorator;
export declare const ShouldHaveMaxLength: (max: any) => PropertyDecorator;
export declare const ShouldValidateForm: (form: any, exclude_validator?: boolean) => MethodDecorator;
/**
 * @deprecated The method should not be used, use instead ShouldValidateForm
 */
export declare const UseForm: (form: any, exclude_validator?: boolean) => MethodDecorator;
export declare const custom: {
    equalTo: (field: any, value: any, obj: any) => void;
    checkS3File: (s3: any, folder: any) => void;
};
