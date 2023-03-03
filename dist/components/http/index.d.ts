/// <reference types="node" />
import express from "express";
import http from "http";
export declare class Http {
    app: express.Application;
    server: http.Server;
    port: number;
    routes: any;
    notFoundRouteMiddleware: any;
    constructor({ port, routes, middlewares }: {
        port: any;
        routes: any;
        middlewares: any;
    });
    listen(): Promise<unknown>;
    addRoutes(routes: any): this;
    notFoundRoute(middleware: any): this;
    run(): Promise<this>;
}
