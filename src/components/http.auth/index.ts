import * as jwt from 'jsonwebtoken'
import { Request, Response, NextFunction } from 'express'
import { IEtherialModule } from '../../index'

export interface JWTPayload {
    [key: string]: any
}

export interface AuthenticatedRequest extends Request {
    user?: any
}

export type AuthChecker = (payload: JWTPayload) => Promise<any>
export type RoleChecker = (user: any, requiredRole: any) => Promise<boolean>

export interface HttpAuthConfig {
    secret: string
}

export class HttpAuth implements IEtherialModule {
    private secret: string

    private authChecker?: AuthChecker
    private roleChecker?: RoleChecker

    constructor({ secret }: HttpAuthConfig) {
        if (!secret) {
            throw new Error('etherial:http.auth ERROR - No secret defined in your config.')
        }

        this.secret = secret
    }

    /**
     * Generate a JWT token from payload data
     */
    generateToken(payload: JWTPayload): string {
        const options: jwt.SignOptions = {}

        return jwt.sign(payload, this.secret, options)
    }

    /**
     * Verify and decode a JWT token (checks signature!)
     */
    verifyToken(token: string): JWTPayload | null {
        try {
            return jwt.verify(token, this.secret) as JWTPayload
        } catch {
            return null
        }
    }

    /**
     * Decode a JWT token without verification (use only for reading claims)
     */
    decodeToken(token: string): JWTPayload | null {
        return jwt.decode(token) as JWTPayload | null
    }

    /**
     * Set the custom authentication checker
     */
    setAuthChecker(checker: AuthChecker): void {
        this.authChecker = checker
    }

    /**
     * Set the custom role checker
     */
    setRoleChecker(checker: RoleChecker): void {
        this.roleChecker = checker
    }

    /**
     * JWT Authentication middleware
     */
    authMiddleware = async (
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        // Skip if already authenticated
        if (req.user) {
            return next()
        }

        const authHeader = req.headers['authorization']

        if (!authHeader?.startsWith('Bearer ')) {
            res.status(401).json({ errors: ['unauthorized'] })
            return
        }

        const token = authHeader.slice(7)
        const payload = this.verifyToken(token)

        if (!payload) {
            res.status(401).json({ errors: ['invalid_token'] })
            return
        }

        if (!this.authChecker) {
            throw new Error('etherial:http.auth ERROR - No auth checker defined. Use setAuthChecker().')
        }

        try {
            const user = await this.authChecker(payload)

            if (!user) {
                res.status(401).json({ errors: ['unauthorized'] })
                return
            }

            req.user = user
            next()
        } catch {
            res.status(401).json({ errors: ['unauthorized'] })
        }
    }

    /**
     * Basic Auth middleware factory - creates middleware that verifies specific credentials
     */
    basicAuthMiddleware = (expectedUsername: string, expectedPassword: string) => {
        return async (
            req: AuthenticatedRequest,
            res: Response,
            next: NextFunction
        ): Promise<void> => {
            // Skip if already authenticated
            if (req.user) {
                return next()
            }

            const authHeader = req.headers['authorization']

            if (!authHeader?.startsWith('Basic ')) {
                res.status(401)
                    .setHeader('WWW-Authenticate', 'Basic realm="Protected"')
                    .json({ errors: ['unauthorized'] })
                return
            }

            try {
                const base64Credentials = authHeader.slice(6)
                const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8')
                const [username, password] = credentials.split(':')

                if (!username || !password) {
                    res.status(401).json({ errors: ['invalid_credentials'] })
                    return
                }

                // Direct verification with provided credentials
                if (username === expectedUsername && password === expectedPassword) {
                    req.user = { username }
                    return next()
                }

                res.status(401).json({ errors: ['unauthorized'] })
            } catch {
                res.status(401).json({ errors: ['unauthorized'] })
            }
        }
    }

    /**
     * API Key middleware factory - creates middleware that verifies a specific API key
     */
    apiKeyMiddleware = (expectedApiKey: string, headerKey: string = 'x-api-key') => {
        return async (
            req: AuthenticatedRequest,
            res: Response,
            next: NextFunction
        ): Promise<void> => {
            // Skip if already authenticated
            if (req.user) {
                return next()
            }

            // Check for API key in header
            const apiKey = req.headers[headerKey] as string

            if (!apiKey) {
                res.status(401).json({ errors: ['unauthorized'] })
                return
            }

            // Direct verification with provided API key
            if (apiKey === expectedApiKey) {
                req.user = { apiKey }
                return next()
            }

            res.status(401).json({ errors: ['unauthorized'] })
        }
    }

    /**
     * Role checker middleware (must be used after authMiddleware)
     */
    roleMiddleware = (requiredRole: any) => {
        return async (
            req: AuthenticatedRequest,
            res: Response,
            next: NextFunction
        ): Promise<void> => {
            if (!req.user) {
                res.status(401).json({ errors: ['unauthorized'] })
                return
            }

            if (!this.roleChecker) {
                throw new Error('etherial:http.auth ERROR - No role checker defined. Use setRoleChecker().')
            }

            try {
                const hasRole = await this.roleChecker(req.user, requiredRole)

                if (!hasRole) {
                    res.status(403).json({ errors: ['forbidden'] })
                    return
                }

                next()
            } catch {
                res.status(403).json({ errors: ['forbidden'] })
            }
        }
    }

    /**
     * CLI commands
     */
    commands() {
        return [
            {
                command: 'generate:token <user_id>',
                description: 'Generate a JWT token for a user_id.',
                action: async (_etherial: any, user_id: string) => {
                    const token = this.generateToken({ user_id })
                    return { success: true, message: token }
                },
            },
        ]
    }
}

