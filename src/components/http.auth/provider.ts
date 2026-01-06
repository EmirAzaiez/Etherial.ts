import etherial from '../../index'
import { Middleware } from '../http/provider'

/**
 * Decorator to require JWT authentication on a route
 */
function ShouldBeAuthenticated(): MethodDecorator {
    return Middleware(etherial['http_auth'].authMiddleware)
}

/**
 * Decorator to require JWT authentication + specific role
 */
function ShouldBeAuthenticatedWithRole(role: any): MethodDecorator {
    return Middleware([
        etherial['http_auth'].authMiddleware,
        etherial['http_auth'].roleMiddleware(role)
    ])
}

/**
 * Decorator to require Basic Auth authentication on a route
 */
function ShouldBeAuthenticatedWithBasicAuth(username: string, password: string): MethodDecorator {
    return Middleware(etherial['http_auth'].basicAuthMiddleware(username, password))
}

/**
 * Decorator to require API Key authentication on a route
 */
function ShouldBeAuthenticatedWithApiKey(apiKey: string, headerKey: string = 'x-api-key'): MethodDecorator {
    return Middleware(etherial['http_auth'].apiKeyMiddleware(apiKey, headerKey))
}

export {
    ShouldBeAuthenticated,
    ShouldBeAuthenticatedWithRole,
    ShouldBeAuthenticatedWithBasicAuth,
    ShouldBeAuthenticatedWithApiKey
}

