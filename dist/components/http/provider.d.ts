import express from "express";
export interface RouteDefinition {
    path: string;
    requestMethod: 'get' | 'post' | 'delete' | 'options' | 'put' | 'all';
    methodName: string;
    middlewares: [];
}
export interface NextFunction extends express.NextFunction {
}
export interface Request extends express.Request {
    params: {};
    body: {};
    query: {};
}
export interface Response extends express.Response {
    success?: (json: {
        status: number;
        data: {};
        count?: number;
    }) => void;
    error?: (json: {
        status: number;
        errors: [any];
    }) => void;
}
export declare const Get: (path: string) => MethodDecorator;
export declare const Post: (path: string) => MethodDecorator;
export declare const Delete: (path: string) => MethodDecorator;
export declare const Put: (path: string) => MethodDecorator;
export declare const All: (path: string) => MethodDecorator;
export declare const Middleware: (cb: any) => MethodDecorator;
export declare const Controller: (prefix?: string) => ClassDecorator;
