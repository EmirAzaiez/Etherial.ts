import { Request, Response } from 'express';
export default class AdminPagesController {
    /**
     * POST /admin/pages/:page/submit
     * Submit a custom page form
     */
    submitForm(req: Request & {
        user: any;
        params: {
            page: string;
        };
        body: any;
    }, res: Response): Promise<any>;
}
export declare const AvailableRouteMethods: readonly ["submitForm"];
