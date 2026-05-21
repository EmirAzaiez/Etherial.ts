import { Request, Response, NextFunction, RequestHandler } from 'express'
import rateLimit, { Options as RateLimitOptions } from 'express-rate-limit'
import { IEtherialModule } from '../../index.js'

// ============================================
// Types & Interfaces
// ============================================

export interface RateLimitConfig {
    windowMs: number           // Time window in milliseconds
    max: number                // Max requests per window
    message?: string           // Custom error message
    statusCode?: number        // HTTP status code (default: 429)
    keyGenerator?: (req: Request) => string  // Custom key generator
    skip?: (req: Request) => boolean         // Skip certain requests
    standardHeaders?: boolean  // Return rate limit info in headers
    legacyHeaders?: boolean    // Use legacy X-RateLimit headers
}

export interface BruteForceConfig {
    freeRetries?: number       // Free attempts before penalty
    minWait?: number           // Min wait time (ms)
    maxWait?: number           // Max wait time (ms)
    lifetime?: number          // Time before reset (s)
}

export interface IPFilterConfig {
    whitelist?: string[]
    blacklist?: string[]
    trustProxy?: boolean
}

export interface BruteForceProtectionConfig extends BruteForceConfig {
    keyGenerator?: (req: Request) => string
}

export interface HttpSecurityConfig {
    // Rate Limiting
    rateLimit?: RateLimitConfig | false

    // IP Filtering
    ipFilter?: IPFilterConfig

    // Brute Force Protection
    bruteForce?: BruteForceConfig | false

    // Request Size Limit (in bytes)
    maxRequestSize?: number

    // Log security events
    logging?: boolean | ((event: SecurityEvent) => void)

    // Honor X-Forwarded-For only when set (app is behind a trusted reverse proxy).
    // When false (default), the raw socket address is used and XFF is ignored to
    // prevent attackers from rotating the header to bypass rate/brute-force counters.
    trustProxy?: boolean
}

export interface SecurityEvent {
    type: 'rate_limit' | 'ip_blocked' | 'brute_force'
    ip: string
    path: string
    method: string
    timestamp: Date
    details?: Record<string, any>
}

// ============================================
// In-Memory Stores
// ============================================

interface BruteForceEntry {
    attempts: number
    lastAttempt: number
    blockedUntil: number
}

// ============================================
// Main HttpSecurity Class
// ============================================

export class HttpSecurity implements IEtherialModule {
    private config: HttpSecurityConfig
    private bruteForceStore: Map<string, BruteForceEntry> = new Map()
    private log: (event: SecurityEvent) => void

    constructor(config: HttpSecurityConfig = {}) {
        this.config = {
            rateLimit: config.rateLimit,
            ipFilter: config.ipFilter,
            bruteForce: config.bruteForce,
            maxRequestSize: config.maxRequestSize,
            logging: config.logging,
            trustProxy: config.trustProxy ?? false
        }

        this.log = this.setupLogging(config.logging)

        // Cleanup expired entries periodically
        setInterval(() => this.cleanupExpiredEntries(), 60000)
    }

    private setupLogging(logging?: boolean | ((event: SecurityEvent) => void)): (event: SecurityEvent) => void {
        if (logging === false) {
            return () => { }
        }
        if (typeof logging === 'function') {
            return logging
        }
        return (event: SecurityEvent) => {
            console.log(`[Security:${event.type}] ${event.method} ${event.path} from ${event.ip}`)
        }
    }

    private cleanupExpiredEntries(): void {
        const now = Date.now()
        const idleThresholdMs = 3600000

        for (const [key, entry] of this.bruteForceStore) {
            // Entry currently blocked: drop only after the block has expired AND it has been idle long enough.
            // Entry never blocked (blockedUntil=0): drop only after the idle threshold — otherwise we'd
            // wipe the in-progress attempt counter on every sweep and the brute-force gate never triggers.
            const idle = now - entry.lastAttempt
            const blockExpired = entry.blockedUntil === 0 || entry.blockedUntil < now

            if (blockExpired && idle > idleThresholdMs) {
                this.bruteForceStore.delete(key)
            }
        }
    }

    private getClientIP(req: Request): string {
        if (this.config.trustProxy) {
            const forwarded = req.headers['x-forwarded-for']
            if (forwarded) {
                const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')
                const candidate = ips[0]?.trim()
                if (candidate) {
                    return candidate
                }
            }
        }
        return req.socket.remoteAddress || req.ip || 'unknown'
    }

    private logEvent(type: SecurityEvent['type'], req: Request, details?: Record<string, any>): void {
        this.log({
            type,
            ip: this.getClientIP(req),
            path: req.path,
            method: req.method,
            timestamp: new Date(),
            details
        })
    }

    // ============================================
    // Rate Limiting (using express-rate-limit)
    // ============================================

    createRateLimiter(config: RateLimitConfig): RequestHandler {
        const options: Partial<RateLimitOptions> = {
            windowMs: config.windowMs,
            max: config.max,
            standardHeaders: config.standardHeaders ?? true,
            legacyHeaders: config.legacyHeaders ?? false,
            message: {
                status: config.statusCode || 429,
                error: 'rate_limit_exceeded',
                message: config.message || 'Too many requests, please try again later.'
            },
            statusCode: config.statusCode || 429,
        }

        if (config.keyGenerator) {
            options.keyGenerator = config.keyGenerator
        }

        if (config.skip) {
            options.skip = config.skip
        }

        return rateLimit(options)
    }

    // Default rate limiter from config
    get rateLimitMiddleware(): RequestHandler {
        if (!this.config.rateLimit) {
            return (_req: Request, _res: Response, next: NextFunction) => next()
        }
        return this.createRateLimiter(this.config.rateLimit)
    }

    // ============================================
    // IP Filtering (Whitelist/Blacklist)
    // ============================================

    createIPFilter(config: IPFilterConfig): RequestHandler {
        return (req: Request, res: Response, next: NextFunction): void => {
            const clientIP = this.getClientIP(req)

            // Check blacklist first
            if (config.blacklist && config.blacklist.length > 0) {
                const isBlocked = config.blacklist.some(ip => {
                    if (ip.includes('*')) {
                        const pattern = new RegExp('^' + ip.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$')
                        return pattern.test(clientIP)
                    }
                    return ip === clientIP
                })

                if (isBlocked) {
                    this.logEvent('ip_blocked', req, { reason: 'blacklisted' })
                    res.status(403).json({
                        status: 403,
                        error: 'forbidden',
                        message: 'Access denied'
                    })
                    return
                }
            }

            // Check whitelist (if exists, only allow whitelisted IPs)
            if (config.whitelist && config.whitelist.length > 0) {
                const isAllowed = config.whitelist.some(ip => {
                    if (ip.includes('*')) {
                        const pattern = new RegExp('^' + ip.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$')
                        return pattern.test(clientIP)
                    }
                    return ip === clientIP
                })

                if (!isAllowed) {
                    this.logEvent('ip_blocked', req, { reason: 'not_whitelisted' })
                    res.status(403).json({
                        status: 403,
                        error: 'forbidden',
                        message: 'Access denied'
                    })
                    return
                }
            }

            next()
        }
    }

    get ipFilterMiddleware(): RequestHandler {
        if (!this.config.ipFilter) {
            return (_req: Request, _res: Response, next: NextFunction) => next()
        }
        return this.createIPFilter(this.config.ipFilter)
    }

    // ============================================
    // Brute Force Protection
    // ============================================

    createBruteForceProtection(config: BruteForceProtectionConfig = {}): RequestHandler {
        const {
            freeRetries = 5,
            minWait = 500,
            maxWait = 60000,
            lifetime = 3600,
            keyGenerator
        } = config

        return (req: Request, res: Response, next: NextFunction): void => {
            const customKey = keyGenerator ? keyGenerator(req) : null
            const key = customKey
                ? `${customKey}:${req.path}`
                : `${this.getClientIP(req)}:${req.path}`
            const now = Date.now()
            let entry = this.bruteForceStore.get(key)

            if (!entry) {
                entry = { attempts: 0, lastAttempt: now, blockedUntil: 0 }
                this.bruteForceStore.set(key, entry)
            }

            // Reset if lifetime exceeded
            if ((now - entry.lastAttempt) > lifetime * 1000) {
                entry.attempts = 0
                entry.blockedUntil = 0
            }

            // Check if blocked
            if (entry.blockedUntil > now) {
                this.logEvent('brute_force', req, { blockedUntil: entry.blockedUntil })
                const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000)
                res.status(429).json({
                    status: 429,
                    error: 'too_many_attempts',
                    message: 'Too many failed attempts. Please try again later.',
                    retryAfter
                })
                return
            }

            entry.lastAttempt = now
            entry.attempts++

            // Apply penalty after free retries
            if (entry.attempts > freeRetries) {
                const wait = Math.min(maxWait, minWait * Math.pow(2, entry.attempts - freeRetries - 1))
                entry.blockedUntil = now + wait
            }

            // Attach reset function to request
            ; (req as any).resetBruteForce = () => {
                this.bruteForceStore.delete(key)
            }

            next()
        }
    }

    get bruteForceMiddleware(): RequestHandler {
        if (!this.config.bruteForce) {
            return (_req: Request, _res: Response, next: NextFunction) => next()
        }
        return this.createBruteForceProtection(this.config.bruteForce)
    }

    // ============================================
    // Request Size Limiting
    // ============================================

    createSizeLimitMiddleware(maxSize: number): RequestHandler {
        return (req: Request, res: Response, next: NextFunction): void => {
            const contentLength = parseInt(req.headers['content-length'] || '0', 10)

            if (contentLength > maxSize) {
                res.status(413).json({
                    status: 413,
                    error: 'payload_too_large',
                    message: `Request body too large. Max size: ${maxSize} bytes`,
                    maxSize
                })
                return
            }

            next()
        }
    }

    get sizeLimitMiddleware(): RequestHandler {
        if (!this.config.maxRequestSize) {
            return (_req: Request, _res: Response, next: NextFunction) => next()
        }
        return this.createSizeLimitMiddleware(this.config.maxRequestSize)
    }

    // ============================================
    // Get All Middlewares
    // ============================================

    getAllMiddlewares(): RequestHandler[] {
        const middlewares: RequestHandler[] = []

        if (this.config.ipFilter) {
            middlewares.push(this.ipFilterMiddleware)
        }

        if (this.config.maxRequestSize) {
            middlewares.push(this.sizeLimitMiddleware)
        }

        if (this.config.rateLimit) {
            middlewares.push(this.rateLimitMiddleware)
        }

        if (this.config.bruteForce) {
            middlewares.push(this.bruteForceMiddleware)
        }

        return middlewares
    }

    // ============================================
    // Module Lifecycle
    // ============================================

    async beforeRun(): Promise<void> {
        // Nothing to do
    }

    async run(): Promise<void> {
        // Nothing to do
    }

    async afterRun(): Promise<void> {
        // Nothing to do
    }

    commands() {
        return [
        ]
    }
}
