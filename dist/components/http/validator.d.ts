import { body, query, ValidationChain } from 'express-validator';
import { Request } from './provider';
export { ValidationChain };
export { body };
export { query };
export declare const FormGenerator: (elements: any) => any[];
export declare const Form: (name?: string) => ClassDecorator;
export declare const AddValidation: (cb: () => any) => PropertyDecorator;
export declare const Body: () => PropertyDecorator;
export declare const Query: () => PropertyDecorator;
export declare const ModelInstance: (property: any) => PropertyDecorator;
export declare const ShouldBeOptional: () => PropertyDecorator;
export declare const ShouldExist: () => PropertyDecorator;
export declare const ShouldBeNotEmpty: () => PropertyDecorator;
export declare const ShouldMatch: (regex: RegExp) => PropertyDecorator;
export declare const ShouldBeEmail: (options: any) => PropertyDecorator;
export declare const ShouldBeArray: (options: any) => PropertyDecorator;
export declare const ShouldExistInModel: (model: any, column: string) => PropertyDecorator;
export declare const ShouldNotExistInModel: (model: any, column: string) => PropertyDecorator;
export declare const ShouldValidateCustom: (cb: (value: string, meta: {
    req: Request;
    path: string;
}) => Promise<any>) => PropertyDecorator;
export declare const ShouldSanitizeCustom: (cb: (value: string, meta: {
    req: Request;
    path: string;
}) => Promise<any>) => PropertyDecorator;
export declare const ShouldSanitizeToLowerCase: () => PropertyDecorator;
export declare const ShouldSanitizeToUpperCase: () => PropertyDecorator;
export declare const ShouldSanitizeToDefaultValue: (value: string) => PropertyDecorator;
export declare const ShouldBeEqualTo: (field: string) => PropertyDecorator;
export declare const ShouldBeBoolean: () => PropertyDecorator;
export declare const ShouldBeDate: (format: string) => PropertyDecorator;
export declare const ShouldBeISO8601Date: () => PropertyDecorator;
export declare const ShouldHaveMinMaxLength: (min: number, max: number) => PropertyDecorator;
export declare const ShouldHaveMinLength: (min: number) => PropertyDecorator;
export declare const ShouldHaveMaxLength: (max: number) => PropertyDecorator;
export declare const ShouldBeMobilePhone: (locale: string) => PropertyDecorator;
type ShouldValidateFormOptions = {
    exclude_validator?: boolean;
    include_optionals?: boolean;
};
export declare const ShouldValidateForm: (form: any, options?: ShouldValidateFormOptions) => (target: any, propertyKey: string) => void;
/**
 * @deprecated The method should not be used, use instead ShouldValidateForm
 */
export declare const UseForm: (form: any, options?: ShouldValidateFormOptions) => (target: any, propertyKey: string) => void;
/**
 * @deprecated The method should not be used, use instead ShouldValidateForm
 */
export declare const ShouldCustom: (cb: (value: string, meta: {
    req: Request;
    path: string;
}) => Promise<any>) => PropertyDecorator;
