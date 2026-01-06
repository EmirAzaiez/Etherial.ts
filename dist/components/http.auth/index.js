var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as jwt from 'jsonwebtoken';
export class HttpAuth {
    constructor({ secret }) {
        /**
         * JWT Authentication middleware
         */
        this.authMiddleware = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            // Skip if already authenticated
            if (req.user) {
                return next();
            }
            const authHeader = req.headers['authorization'];
            if (!(authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer '))) {
                res.status(401).json({ errors: ['unauthorized'] });
                return;
            }
            const token = authHeader.slice(7);
            const payload = this.verifyToken(token);
            if (!payload) {
                res.status(401).json({ errors: ['invalid_token'] });
                return;
            }
            if (!this.authChecker) {
                throw new Error('etherial:http.auth ERROR - No auth checker defined. Use setAuthChecker().');
            }
            try {
                const user = yield this.authChecker(payload);
                if (!user) {
                    res.status(401).json({ errors: ['unauthorized'] });
                    return;
                }
                req.user = user;
                next();
            }
            catch (_a) {
                res.status(401).json({ errors: ['unauthorized'] });
            }
        });
        /**
         * Basic Auth middleware factory - creates middleware that verifies specific credentials
         */
        this.basicAuthMiddleware = (expectedUsername, expectedPassword) => {
            return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
                // Skip if already authenticated
                if (req.user) {
                    return next();
                }
                const authHeader = req.headers['authorization'];
                if (!(authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Basic '))) {
                    res.status(401)
                        .setHeader('WWW-Authenticate', 'Basic realm="Protected"')
                        .json({ errors: ['unauthorized'] });
                    return;
                }
                try {
                    const base64Credentials = authHeader.slice(6);
                    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
                    const [username, password] = credentials.split(':');
                    if (!username || !password) {
                        res.status(401).json({ errors: ['invalid_credentials'] });
                        return;
                    }
                    // Direct verification with provided credentials
                    if (username === expectedUsername && password === expectedPassword) {
                        req.user = { username };
                        return next();
                    }
                    res.status(401).json({ errors: ['unauthorized'] });
                }
                catch (_a) {
                    res.status(401).json({ errors: ['unauthorized'] });
                }
            });
        };
        /**
         * API Key middleware factory - creates middleware that verifies a specific API key
         */
        this.apiKeyMiddleware = (expectedApiKey, headerKey = 'x-api-key') => {
            return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
                // Skip if already authenticated
                if (req.user) {
                    return next();
                }
                // Check for API key in header
                const apiKey = req.headers[headerKey];
                if (!apiKey) {
                    res.status(401).json({ errors: ['unauthorized'] });
                    return;
                }
                // Direct verification with provided API key
                if (apiKey === expectedApiKey) {
                    req.user = { apiKey };
                    return next();
                }
                res.status(401).json({ errors: ['unauthorized'] });
            });
        };
        /**
         * Role checker middleware (must be used after authMiddleware)
         */
        this.roleMiddleware = (requiredRole) => {
            return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
                if (!req.user) {
                    res.status(401).json({ errors: ['unauthorized'] });
                    return;
                }
                if (!this.roleChecker) {
                    throw new Error('etherial:http.auth ERROR - No role checker defined. Use setRoleChecker().');
                }
                try {
                    const hasRole = yield this.roleChecker(req.user, requiredRole);
                    if (!hasRole) {
                        res.status(403).json({ errors: ['forbidden'] });
                        return;
                    }
                    next();
                }
                catch (_a) {
                    res.status(403).json({ errors: ['forbidden'] });
                }
            });
        };
        if (!secret) {
            throw new Error('etherial:http.auth ERROR - No secret defined in your config.');
        }
        this.secret = secret;
    }
    /**
     * Generate a JWT token from payload data
     */
    generateToken(payload) {
        const options = {};
        return jwt.sign(payload, this.secret, options);
    }
    /**
     * Verify and decode a JWT token (checks signature!)
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, this.secret);
        }
        catch (_a) {
            return null;
        }
    }
    /**
     * Decode a JWT token without verification (use only for reading claims)
     */
    decodeToken(token) {
        return jwt.decode(token);
    }
    /**
     * Set the custom authentication checker
     */
    setAuthChecker(checker) {
        this.authChecker = checker;
    }
    /**
     * Set the custom role checker
     */
    setRoleChecker(checker) {
        this.roleChecker = checker;
    }
    /**
     * CLI commands
     */
    commands() {
        return [
            {
                command: 'generate:token <user_id>',
                description: 'Generate a JWT token for a user_id.',
                action: (_etherial, user_id) => __awaiter(this, void 0, void 0, function* () {
                    const token = this.generateToken({ user_id });
                    return { success: true, message: token };
                }),
            },
        ];
    }
}
//# sourceMappingURL=index.js.map