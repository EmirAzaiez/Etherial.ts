"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShouldBeAuthentificateWithRole = exports.ShouldBeAuthentificate = void 0;
const index_1 = __importDefault(require("../../index"));
const provider_1 = require("../http/provider");
function ShouldBeAuthentificate(type) {
    if (typeof type === "string") {
        if (type === "JWT") {
            return (0, provider_1.Middleware)(index_1.default['http_security'].authentificatorMiddlewareJWT);
        }
        else if (type === "BasicAuth") {
            return (0, provider_1.Middleware)(index_1.default['http_security'].authentificatorMiddlewareBA);
        }
        else if (type === "Session") {
            // return Middleware(etherial['http_security'].authentificatorMiddlewareSESSION)
        }
    }
    else {
        return (0, provider_1.Middleware)(index_1.default['http_security'].authentificatorMiddlewareJWT);
    }
}
exports.ShouldBeAuthentificate = ShouldBeAuthentificate;
function ShouldBeAuthentificateWithRole(role, type) {
    let middleware = null;
    if (typeof type === "string") {
        if (type === "JWT") {
            middleware = index_1.default['http_security'].authentificatorMiddlewareJWT;
        }
        else if (type === "BasicAuth") {
            middleware = index_1.default['http_security'].authentificatorMiddlewareBA;
        }
        else if (type === "Session") {
            // return etherial['http_security'].authentificatorMiddlewareSESSION
        }
    }
    else {
        if (index_1.default['http_security'].type === "JWT") {
            middleware = index_1.default['http_security'].authentificatorMiddlewareJWT;
        }
        else if (index_1.default['http_security'].type === "BasicAuth") {
            middleware = index_1.default['http_security'].authentificatorMiddlewareBA;
        }
        else if (index_1.default['http_security'].type === "Session") {
            // return etherial['http_security'].authentificatorMiddlewareSESSION
        }
    }
    return (0, provider_1.Middleware)([
        middleware,
        index_1.default['http_security'].authentificatorRoleCheckerMiddleware(role)
    ]);
}
exports.ShouldBeAuthentificateWithRole = ShouldBeAuthentificateWithRole;
//# sourceMappingURL=provider.js.map