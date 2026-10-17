import type { Request, Response } from 'express';
/** The link at the bottom of a campaign email. No account needed: the link is signed for the address. */
export default class ETHMailPublicController {
    /** Asks first: mail scanners open links on their own. */
    unsubscribeForm(req: Request, res: Response): Promise<void | Response<any, Record<string, any>>>;
    /** The page's button, and the inbox's own (RFC 8058, `List-Unsubscribe=One-Click`). */
    unsubscribeConfirm(req: Request, res: Response): Promise<void | Response<any, Record<string, any>>>;
}
