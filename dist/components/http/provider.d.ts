import express from 'express';
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
    form?: {};
    query: {
        sort?: number;
        limit?: number;
        offset?: number;
        page?: number;
        [key: string]: any;
    };
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
    render?: (file: string, data: {}) => void;
}
export declare const Get: (path: string) => (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => void;
export declare const Post: (path: string) => (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => void;
export declare const Delete: (path: string) => (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => void;
export declare const Put: (path: string) => (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => void;
export declare const All: (path: string) => (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => void;
export declare const ShouldCreateFromModel: (model: any) => (target: any, propertyKey: string) => void;
export declare const Middleware: (cb: any) => (target: any, propertyKey: string) => void;
export declare const Controller: (prefix?: string) => ClassDecorator;
export declare const ShouldUseRoute: (cb: any) => (target: any, propertyKey: string) => void;
