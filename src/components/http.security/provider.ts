import etherial from '../../index'
import { Middleware } from '../http/provider'

function ShouldBeAuthentificate() : MethodDecorator;
function ShouldBeAuthentificate(type: "JWT" | "BasicAuth" | "Session") : MethodDecorator;

function ShouldBeAuthentificate(type?: "JWT" | "BasicAuth" | "Session") : MethodDecorator {
    
    if (typeof type === "string") {
        if (type === "JWT") {
            return Middleware(etherial['http_security'].authentificatorMiddlewareJWT)
        } else if (type === "BasicAuth") {
            return Middleware(etherial['http_security'].authentificatorMiddlewareBA)
        } else if (type === "Session") {
            // return Middleware(etherial['http_security'].authentificatorMiddlewareSESSION)
        }
    } else {
        return Middleware(etherial['http_security'].authentificatorMiddlewareJWT)
    }

}

function ShouldBeAuthentificateWithRole(role: any) : MethodDecorator;
function ShouldBeAuthentificateWithRole(role: any, type: "JWT" | "BasicAuth" | "Session") : MethodDecorator;

function ShouldBeAuthentificateWithRole(role: any, type?: "JWT" | "BasicAuth" | "Session") : MethodDecorator {

    let middleware = null

    if (typeof type === "string") {
        
        if (type === "JWT") {
            middleware = etherial['http_security'].authentificatorMiddlewareJWT
        } else if (type === "BasicAuth") {
            middleware = etherial['http_security'].authentificatorMiddlewareBA
        } else if (type === "Session") {
            // return etherial['http_security'].authentificatorMiddlewareSESSION
        }

    } else {

        if (etherial['http_security'].type === "JWT") {
            middleware = etherial['http_security'].authentificatorMiddlewareJWT
        } else if (etherial['http_security'].type === "BasicAuth") {
            middleware = etherial['http_security'].authentificatorMiddlewareBA
        } else if (etherial['http_security'].type === "Session") {
            // return etherial['http_security'].authentificatorMiddlewareSESSION
        }
    
    }

    return Middleware([
        middleware,
        etherial['http_security'].authentificatorRoleCheckerMiddleware(role)
    ])
    
} 

export { ShouldBeAuthentificate, ShouldBeAuthentificateWithRole }