import { body, query, ValidationChain } from 'express-validator';
export { ValidationChain };
export { body };
export { query };
export declare const FormGenerator: (elements: any) => any[];
export declare const Form: () => ClassDecorator;
export declare const AddValidation: (cb: () => any) => PropertyDecorator;
export declare const Body: () => PropertyDecorator;
export declare const Query: () => PropertyDecorator;
export declare const ShouldExist: () => PropertyDecorator;
export declare const ShouldBeNotEmpty: () => PropertyDecorator;
export declare const ShouldMatch: (regex: RegExp) => PropertyDecorator;
export declare const ShouldBeEmail: (options: any) => PropertyDecorator;
export declare const ShouldExistInModel: (model: any, column: string) => PropertyDecorator;
export declare const ShouldNotExistInModel: (model: any, column: string) => PropertyDecorator;
export declare const ShouldCustom: (cb: () => void) => PropertyDecorator;
export declare const ShouldBeEqualTo: (field: string) => PropertyDecorator;
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
