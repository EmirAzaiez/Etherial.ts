import type { Request, Response } from 'express';
type AuthedRequest = Request & {
    user: any;
};
export default class ETHSurveyAppController {
    /**
     * GET /surveys/pending
     *
     * The question waiting for the signed-in person, worded in their language,
     * or `null`. One at a time, the oldest first.
     */
    pending(req: AuthedRequest, res: Response): Promise<any>;
    /** POST /surveys/:id/answer { score, comment? } */
    answer(req: AuthedRequest, res: Response): Promise<any>;
    /** POST /surveys/:id/dismiss — "Not now": the question is not asked again. */
    dismiss(req: AuthedRequest, res: Response): Promise<any>;
}
export {};
