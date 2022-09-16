import express from "express";

export interface RouteDefinition {
    path: string;
    requestMethod: 'get' | 'post' | 'delete' | 'options' | 'put' | 'all';
    methodName: string;
    middlewares: [];
}

export interface NextFunction extends express.NextFunction {}

export interface Request extends express.Request {
    params: {}
    body: {}
    query: {}
}

export interface Response extends express.Response {
    success?: (json: {status: number, data: {}, count?: number}) => void
    error?: (json: {status: number, errors: [any]}) => void
}

let MethodHandler = (method, path) => {

    return (target, propertyKey: string, descriptor:TypedPropertyDescriptor<Array<string>>): void => {

        if (! Reflect.hasMetadata('routes', target.constructor)) {
            Reflect.defineMetadata('routes', [], target.constructor);
        }
  
        const routes = Reflect.getMetadata('routes', target.constructor) as Array<RouteDefinition>;
  
        routes.push({
            requestMethod: method,
            path,
            methodName: propertyKey,
            middlewares: Reflect.getMetadata('middlewares', target, propertyKey) || []
        });

        Reflect.defineMetadata('routes', routes, target.constructor);

    };

}

export const Get = (path: string) => {
    return MethodHandler("get", path)
};

export const Post = (path: string) => {
    return MethodHandler("post", path)
};

export const Delete = (path: string) => {
    return MethodHandler("delete", path)
};

export const Put = (path: string) => {
    return MethodHandler("put", path)
};

export const All = (path: string) => {
    return MethodHandler("all", path)
};

export const Middleware = (cb: any) => {

    return (target, propertyKey: string): void => {

        if (! Reflect.hasMetadata('routes', target.constructor)) {
            Reflect.defineMetadata('routes', [], target.constructor);
        }

        const middlewares = Reflect.getMetadata('middlewares', target, propertyKey) || [];

        middlewares.push(cb)

        Reflect.defineMetadata('middlewares', middlewares, target, propertyKey);

    };

};

export const Controller = (prefix: string = ''): ClassDecorator => {

    return (target: any) => {
        Reflect.defineMetadata('prefix', prefix, target);
  
        if (! Reflect.hasMetadata('routes', target)) {
            Reflect.defineMetadata('routes', [], target);
        }

    };

};