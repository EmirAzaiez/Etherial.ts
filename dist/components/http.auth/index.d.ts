import { Request, Response, NextFunction } from 'express';
import { IEtherialModule } from '../../index';
export interface JWTPayload {
    [key: string]: any;
}
export interface AuthenticatedRequest extends Request {
    user?: any;
}
export type AuthChecker = (payload: JWTPayload) => Promise<any>;
export type RoleChecker = (user: any, requiredRole: any) => Promise<boolean>;
export interface HttpAuthConfig {
    secret: string;
}
export declare class HttpAuth implements IEtherialModule {
    private secret;
    private authChecker?;
    private roleChecker?;
    constructor({ secret }: HttpAuthConfig);
    /**
     * Generate a JWT token from payload data
     */
    generateToken(payload: JWTPayload): string;
    /**
     * Verify and decode a JWT token (checks signature!)
     */
    verifyToken(token: string): JWTPayload | null;
    /**
     * Decode a JWT token without verification (use only for reading claims)
     */
    decodeToken(token: string): JWTPayload | null;
    /**
     * Set the custom authentication checker
     */
    setAuthChecker(checker: AuthChecker): void;
    /**
     * Set the custom role checker
     */
    setRoleChecker(checker: RoleChecker): void;
    /**
     * JWT Authentication middleware
     */
    authMiddleware: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Basic Auth middleware factory - creates middleware that verifies specific credentials
     */
    basicAuthMiddleware: (expectedUsername: string, expectedPassword: string) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    /**
     * API Key middleware factory - creates middleware that verifies a specific API key
     */
    apiKeyMiddleware: (expectedApiKey: string, headerKey?: string) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Role checker middleware (must be used after authMiddleware)
     */
    roleMiddleware: (requiredRole: any) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    /**
     * CLI commands
     */
    commands(): {
        command: string;
        description: string;
        action: (_etherial: any, user_id: string) => Promise<{
            success: boolean;
            message: string;
        }>;
    }[];
}
