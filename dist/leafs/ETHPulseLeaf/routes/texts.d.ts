import { Request, Response } from 'etherial/components/http/provider';
type AuthedRequest = Request & {
    user: any;
};
export default class ETHPulseTextsController {
    listTexts(req: AuthedRequest, res: Response): Promise<any>;
    saveText(req: AuthedRequest, res: Response): Promise<any>;
    resetText(req: AuthedRequest, res: Response): Promise<any>;
}
export {};
