import type { Request, Response } from 'express';
export default class ETHAdminNotesController {
    /**
     * GET /admin/notes/mentionable?collection=orders&q=sa
     *
     * Who can be mentioned on this collection's records: staff who may see it.
     */
    mentionable(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /** GET /admin/notes/:collection/:id: the record's notes, oldest first. */
    list(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /** POST /admin/notes/:collection/:id  body `{ body }` */
    create(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /** PUT /admin/notes/item/:noteId  body `{ body }`: the author only. */
    update(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /** DELETE /admin/notes/item/:noteId: the author, or a super admin. */
    remove(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
}
