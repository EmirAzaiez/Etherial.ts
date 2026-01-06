import { RateLimitConfig, IPFilterConfig, BruteForceConfig } from './index';
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
declare function ShouldUseLimiter(config: RateLimitConfig): MethodDecorator;
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
declare function ShouldUseStrictLimiter(): MethodDecorator;
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
declare function ShouldUseRelaxedLimiter(): MethodDecorator;
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
declare function ShouldUseLimiterPerUser(config: Omit<RateLimitConfig, 'keyGenerator'>): MethodDecorator;
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
declare function ShouldBlockIPs(ips: string[]): MethodDecorator;
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
declare function ShouldAllowOnlyIPs(ips: string[]): MethodDecorator;
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
declare function ShouldFilterIPs(config: IPFilterConfig): MethodDecorator;
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
declare function ShouldProtectBruteForce(config?: BruteForceConfig): MethodDecorator;
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
declare function ShouldUseStrictBruteForce(): MethodDecorator;
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
declare function ShouldLimitSize(maxSize: number): MethodDecorator;
/**
 * Limit to 1KB (for small JSON payloads)
 */
declare function ShouldLimitTo1KB(): MethodDecorator;
/**
 * Limit to 100KB (for medium payloads)
 */
declare function ShouldLimitTo100KB(): MethodDecorator;
/**
 * Limit to 1MB (for large payloads)
 */
declare function ShouldLimitTo1MB(): MethodDecorator;
/**
 * Limit to 10MB (for file uploads)
 */
declare function ShouldLimitTo10MB(): MethodDecorator;
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
declare function ShouldSecureAuthRoute(): MethodDecorator;
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
declare function ShouldSecureAPIRoute(): MethodDecorator;
export { ShouldUseLimiter, ShouldUseStrictLimiter, ShouldUseRelaxedLimiter, ShouldUseLimiterPerUser, ShouldBlockIPs, ShouldAllowOnlyIPs, ShouldFilterIPs, ShouldProtectBruteForce, ShouldUseStrictBruteForce, ShouldLimitSize, ShouldLimitTo1KB, ShouldLimitTo100KB, ShouldLimitTo1MB, ShouldLimitTo10MB, ShouldSecureAuthRoute, ShouldSecureAPIRoute };
