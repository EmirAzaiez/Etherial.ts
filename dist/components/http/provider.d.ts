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
export declare const Get: (path: string) => (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<(req: Request, res: Response, next?: NextFunction) => Promise<any>>) => void;
export declare const Post: (path: string) => (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<(req: Request, res: Response, next?: NextFunction) => Promise<any>>) => void;
export declare const Delete: (path: string) => (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<(req: Request, res: Response, next?: NextFunction) => Promise<any>>) => void;
export declare const Put: (path: string) => (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<(req: Request, res: Response, next?: NextFunction) => Promise<any>>) => void;
export declare const All: (path: string) => (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<(req: Request, res: Response, next?: NextFunction) => Promise<any>>) => void;
export declare const Middleware: (cb: any) => (target: any, propertyKey: string) => void;
export declare const Controller: (prefix?: string) => ClassDecorator;
