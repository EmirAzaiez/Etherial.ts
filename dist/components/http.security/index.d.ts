export default class HttpSecurity {
    type?: String;
    secret?: String;
    authorizedRoutes?: [{
        url: RegExp | String;
        method: String;
    }];
    generateToken?: (data: any) => String;
    authentificatorMiddleware: any;
    authentificatorRoleCheckerMiddleware: any;
    model: any;
    roles: any;
    column: string;
    customAuthentificationChecker: (any: any) => Promise<void>;
    customAuthentificationRoleChecker: (any: any) => void;
    constructor({ secret, authorizedRoutes, type, model, roles, column }: {
        secret: any;
        authorizedRoutes: any;
        type: any;
        model: any;
        roles: any;
        column: any;
    });
    setCustomAuthentificationChecker(customFunction: () => void): void;
    setCustomAuthentificationRoleChecker(customFunction: () => void): void;
}
