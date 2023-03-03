export default class HttpSecurity {
    type?: String;
    secret?: String;
    generateToken?: (data: any) => String;
    decodeToken?: (token: string) => any;
    authentificatorMiddleware: any;
    authentificatorRoleCheckerMiddleware: any;
    roles: any;
    column: string;
    role_column: string;
    customAuthentificationChecker: (any: any) => Promise<void>;
    customAuthentificationRoleChecker: (any: any) => void;
    constructor({ secret, type, roles, role_column }: {
        secret: any;
        type: any;
        roles: any;
        role_column: any;
    });
    setCustomAuthentificationChecker(customFunction: (any: any) => Promise<void>): void;
    setCustomAuthentificationRoleChecker(customFunction: () => void): void;
}
