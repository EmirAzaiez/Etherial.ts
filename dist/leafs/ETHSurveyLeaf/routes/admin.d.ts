import type { Request, Response } from 'express';
type AuthedRequest = Request & {
    user: any;
};
export default class ETHSurveyAdminController {
    /** GET /admin/surveys — the surveys, on or off, for the Surveys page. */
    list(req: AuthedRequest, res: Response): Promise<any>;
    /** GET /admin/surveys/targets?event= — the values a survey of this event can be narrowed to. */
    targets(req: AuthedRequest, res: Response): Promise<any>;
    /** GET /admin/surveys/overview?survey=&from=YYYY-MM-DD&to=YYYY-MM-DD */
    overview(req: AuthedRequest, res: Response): Promise<any>;
    /** GET /admin/surveys/stats?from=YYYY-MM-DD&to=YYYY-MM-DD — each survey's numbers, for their list. */
    stats(req: AuthedRequest, res: Response): Promise<any>;
    /** GET /admin/surveys/comments?survey=&from=&to=&group=high|mid|low&all=1&limit=&before= */
    comments(req: AuthedRequest, res: Response): Promise<any>;
    /** GET /admin/surveys/users/:id — everything one person was asked. */
    user(req: AuthedRequest, res: Response): Promise<any>;
}
export {};
