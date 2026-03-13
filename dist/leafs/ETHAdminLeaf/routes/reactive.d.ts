import { Request, Response } from 'etherial/components/http/provider';
export default class ReactiveController {
    /**
     * Debug endpoint to check reactive module status
     */
    debug(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /**
     * Get real-time statistics for reactive connections
     * Returns counts for total, guests, and authenticated users
     */
    getStats(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /**
     * Get all connected sockets with details
     * Returns list of all connections (guests + authenticated)
     */
    getConnections(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /**
     * Get authenticated users only
     * Returns list of all authenticated user connections
     */
    getAuthenticatedUsers(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /**
     * Get guest connections only
     * Returns list of all unauthenticated connections
     */
    getGuests(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /**
     * Check if a specific user is online
     */
    getUserStatus(req: Request & {
        user: any;
        params: {
            userId: string;
        };
    }, res: Response): Promise<any>;
    /**
     * Enrich socket connections with user data from database
     */
    private enrichConnections;
}
export declare const AvailableRouteMethods: readonly ["debug", "getStats", "getConnections", "getAuthenticatedUsers", "getGuests", "getUserStatus"];
