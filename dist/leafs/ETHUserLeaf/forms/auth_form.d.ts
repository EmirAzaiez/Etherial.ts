import { InferType } from 'yup';
export declare const AuthFormEmail: import("yup").ObjectSchema<{
    email: string;
    password: string;
    device: string;
}, import("yup").AnyObject, {
    email: undefined;
    password: undefined;
    device: undefined;
}, "">;
export type AuthFormEmailType = InferType<typeof AuthFormEmail>;
export declare const AuthFormUsername: import("yup").ObjectSchema<{
    username: string;
    password: string;
    device: string;
}, import("yup").AnyObject, {
    username: undefined;
    password: undefined;
    device: undefined;
}, "">;
export type AuthFormUsernameType = InferType<typeof AuthFormUsername>;
export declare const AuthFormGoogle: import("yup").ObjectSchema<{
    google_token: string;
}, import("yup").AnyObject, {
    google_token: undefined;
}, "">;
export type AuthFormGoogleType = InferType<typeof AuthFormGoogle>;
export declare const AuthFormApple: import("yup").ObjectSchema<{
    apple_token: string;
    firstname: string;
    lastname: string;
}, import("yup").AnyObject, {
    apple_token: undefined;
    firstname: undefined;
    lastname: undefined;
}, "">;
export type AuthFormAppleType = InferType<typeof AuthFormApple>;
