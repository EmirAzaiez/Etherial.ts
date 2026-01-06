/**
 * Decorator to require JWT authentication on a route
 */
declare function ShouldBeAuthenticated(): MethodDecorator;
/**
 * Decorator to require JWT authentication + specific role
 */
declare function ShouldBeAuthenticatedWithRole(role: any): MethodDecorator;
/**
 * Decorator to require Basic Auth authentication on a route
 */
declare function ShouldBeAuthenticatedWithBasicAuth(username: string, password: string): MethodDecorator;
/**
 * Decorator to require API Key authentication on a route
 */
declare function ShouldBeAuthenticatedWithApiKey(apiKey: string, headerKey?: string): MethodDecorator;
export { ShouldBeAuthenticated, ShouldBeAuthenticatedWithRole, ShouldBeAuthenticatedWithBasicAuth, ShouldBeAuthenticatedWithApiKey };
