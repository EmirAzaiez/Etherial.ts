import type { Request, Response } from 'express';
type AuthedRequest = Request & {
    user: any;
};
export default class ETHAssistantAdminController {
    /**
     * POST /admin/assistant/ask
     * { task: 'ask' | 'summarize' | 'draft', messages: [{ role, content }], context?: { collection, id?, filters?, search? }, language?: 'en' | 'ar' }
     * → { answer, steps, model, usage }
     */
    ask(req: AuthedRequest, res: Response): Promise<any>;
}
export {};
