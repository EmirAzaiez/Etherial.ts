import type { Response } from 'express';
import { AuthedRequest } from '../services/http.js';
export default class ETHMailCampaignsController {
    audiences(req: AuthedRequest, res: Response): Promise<any>;
    countAudience(req: AuthedRequest, res: Response): Promise<any>;
    list(req: AuthedRequest, res: Response): Promise<any>;
    create(req: AuthedRequest, res: Response): Promise<any>;
    preview(req: AuthedRequest, res: Response): Promise<any>;
    show(req: AuthedRequest, res: Response): Promise<any>;
    update(req: AuthedRequest, res: Response): Promise<any>;
    destroy(req: AuthedRequest, res: Response): Promise<any>;
    recipients(req: AuthedRequest, res: Response): Promise<any>;
    duplicate(req: AuthedRequest, res: Response): Promise<any>;
    test(req: AuthedRequest, res: Response): Promise<any>;
    schedule(req: AuthedRequest, res: Response): Promise<any>;
    unschedule(req: AuthedRequest, res: Response): Promise<any>;
    cancel(req: AuthedRequest, res: Response): Promise<any>;
}
