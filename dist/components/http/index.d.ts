import express, { RequestHandler, ErrorRequestHandler } from 'express';
import http from 'http';
import https from 'https';
import { CorsOptions } from 'cors';
import { IEtherialModule, IEtherial } from '../../index';
export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head' | 'all';
export interface HttpConfig {
    port: number;
    routes: string[];
    middlewares?: RequestHandler[];
    host?: string;
    https?: {
        key: string | Buffer;
        cert: string | Buffer;
        passphrase?: string;
    };
    cors?: boolean | CorsOptions;
    bodyParser?: {
        json?: boolean | {
            limit?: string;
        };
        urlencoded?: boolean | {
            extended?: boolean;
            limit?: string;
        };
        raw?: boolean | {
            limit?: string;
        };
    };
    trustProxy?: boolean | string | number;
    logging?: boolean | ((message: string) => void);
    healthcheck?: boolean | {
        path?: string;
    };
}
export interface ServerInfo {
    host: string;
    port: number;
    protocol: 'http' | 'https';
    url: string;
    routeCount: number;
}
export declare class Http implements IEtherialModule {
    app: express.Application;
    server: http.Server | https.Server;
    port: number;
    routes: string[];
    routes_leafs: {
        route: string;
        methods: string[];
    }[];
    notFoundRouteMiddleware: RequestHandler | null;
    errorHandler: ErrorRequestHandler | null;
    private config;
    private registeredRoutes;
    private log;
    constructor(config: HttpConfig);
    private validateConfig;
    private setupLogging;
    private setupBodyParsers;
    private loadControllers;
    private registerRoute;
    private setupHealthcheckRoute;
    listen(): Promise<this>;
    addRoutes(routes: string | string[]): this;
    notFoundRoute(middleware: RequestHandler): this;
    onError(handler: ErrorRequestHandler): this;
    use(middleware: RequestHandler): this;
    beforeRun(): Promise<void>;
    run(etherial?: IEtherial): Promise<void>;
    afterRun(): Promise<void>;
    getRegisteredRoutes(): {
        method: HttpMethod;
        path: string;
        handler: string;
    }[];
    commands(): {
        command: string;
        description: string;
        warn: boolean;
        action: () => Promise<{
            success: boolean;
            message: string;
        }>;
    }[];
}
