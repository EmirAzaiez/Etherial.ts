import etherial from '../../index.js';
import { Middleware } from '../http/provider.js';
// ============================================
// Rate Limiting Decorators
// ============================================
/**
 * Apply rate limiting to a specific route
 *
 * @example
 * ```typescript
 * @Post('/login')
 * @ShouldUseLimiter({ windowMs: 60000, max: 5 })
 * login() {}
 * ```
 */
function ShouldUseLimiter(config) {
    return Middleware(etherial['http_security'].createRateLimiter(config));
}
/**
 * Apply strict rate limiting (5 requests per minute)
 *
 * @example
 * ```typescript
 * @Post('/forgot-password')
 * @ShouldUseStrictLimiter()
 * forgotPassword() {}
 * ```
 */
function ShouldUseStrictLimiter() {
    return Middleware(etherial['http_security'].createRateLimiter({
        windowMs: 60000,
        max: 5,
        message: 'Too many requests. Please wait before trying again.'
    }));
}
/**
 * Apply relaxed rate limiting (100 requests per minute)
 *
 * @example
 * ```typescript
 * @Get('/products')
 * @ShouldUseRelaxedLimiter()
 * getProducts() {}
 * ```
 */
function ShouldUseRelaxedLimiter() {
    return Middleware(etherial['http_security'].createRateLimiter({
        windowMs: 60000,
        max: 100
    }));
}
/**
 * Apply custom rate limiting per user (based on JWT/session)
 *
 * @example
 * ```typescript
 * @Post('/api/action')
 * @ShouldUseLimiterPerUser({ windowMs: 60000, max: 30 })
 * doAction() {}
 * ```
 */
function ShouldUseLimiterPerUser(config) {
    return Middleware(etherial['http_security'].createRateLimiter(Object.assign(Object.assign({}, config), { keyGenerator: (req) => {
            var _a, _b;
            const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || ((_b = req.user) === null || _b === void 0 ? void 0 : _b.user_id);
            if (userId)
                return `user:${userId}`;
            return req.ip || req.socket.remoteAddress || 'unknown';
        } })));
}
// ============================================
// IP Filtering Decorators
// ============================================
/**
 * Block specific IPs from accessing this route
 *
 * @example
 * ```typescript
 * @Get('/admin')
 * @ShouldBlockIPs(['192.168.1.*', '10.0.0.1'])
 * adminPanel() {}
 * ```
 */
function ShouldBlockIPs(ips) {
    return Middleware(etherial['http_security'].createIPFilter({ blacklist: ips }));
}
/**
 * Only allow specific IPs to access this route
 *
 * @example
 * ```typescript
 * @Get('/internal/metrics')
 * @ShouldAllowOnlyIPs(['10.0.0.*', '192.168.1.100'])
 * getMetrics() {}
 * ```
 */
function ShouldAllowOnlyIPs(ips) {
    return Middleware(etherial['http_security'].createIPFilter({ whitelist: ips }));
}
/**
 * Apply custom IP filter configuration
 *
 * @example
 * ```typescript
 * @Get('/api/data')
 * @ShouldFilterIPs({ whitelist: ['10.0.0.*'], blacklist: ['10.0.0.5'] })
 * getData() {}
 * ```
 */
function ShouldFilterIPs(config) {
    return Middleware(etherial['http_security'].createIPFilter(config));
}
// ============================================
// Brute Force Protection Decorators
// ============================================
/**
 * Apply brute force protection to this route
 *
 * @example
 * ```typescript
 * @Post('/login')
 * @ShouldProtectBruteForce()
 * login() {}
 * ```
 */
function ShouldProtectBruteForce(config) {
    return Middleware(etherial['http_security'].createBruteForceProtection(config));
}
/**
 * Strict brute force protection (3 attempts, longer wait times)
 *
 * @example
 * ```typescript
 * @Post('/admin/login')
 * @ShouldUseStrictBruteForce()
 * adminLogin() {}
 * ```
 */
function ShouldUseStrictBruteForce() {
    return Middleware(etherial['http_security'].createBruteForceProtection({
        freeRetries: 3,
        minWait: 1000,
        maxWait: 300000, // 5 minutes max
        lifetime: 7200 // 2 hours
    }));
}
// ============================================
// Request Size Limiting Decorators
// ============================================
/**
 * Limit request body size
 *
 * @param maxSize - Maximum size in bytes
 *
 * @example
 * ```typescript
 * @Post('/upload')
 * @ShouldLimitSize(1024 * 1024) // 1MB max
 * upload() {}
 * ```
 */
function ShouldLimitSize(maxSize) {
    return Middleware(etherial['http_security'].createSizeLimitMiddleware(maxSize));
}
/**
 * Limit to 1KB (for small JSON payloads)
 */
function ShouldLimitTo1KB() {
    return Middleware(etherial['http_security'].createSizeLimitMiddleware(1024));
}
/**
 * Limit to 100KB (for medium payloads)
 */
function ShouldLimitTo100KB() {
    return Middleware(etherial['http_security'].createSizeLimitMiddleware(102400));
}
/**
 * Limit to 1MB (for large payloads)
 */
function ShouldLimitTo1MB() {
    return Middleware(etherial['http_security'].createSizeLimitMiddleware(1048576));
}
/**
 * Limit to 10MB (for file uploads)
 */
function ShouldLimitTo10MB() {
    return Middleware(etherial['http_security'].createSizeLimitMiddleware(10485760));
}
// ============================================
// Composite Security Decorators
// ============================================
/**
 * Apply security stack for authentication routes
 * (Rate limiting + Brute force protection)
 *
 * @example
 * ```typescript
 * @Post('/login')
 * @ShouldSecureAuthRoute()
 * login() {}
 * ```
 */
function ShouldSecureAuthRoute() {
    return Middleware([
        etherial['http_security'].createRateLimiter({ windowMs: 60000, max: 10 }),
        etherial['http_security'].createBruteForceProtection({ freeRetries: 5 })
    ]);
}
/**
 * Apply security for API routes
 * (Rate limiting + Size limit)
 *
 * @example
 * ```typescript
 * @Post('/api/data')
 * @ShouldSecureAPIRoute()
 * postData() {}
 * ```
 */
function ShouldSecureAPIRoute() {
    return Middleware([
        etherial['http_security'].createRateLimiter({ windowMs: 60000, max: 60 }),
        etherial['http_security'].createSizeLimitMiddleware(1048576) // 1MB
    ]);
}
// ============================================
// Exports
// ============================================
export { 
// Rate Limiting
ShouldUseLimiter, ShouldUseStrictLimiter, ShouldUseRelaxedLimiter, ShouldUseLimiterPerUser, 
// IP Filtering
ShouldBlockIPs, ShouldAllowOnlyIPs, ShouldFilterIPs, 
// Brute Force Protection
ShouldProtectBruteForce, ShouldUseStrictBruteForce, 
// Request Size
ShouldLimitSize, ShouldLimitTo1KB, ShouldLimitTo100KB, ShouldLimitTo1MB, ShouldLimitTo10MB, 
// Composite
ShouldSecureAuthRoute, ShouldSecureAPIRoute };
