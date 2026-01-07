var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import rateLimit from 'express-rate-limit';
// ============================================
// Main HttpSecurity Class
// ============================================
export class HttpSecurity {
    constructor(config = {}) {
        this.bruteForceStore = new Map();
        this.config = {
            rateLimit: config.rateLimit,
            ipFilter: config.ipFilter,
            bruteForce: config.bruteForce,
            maxRequestSize: config.maxRequestSize,
            logging: config.logging
        };
        this.log = this.setupLogging(config.logging);
        // Cleanup expired entries periodically
        setInterval(() => this.cleanupExpiredEntries(), 60000);
    }
    setupLogging(logging) {
        if (logging === false) {
            return () => { };
        }
        if (typeof logging === 'function') {
            return logging;
        }
        return (event) => {
            console.log(`[Security:${event.type}] ${event.method} ${event.path} from ${event.ip}`);
        };
    }
    cleanupExpiredEntries() {
        const now = Date.now();
        for (const [key, entry] of this.bruteForceStore) {
            if (entry.blockedUntil < now && (now - entry.lastAttempt) > 3600000) {
                this.bruteForceStore.delete(key);
            }
        }
    }
    getClientIP(req) {
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded) {
            const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
            return ips[0].trim();
        }
        return req.ip || req.socket.remoteAddress || 'unknown';
    }
    logEvent(type, req, details) {
        this.log({
            type,
            ip: this.getClientIP(req),
            path: req.path,
            method: req.method,
            timestamp: new Date(),
            details
        });
    }
    // ============================================
    // Rate Limiting (using express-rate-limit)
    // ============================================
    createRateLimiter(config) {
        var _a, _b;
        const options = {
            windowMs: config.windowMs,
            max: config.max,
            standardHeaders: (_a = config.standardHeaders) !== null && _a !== void 0 ? _a : true,
            legacyHeaders: (_b = config.legacyHeaders) !== null && _b !== void 0 ? _b : false,
            message: {
                status: config.statusCode || 429,
                error: 'rate_limit_exceeded',
                message: config.message || 'Too many requests, please try again later.'
            },
            statusCode: config.statusCode || 429,
        };
        if (config.keyGenerator) {
            options.keyGenerator = config.keyGenerator;
        }
        if (config.skip) {
            options.skip = config.skip;
        }
        return rateLimit(options);
    }
    // Default rate limiter from config
    get rateLimitMiddleware() {
        if (!this.config.rateLimit) {
            return (_req, _res, next) => next();
        }
        return this.createRateLimiter(this.config.rateLimit);
    }
    // ============================================
    // IP Filtering (Whitelist/Blacklist)
    // ============================================
    createIPFilter(config) {
        return (req, res, next) => {
            const clientIP = this.getClientIP(req);
            // Check blacklist first
            if (config.blacklist && config.blacklist.length > 0) {
                const isBlocked = config.blacklist.some(ip => {
                    if (ip.includes('*')) {
                        const pattern = new RegExp('^' + ip.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
                        return pattern.test(clientIP);
                    }
                    return ip === clientIP;
                });
                if (isBlocked) {
                    this.logEvent('ip_blocked', req, { reason: 'blacklisted' });
                    res.status(403).json({
                        status: 403,
                        error: 'forbidden',
                        message: 'Access denied'
                    });
                    return;
                }
            }
            // Check whitelist (if exists, only allow whitelisted IPs)
            if (config.whitelist && config.whitelist.length > 0) {
                const isAllowed = config.whitelist.some(ip => {
                    if (ip.includes('*')) {
                        const pattern = new RegExp('^' + ip.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
                        return pattern.test(clientIP);
                    }
                    return ip === clientIP;
                });
                if (!isAllowed) {
                    this.logEvent('ip_blocked', req, { reason: 'not_whitelisted' });
                    res.status(403).json({
                        status: 403,
                        error: 'forbidden',
                        message: 'Access denied'
                    });
                    return;
                }
            }
            next();
        };
    }
    get ipFilterMiddleware() {
        if (!this.config.ipFilter) {
            return (_req, _res, next) => next();
        }
        return this.createIPFilter(this.config.ipFilter);
    }
    // ============================================
    // Brute Force Protection
    // ============================================
    createBruteForceProtection(config = {}) {
        const { freeRetries = 5, minWait = 500, maxWait = 60000, lifetime = 3600 } = config;
        return (req, res, next) => {
            const key = `${this.getClientIP(req)}:${req.path}`;
            const now = Date.now();
            let entry = this.bruteForceStore.get(key);
            if (!entry) {
                entry = { attempts: 0, lastAttempt: now, blockedUntil: 0 };
                this.bruteForceStore.set(key, entry);
            }
            // Reset if lifetime exceeded
            if ((now - entry.lastAttempt) > lifetime * 1000) {
                entry.attempts = 0;
                entry.blockedUntil = 0;
            }
            // Check if blocked
            if (entry.blockedUntil > now) {
                this.logEvent('brute_force', req, { blockedUntil: entry.blockedUntil });
                const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
                res.status(429).json({
                    status: 429,
                    error: 'too_many_attempts',
                    message: 'Too many failed attempts. Please try again later.',
                    retryAfter
                });
                return;
            }
            entry.lastAttempt = now;
            entry.attempts++;
            // Apply penalty after free retries
            if (entry.attempts > freeRetries) {
                const wait = Math.min(maxWait, minWait * Math.pow(2, entry.attempts - freeRetries - 1));
                entry.blockedUntil = now + wait;
            }
            // Attach reset function to request
            ;
            req.resetBruteForce = () => {
                this.bruteForceStore.delete(key);
            };
            next();
        };
    }
    get bruteForceMiddleware() {
        if (!this.config.bruteForce) {
            return (_req, _res, next) => next();
        }
        return this.createBruteForceProtection(this.config.bruteForce);
    }
    // ============================================
    // Request Size Limiting
    // ============================================
    createSizeLimitMiddleware(maxSize) {
        return (req, res, next) => {
            const contentLength = parseInt(req.headers['content-length'] || '0', 10);
            if (contentLength > maxSize) {
                res.status(413).json({
                    status: 413,
                    error: 'payload_too_large',
                    message: `Request body too large. Max size: ${maxSize} bytes`,
                    maxSize
                });
                return;
            }
            next();
        };
    }
    get sizeLimitMiddleware() {
        if (!this.config.maxRequestSize) {
            return (_req, _res, next) => next();
        }
        return this.createSizeLimitMiddleware(this.config.maxRequestSize);
    }
    // ============================================
    // Get All Middlewares
    // ============================================
    getAllMiddlewares() {
        const middlewares = [];
        if (this.config.ipFilter) {
            middlewares.push(this.ipFilterMiddleware);
        }
        if (this.config.maxRequestSize) {
            middlewares.push(this.sizeLimitMiddleware);
        }
        if (this.config.rateLimit) {
            middlewares.push(this.rateLimitMiddleware);
        }
        if (this.config.bruteForce) {
            middlewares.push(this.bruteForceMiddleware);
        }
        return middlewares;
    }
    // ============================================
    // Module Lifecycle
    // ============================================
    beforeRun() {
        return __awaiter(this, void 0, void 0, function* () {
            // Nothing to do
        });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            // Nothing to do
        });
    }
    afterRun() {
        return __awaiter(this, void 0, void 0, function* () {
            // Nothing to do
        });
    }
    commands() {
        return [];
    }
}
