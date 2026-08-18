import type { Request, Response } from 'express';
export default class FlowWebhookController {
    receive(req: Request, res: Response): Promise<any>;
    /**
     * Several providers verify a URL with a GET before they will save it, so the
     * same handler answers both. A GET with no body simply starts the flow with
     * an empty record.
     */
    verify(req: Request, res: Response): Promise<any>;
}
export declare const AvailableRouteMethods: readonly ["receive", "verify"];
