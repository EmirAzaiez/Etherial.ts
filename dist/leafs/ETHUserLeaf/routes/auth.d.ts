import { Request, Response } from 'etherial/components/http/provider';
import { AuthFormEmailType, AuthFormUsernameType } from '../forms/auth_form.js';
export default class ETHUserLeafAuthController {
    authEmail(req: Request & {
        form: AuthFormEmailType;
    }, res: Response): Promise<any>;
    authUsername(req: Request & {
        form: AuthFormUsernameType;
    }, res: Response): Promise<any>;
}
