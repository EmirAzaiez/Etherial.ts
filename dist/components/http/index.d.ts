/// <reference types="node" />
import express from 'express';
import http from 'http';
import { IEtherialModule } from '../../index';
export declare class Http implements IEtherialModule {
    etherial_module_name: string;
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
    commands(): any[];
}
