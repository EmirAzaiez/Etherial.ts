import type { Request, Response } from 'express';
type AuthedRequest = Request & {
    user: any;
};
export default class ETHAssistantAdminController {
    /**
     * POST /admin/assistant/ask
     * { task: 'ask' | 'summarize' | 'draft', messages: [{ role, content }], context?: { collection, id?, filters?, search?, view?, form?, flow? }, language?: 'en' | 'ar',
     *   conversationId?, where? }
     * → { answer, steps, model, usage, proposals?, conversationId? }
     *
     * `proposals`: changes prepared for the person to confirm (leaf's `proposals` on).
     * `conversationId`: where the turn was kept (leaf's `history` on); sent back
     * with the next question to carry on the same conversation.
     */
    ask(req: AuthedRequest, res: Response): Promise<any>;
}
export {};
