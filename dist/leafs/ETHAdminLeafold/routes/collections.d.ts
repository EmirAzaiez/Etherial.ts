import { Request, Response } from 'express';
/**
 * Admin Collections Controller
 * Single controller handling all CRUD operations for all collections
 */
export default class AdminCollectionsController {
    /**
     * GET /admin/collections/:collection
     * List records from a collection
     */
    list(req: Request & {
        user: any;
        params: {
            collection: string;
        };
        query: any;
    }, res: Response): Promise<any>;
    /**
     * GET /admin/collections/:collection/:id
     * Show a single record
     */
    show(req: Request & {
        user: any;
        params: {
            collection: string;
            id: string;
        };
    }, res: Response): Promise<any>;
    /**
     * GET /admin/collections/:collection/:id/collections/:subName
     * Get sub-collection records
     * Supports both manual collections config AND auto-generated from hasMany fields
     */
    subCollection(req: Request & {
        user: any;
        params: {
            collection: string;
            id: string;
            subName: string;
        };
        query: any;
    }, res: Response): Promise<any>;
    /**
     * POST /admin/collections/:collection
     * Create a new record
     */
    create(req: Request & {
        user: any;
        params: {
            collection: string;
        };
        body: any;
    }, res: Response): Promise<any>;
    /**
     * PUT /admin/collections/:collection/:id
     * Update a record
     */
    update(req: Request & {
        user: any;
        params: {
            collection: string;
            id: string;
        };
        body: any;
    }, res: Response): Promise<any>;
    /**
     * DELETE /admin/collections/:collection/:id
     * Delete a record
     */
    delete(req: Request & {
        user: any;
        params: {
            collection: string;
            id: string;
        };
    }, res: Response): Promise<any>;
    /**
     * GET /admin/collections/:collection/:id/collections/:subName/:subId
     * Show a single sub-collection record
     */
    showSubCollectionItem(req: Request & {
        user: any;
        params: {
            collection: string;
            id: string;
            subName: string;
            subId: string;
        };
    }, res: Response): Promise<any>;
    /**
     * PUT /admin/collections/:collection/:id/collections/:subName/:subId
     * Update a sub-collection record
     */
    updateSubCollectionItem(req: Request & {
        user: any;
        params: {
            collection: string;
            id: string;
            subName: string;
            subId: string;
        };
        body: any;
    }, res: Response): Promise<any>;
    /**
     * DELETE /admin/collections/:collection/:id/collections/:subName/:subId
     * Delete a sub-collection record
     */
    deleteSubCollectionItem(req: Request & {
        user: any;
        params: {
            collection: string;
            id: string;
            subName: string;
            subId: string;
        };
    }, res: Response): Promise<any>;
    /**
     * POST /admin/collections/:collection/:id/collections/:subName/:subId/actions
     * Execute an action on a sub-collection record
     */
    executeSubCollectionAction(req: Request & {
        user: any;
        params: {
            collection: string;
            id: string;
            subName: string;
            subId: string;
        };
        body: any;
    }, res: Response): Promise<any>;
    /**
     * POST /admin/collections/:collection/:id/actions
     * Execute an action on a record
     */
    executeAction(req: Request & {
        user: any;
        params: {
            collection: string;
            id: string;
        };
        body: any;
    }, res: Response): Promise<any>;
    /**
     * GET /admin/collections/:collection/stats
     * Get stats for a collection
     *
     * Query params:
     * - stat: stat name (optional, returns all if not specified)
     * - from: start date ISO string (optional)
     * - to: end date ISO string (optional)
     * - granularity: 'day' | 'week' | 'month' (default: 'day', for timeline stats)
     */
    stats(req: Request & {
        user: any;
        params: {
            collection: string;
        };
        query: any;
    }, res: Response): Promise<any>;
    /**
     * Compute a single stat
     */
    private computeStat;
}
export declare const AvailableRouteMethods: readonly ["list", "show", "subCollection", "showSubCollectionItem", "updateSubCollectionItem", "deleteSubCollectionItem", "executeSubCollectionAction", "create", "update", "delete", "executeAction", "stats"];
