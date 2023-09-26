export declare class HttpSecurity {
    protected type?: "JWT" | "BasicAuth" | "Session";
    private secret?;
    generateJWTToken?: (data: any) => String;
    decodeJWTToken?: (token: string) => any;
    generateToken?: (data: any) => String;
    decodeToken?: (token: string) => any;
    authentificatorMiddlewareJWT: any;
    authentificatorMiddlewareBA: any;
    authentificatorRoleCheckerMiddleware: any;
    customAuthentificationJWTChecker: (any: any) => Promise<any>;
    customAuthentificationBAChecker: (any: any) => Promise<any>;
    customAuthentificationChecker: (cb: (any: any) => Promise<any>, type?: "JWT" | "BasicAuth" | "Session") => Promise<void>;
    customAuthentificationRoleChecker: (user: any, askedRole: any) => Promise<void>;
    constructor({ secret, type }: {
        secret: any;
        type: any;
    });
    setCustomAuthentificationChecker(cb: (args: any) => Promise<any>, type?: "JWT" | "BasicAuth" | "Session"): void;
    setCustomAuthentificationRoleChecker(cb: (user: any, askedRole: any) => Promise<any>): void;
    commands(): {
        command: string;
        description: string;
        action: (etherial: any, user_id: any) => Promise<{
            success: boolean;
            message: String;
        }>;
    }[];
}
