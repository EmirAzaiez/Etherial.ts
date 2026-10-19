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
import etherial from '../../index.js';
import { DatabaseBruteForceStore, MemoryBruteForceStore } from './store.js';
// ============================================
// Main HttpSecurity Class
// ============================================
export class HttpSecurity {
    constructor(config = {}) {
        var _a;
        this.memoryStore = new MemoryBruteForceStore();
        this.databaseStore = new DatabaseBruteForceStore();
        this.storeFailureLoggedAt = 0;
        this.config = {
            rateLimit: config.rateLimit,
            ipFilter: config.ipFilter,
            bruteForce: config.bruteForce,
            maxRequestSize: config.maxRequestSize,
            logging: config.logging,
            trustProxy: (_a = config.trustProxy) !== null && _a !== void 0 ? _a : false,
            bruteForceStore: config.bruteForceStore
        };
        this.log = this.setupLogging(config.logging);
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
    // Chosen per request, not once: the decorators build their middleware when
    // the routes are imported, which may be before the database is up.
    bruteForceStoreFor() {
        var _a;
        if (this.config.bruteForceStore === 'memory') {
            return this.memoryStore;
        }
        if (DatabaseBruteForceStore.supports((_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize)) {
            return this.databaseStore;
        }
        return this.memoryStore;
    }
    logStoreFailure(err) {
        // Once a minute at most: a database that is down fails every login.
        const now = Date.now();
        if (now - this.storeFailureLoggedAt < 60000) {
            return;
        }
        this.storeFailureLoggedAt = now;
        console.error('[HttpSecurity] Brute-force counters unavailable in the database, counting in memory:', (err === null || err === void 0 ? void 0 : err.message) || err);
    }
    getClientIP(req) {
        var _a;
        if (this.config.trustProxy) {
            const forwarded = req.headers['x-forwarded-for'];
            if (forwarded) {
                const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
                const candidate = (_a = ips[0]) === null || _a === void 0 ? void 0 : _a.trim();
                if (candidate) {
                    return candidate;
                }
            }
        }
        return req.socket.remoteAddress || req.ip || 'unknown';
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
        const { freeRetries = 5, minWait = 500, maxWait = 60000, lifetime = 3600, keyGenerator } = config;
        const rules = { freeRetries, minWait, maxWait, lifetime };
        return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const customKey = keyGenerator ? keyGenerator(req) : null;
            const key = customKey
                ? `${customKey}:${req.path}`
                : `${this.getClientIP(req)}:${req.path}`;
            const now = Date.now();
            let store = this.bruteForceStoreFor();
            let blockedUntil;
            try {
                blockedUntil = yield store.hit(key, rules, now);
            }
            catch (err) {
                this.logStoreFailure(err);
                store = this.memoryStore;
                blockedUntil = yield store.hit(key, rules, now);
            }
            // Check if blocked
            if (blockedUntil > now) {
                this.logEvent('brute_force', req, { blockedUntil });
                const retryAfter = Math.ceil((blockedUntil - now) / 1000);
                res.status(429).json({
                    status: 429,
                    error: 'too_many_attempts',
                    message: 'Too many failed attempts. Please try again later.',
                    retryAfter
                });
                return;
            }
            // Attach reset function to request. The routes call it without
            // awaiting it: the delete runs in the background.
            ;
            req.resetBruteForce = () => {
                store.reset(key).catch((err) => this.logStoreFailure(err));
            };
            next();
        });
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
