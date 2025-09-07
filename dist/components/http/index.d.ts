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
    routes_leafs: {
        route: string;
        methods: string[];
    }[];
    notFoundRouteMiddleware: any;
    constructor({ port, routes, routes_leafs, middlewares }: {
        port: any;
        routes: any;
        routes_leafs: any;
        middlewares: any;
    });
    listen(): Promise<unknown>;
    addRoutes(routes: any): this;
    notFoundRoute(middleware: any): this;
    run(): Promise<this>;
    commands(): any[];
}
