import type { Request, Response } from 'express';
type AuthedRequest = Request & {
    user: any;
};
export default class ETHCaseAdminController {
    /**
     * GET /admin/cases/:id/thread
     *
     * The case's conversation for the back-office panel: the messages (internal
     * notes too) and the history, merged by date; the canned replies ready to
     * use; and what the staff member may do here.
     */
    thread(req: AuthedRequest, res: Response): Promise<any>;
    /**
     * POST /admin/cases/:id/replies
     * `{ body, internal?, attachments?: [mediaId], status?, canned_reply_id? }`
     *
     * A staff reply (the customer is told) or an internal note, signed by the
     * staff member; `status` moves the case in the same go. Files are Media
     * rows the staff member uploaded through the back-office first.
     */
    reply(req: AuthedRequest, res: Response): Promise<any>;
}
export {};
