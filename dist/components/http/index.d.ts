export declare class Http {
    app: any;
    server: any;
    port: number;
    routes: any;
    notFoundRouteMiddleware: any;
    constructor({ port, routes, middlewares }: {
        port: any;
        routes: any;
        middlewares: any;
    });
    listen(): Promise<this>;
    loadRoutes(routes: any): this;
    notFoundRoute(middleware: any): this;
    loadCrons(crons: any): this;
    run(): Promise<this>;
}
