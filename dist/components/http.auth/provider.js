import etherial from '../../index.js';
import { Middleware } from '../http/provider.js';
/**
 * Decorator to require JWT authentication on a route
 */
function ShouldBeAuthenticated() {
    return Middleware(etherial['http_auth'].authMiddleware);
}
/**
 * Decorator to require JWT authentication + specific role
 */
function ShouldBeAuthenticatedWithRole(role) {
    return Middleware([
        etherial['http_auth'].authMiddleware,
        etherial['http_auth'].roleMiddleware(role)
    ]);
}
/**
 * Decorator to require Basic Auth authentication on a route
 */
function ShouldBeAuthenticatedWithBasicAuth(username, password) {
    return Middleware(etherial['http_auth'].basicAuthMiddleware(username, password));
}
/**
 * Decorator to require API Key authentication on a route
 */
function ShouldBeAuthenticatedWithApiKey(apiKey, headerKey = 'x-api-key') {
    return Middleware(etherial['http_auth'].apiKeyMiddleware(apiKey, headerKey));
}
export { ShouldBeAuthenticated, ShouldBeAuthenticatedWithRole, ShouldBeAuthenticatedWithBasicAuth, ShouldBeAuthenticatedWithApiKey };
