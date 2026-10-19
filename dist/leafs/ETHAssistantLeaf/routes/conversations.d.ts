import type { Request, Response } from 'express';
type AuthedRequest = Request & {
    user: any;
};
export default class ETHAssistantConversationsController {
    /** GET /admin/assistant/conversations?q= → { items: [{ id, title, turns, created_at, updated_at }] }, latest first */
    list(req: AuthedRequest, res: Response): Promise<any>;
    /** GET /admin/assistant/conversations/:id → { id, title, turns, created_at, updated_at } */
    show(req: AuthedRequest, res: Response): Promise<any>;
    /** PUT /admin/assistant/conversations/:id { title } */
    rename(req: AuthedRequest, res: Response): Promise<any>;
    /** DELETE /admin/assistant/conversations/:id */
    remove(req: AuthedRequest, res: Response): Promise<any>;
    /**
     * POST /admin/assistant/conversations/:id/decisions
     * { proposal, status: 'confirmed' | 'cancelled' | 'failed', error?, createdId? }
     *
     * Only a note on the card, for the conversation to show it when reopened:
     * the change itself went through the back-office's own endpoint.
     */
    decide(req: AuthedRequest, res: Response): Promise<any>;
}
export {};
