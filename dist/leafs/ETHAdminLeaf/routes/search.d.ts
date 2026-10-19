import type { Request, Response } from 'express';
export default class ETHAdminSearchController {
    /**
     * GET /admin/search?q=&limit=5
     *
     * One query over every collection the user may list whose list view
     * declares `search`, for the command palette: `{ results: [{ collection,
     * label, items: [{ id, title, subtitle? }] }] }`, collections with a match
     * only, in menu registration order. Secrets are neither searched nor sent.
     */
    search(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
}
export declare const AvailableRouteMethods: readonly ["search"];
