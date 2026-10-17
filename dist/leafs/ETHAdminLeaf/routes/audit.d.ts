import type { Request, Response } from 'express';
export default class ETHAdminAuditController {
    /**
     * GET /admin/audit/:collection/:id?before=<entry id>&limit=30&source=salesforce
     *
     * The record's changes, newest first. Whoever may open the record may read
     * them; `canRestore` says whether they may also undo one. The first page
     * also counts the entries per source, for the filter.
     */
    history(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /**
     * POST /admin/audit/:entry/restore  { fields?: string[], force?: boolean }
     *
     * Puts back what an edit replaced, or brings back a soft-deleted record.
     * A column changed again since that edit is a conflict: nothing is written
     * and the answer lists them, unless `force` is set. The restore goes
     * through the collection's own update hooks and is recorded like any edit.
     */
    restore(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
}
