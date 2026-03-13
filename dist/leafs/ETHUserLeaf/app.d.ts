import { Etherial } from 'etherial';
export default class EthUserLeaf {
    config: ETHUserLeafConfig;
    etherial_module_name: string;
    private routes;
    default_avatar: string;
    avatar_s3_folder: string;
    constructor(config: ETHUserLeafConfig);
    run({ http }: Etherial): void;
    commands(): any[];
}
export declare const AvailableRouteMethods: {
    readonly auth: readonly ["authEmail"];
    readonly auth_google: readonly ["authGoogle"];
    readonly auth_apple: readonly ["authApple"];
    readonly users: readonly ["updateUserMeBio", "updateUserMeAvatar"];
    readonly users_email: readonly ["sendEmailValidation", "confirmEmailValidation"];
    readonly users_password: readonly ["userUpdatePassword", "setUserPassword", "requestPasswordReset", "confirmPasswordReset"];
    readonly users_phone: readonly ["sendPhoneValidation", "confirmPhoneValidation"];
};
export type AuthMethods = (typeof AvailableRouteMethods.auth)[number];
export type AuthGoogleMethods = (typeof AvailableRouteMethods.auth_google)[number];
export type AuthAppleMethods = (typeof AvailableRouteMethods.auth_apple)[number];
export type UsersMethods = (typeof AvailableRouteMethods.users)[number];
export type UsersEmailMethods = (typeof AvailableRouteMethods.users_email)[number];
export type UsersPasswordMethods = (typeof AvailableRouteMethods.users_password)[number];
export type UsersPhoneMethods = (typeof AvailableRouteMethods.users_phone)[number];
export interface ETHUserLeafConfig {
    default_avatar: string;
    avatar_s3_folder: string;
    routes: {
        auth: AuthMethods[];
        auth_google: AuthGoogleMethods[];
        auth_apple: AuthAppleMethods[];
        users: UsersMethods[];
        users_email: UsersEmailMethods[];
        users_password: UsersPasswordMethods[];
        users_phone: UsersPhoneMethods[];
    };
}
