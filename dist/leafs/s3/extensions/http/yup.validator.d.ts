declare module 'yup' {
    interface StringSchema {
        shouldBeS3File(folder: string, message?: string): StringSchema;
    }
}
export declare const EtherialYupS3: typeof import("yup");
