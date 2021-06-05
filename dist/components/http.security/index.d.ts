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
    constructor({ secret, authorizedRoutes, type, model }: {
        secret: any;
        authorizedRoutes: any;
        type: any;
        model: any;
    });
}
