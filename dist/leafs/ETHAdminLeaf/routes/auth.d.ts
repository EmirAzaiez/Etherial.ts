import { Request, Response } from 'express';
export default class AuthController {
    /**
     * Check if the authenticated user has access to the admin panel
     * Returns { hasAccess: boolean }
     */
    checkAdminAuthAccess(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
}
export declare const AvailableRouteMethods: readonly ["checkAdminAuthAccess"];
