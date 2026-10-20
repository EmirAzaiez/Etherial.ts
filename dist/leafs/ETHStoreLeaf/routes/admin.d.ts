import type { Request, Response } from 'express';
type AuthedRequest = Request & {
    user: any;
};
export default class ETHStoreAdminController {
    /** GET /admin/stores/overview?from=YYYY-MM-DD&to=YYYY-MM-DD */
    overview(req: AuthedRequest, res: Response): Promise<any>;
    /** GET /admin/stores/reviews?from=&to=&store=&stars=&replied=yes|no&page= */
    reviews(req: AuthedRequest, res: Response): Promise<any>;
    /**
     * POST /admin/stores/sync { store? } — reads the stores now. `done` once
     * it is over, `running` when it goes on past the wait, `busy` when another
     * sync already runs.
     */
    sync(req: AuthedRequest, res: Response): Promise<any>;
}
export {};
