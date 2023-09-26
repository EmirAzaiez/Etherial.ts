declare const _default: (etherial: any) => {
    openapi: string;
    info: {
        title: string;
        description: string;
        license: {
            name: string;
            url: string;
        };
        version: string;
    };
    servers: {
        url: string;
    }[];
    components: {
        securitySchemes: {
            BearerAuth: {
                type: string;
                scheme: string;
            };
        };
    };
    paths: {};
};
export default _default;
