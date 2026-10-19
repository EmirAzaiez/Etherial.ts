import type { Request, Response } from 'express';
export default class ETHAdminPrefsController {
    /**
     * GET /admin/prefs → `{ [key]: value }`
     *
     * The signed-in user's back-office preferences, and only theirs: the user
     * comes from the token, never from the request.
     */
    list(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /** PUT /admin/prefs/:key, body `{ value }`: one preference, created or replaced. */
    put(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /** DELETE /admin/prefs/:key: back to the back-office's default. */
    remove(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
}
export declare const AvailableRouteMethods: readonly ["list", "put", "remove"];
