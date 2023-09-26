"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShouldUseRoute = exports.Controller = exports.Middleware = exports.ShouldCreateFromModel = exports.All = exports.Put = exports.Delete = exports.Post = exports.Get = void 0;
let MethodHandler = (method, path) => {
    return (target, propertyKey, descriptor) => {
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
const Get = (path) => {
    return MethodHandler("get", path);
};
exports.Get = Get;
const Post = (path) => {
    return MethodHandler("post", path);
};
exports.Post = Post;
const Delete = (path) => {
    return MethodHandler("delete", path);
};
exports.Delete = Delete;
const Put = (path) => {
    return MethodHandler("put", path);
};
exports.Put = Put;
const All = (path) => {
    return MethodHandler("all", path);
};
exports.All = All;
const ShouldCreateFromModel = (model) => {
    return (0, exports.Middleware)((req, res, next) => {
        model.create(req.form).then((el) => {
            res.success({ status: 201, data: el });
        }).catch((err) => {
            res.error({ status: 400, errors: err.errors });
        });
    });
};
exports.ShouldCreateFromModel = ShouldCreateFromModel;
const Middleware = (cb) => {
    return (target, propertyKey) => {
        if (!Reflect.hasMetadata('routes', target.constructor)) {
            Reflect.defineMetadata('routes', [], target.constructor);
        }
        const middlewares = Reflect.getMetadata('middlewares', target, propertyKey) || [];
        middlewares.push(cb);
        Reflect.defineMetadata('middlewares', middlewares, target, propertyKey);
    };
};
exports.Middleware = Middleware;
const Controller = (prefix = '') => {
    return (target) => {
        Reflect.defineMetadata('prefix', prefix, target);
        if (!Reflect.hasMetadata('routes', target)) {
            Reflect.defineMetadata('routes', [], target);
        }
    };
};
exports.Controller = Controller;
exports.ShouldUseRoute = exports.Middleware;
//# sourceMappingURL=provider.js.map