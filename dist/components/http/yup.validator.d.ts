import * as yup from 'yup';
declare module 'yup' {
    interface StringSchema {
        shouldNotExistInModel(model: any, column: string, message?: string): StringSchema;
        shouldExistInModel(model: any, column: string, message?: string): StringSchema;
        shouldMatchField(fieldName: string, message?: string): StringSchema;
    }
    interface NumberSchema {
        shouldNotExistInModel(model: any, column: string, message?: string): NumberSchema;
        shouldExistInModel(model: any, column: string, message?: string): NumberSchema;
    }
    interface MixedSchema {
        shouldNotExistInModel(model: any, column: string, message?: string): MixedSchema;
        shouldExistInModel(model: any, column: string, message?: string): MixedSchema;
    }
}
export declare const EtherialYup: typeof yup;
export declare const object: typeof yup.object, string: typeof yup.string, number: typeof yup.number, boolean: typeof yup.bool, date: typeof yup.date, array: typeof yup.array, mixed: typeof yup.mixed;
export declare const ShouldValidateYupForm: (schema: any, location?: "body" | "query" | "params") => (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => void;
/**
 * @deprecated The method should not be used, use instead ShouldValidateYupForm
 */
export declare const UseYupForm: (schema: any, location?: "body" | "query" | "params") => (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => void;
