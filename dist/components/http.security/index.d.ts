import { Request, RequestHandler } from 'express';
import { IEtherialModule } from '../../index';
export interface RateLimitConfig {
    windowMs: number;
    max: number;
    message?: string;
    statusCode?: number;
    keyGenerator?: (req: Request) => string;
    skip?: (req: Request) => boolean;
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
}
export interface BruteForceConfig {
    freeRetries?: number;
    minWait?: number;
    maxWait?: number;
    lifetime?: number;
}
export interface IPFilterConfig {
    whitelist?: string[];
    blacklist?: string[];
    trustProxy?: boolean;
}
export interface HttpSecurityConfig {
    rateLimit?: RateLimitConfig | false;
    ipFilter?: IPFilterConfig;
    bruteForce?: BruteForceConfig | false;
    maxRequestSize?: number;
    logging?: boolean | ((event: SecurityEvent) => void);
}
export interface SecurityEvent {
    type: 'rate_limit' | 'ip_blocked' | 'brute_force';
    ip: string;
    path: string;
    method: string;
    timestamp: Date;
    details?: Record<string, any>;
}
export declare class HttpSecurity implements IEtherialModule {
    private config;
    private bruteForceStore;
    private log;
    constructor(config?: HttpSecurityConfig);
    private setupLogging;
    private cleanupExpiredEntries;
    private getClientIP;
    private logEvent;
    createRateLimiter(config: RateLimitConfig): RequestHandler;
    get rateLimitMiddleware(): RequestHandler;
    createIPFilter(config: IPFilterConfig): RequestHandler;
    get ipFilterMiddleware(): RequestHandler;
    createBruteForceProtection(config?: BruteForceConfig): RequestHandler;
    get bruteForceMiddleware(): RequestHandler;
    createSizeLimitMiddleware(maxSize: number): RequestHandler;
    get sizeLimitMiddleware(): RequestHandler;
    getAllMiddlewares(): RequestHandler[];
    beforeRun(): Promise<void>;
    run(): Promise<void>;
    afterRun(): Promise<void>;
    commands(): any[];
}
