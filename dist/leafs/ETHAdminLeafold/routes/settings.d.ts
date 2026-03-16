import { Request, Response } from 'etherial/components/http/provider';
export default class SettingsController {
    /**
     * Get admin panel settings
     * Returns configuration values like logo, colors, app name, etc.
     */
    getSettings(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /**
     * Get public settings (no authentication required)
     * Returns only public-facing settings like logo, colors, app name
     */
    getPublicSettings(_req: Request, res: Response): Promise<any>;
    /**
     * Get full admin schema (collections, features, fields, actions)
     * This is the main endpoint for the frontend to build the entire admin UI
     */
    getSchema(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /**
     * Get schema for a specific collection
     */
    getCollectionSchema(req: Request & {
        user: any;
        params: {
            collection: string;
        };
    }, res: Response): Promise<any>;
    /**
     * Get dashboard statistics for all collections
     * Returns counts and recent items for each collection
     *
     * Query params:
     * - months: number (default: 0) - Include monthly stats for the last N months (max 24)
     */
    getStats(req: Request & {
        user: any;
        query: {
            months?: string;
        };
    }, res: Response): Promise<any>;
    /**
     * Get monthly creation stats for a model
     */
    private getMonthlyStats;
}
export declare const AvailableRouteMethods: readonly ["getPublicSettings", "getSettings", "getSchema", "getCollectionSchema", "getStats"];
