import { Request, Response } from 'etherial/components/http/provider';
export default class EmailTemplateSyncController {
    /**
     * GET /admin/email-templates/sync
     * Returns missing and orphan templates
     */
    getSync(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /**
     * POST /admin/email-templates/sync/create
     * Creates a missing template with default content
     * Body: { key: string, locale: string }
     */
    createMissing(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /**
     * DELETE /admin/email-templates/sync/orphan/:id
     * Removes an orphan template (key not in config)
     */
    removeOrphan(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
}
