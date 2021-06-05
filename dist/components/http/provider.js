"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let MethodHandler = (method, path) => {
    return (target, propertyKey) => {
        if (!Reflect.hasMetadata('routes', target.constructor)) {
            Reflect.defineMetadata('routes', [], target.constructor);
        }
        const routes = Reflect.getMetadata('routes', target.constructor);
        routes.push({
            requestMethod: method,
            path,
            methodName: propertyKey,
            middlewares: Reflect.getMetadata('middlewares', target, propertyKey) || []
        });
        Reflect.defineMetadata('routes', routes, target.constructor);
    };
};
exports.Get = (path) => {
    return MethodHandler("get", path);
};
exports.Post = (path) => {
    return MethodHandler("post", path);
};
exports.Delete = (path) => {
    return MethodHandler("all", path);
};
exports.Put = (path) => {
    return MethodHandler("put", path);
};
exports.All = (path) => {
    return MethodHandler("all", path);
};
exports.Middleware = (cb) => {
    return (target, propertyKey) => {
        if (!Reflect.hasMetadata('routes', target.constructor)) {
            Reflect.defineMetadata('routes', [], target.constructor);
        }
        const middlewares = Reflect.getMetadata('middlewares', target, propertyKey) || [];
        middlewares.push(cb);
        Reflect.defineMetadata('middlewares', middlewares, target, propertyKey);
    };
};
exports.Controller = (prefix = '') => {
    return (target) => {
        Reflect.defineMetadata('prefix', prefix, target);
        if (!Reflect.hasMetadata('routes', target)) {
            Reflect.defineMetadata('routes', [], target);
        }
    };
};
//# sourceMappingURL=provider.js.map