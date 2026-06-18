declare module 'yup' {
    interface StringSchema {
        shouldNotExistInModel(model: any, column: string, message?: string): StringSchema;
        shouldExistInModel(model: any, column: string, message?: string): StringSchema;
        shouldMatchField(fieldName: string, message?: string): StringSchema;
        shouldBeStrongPassword(message?: string): StringSchema;
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
export declare const EtherialYup: any;
export declare const object: any, string: any, number: any, boolean: any, date: any, array: any, mixed: any;
export declare const ShouldValidateYupForm: (schema: any, location?: "body" | "query" | "params") => (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => void;
/**
 * @deprecated The method should not be used, use instead ShouldValidateYupForm
 */
export declare const UseYupForm: (schema: any, location?: "body" | "query" | "params") => (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => void;
