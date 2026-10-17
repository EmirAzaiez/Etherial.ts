import type { Response } from 'express';
import { AuthedRequest } from '../services/http.js';
export default class ETHMailAdminController {
    theme(req: AuthedRequest, res: Response): Promise<any>;
    previewBrand(req: AuthedRequest, res: Response): Promise<any>;
    saveBrand(req: AuthedRequest, res: Response): Promise<any>;
    resetBrand(req: AuthedRequest, res: Response): Promise<any>;
    list(req: AuthedRequest, res: Response): Promise<any>;
    show(req: AuthedRequest, res: Response): Promise<any>;
    versions(req: AuthedRequest, res: Response): Promise<any>;
    version(req: AuthedRequest, res: Response): Promise<any>;
    preview(req: AuthedRequest, res: Response): Promise<any>;
    save(req: AuthedRequest, res: Response): Promise<any>;
    reset(req: AuthedRequest, res: Response): Promise<any>;
    test(req: AuthedRequest, res: Response): Promise<any>;
}
