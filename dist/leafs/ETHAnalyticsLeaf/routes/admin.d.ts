import type { Request, Response } from 'express';
type AuthedRequest = Request & {
    user: any;
};
export default class ETHAnalyticsAdminController {
    /** GET /admin/insights/overview?from=YYYY-MM-DD&to=YYYY-MM-DD */
    overview(req: AuthedRequest, res: Response): Promise<any>;
    /** GET /admin/insights/live — who is in the app in the last 5 minutes. */
    live(req: AuthedRequest, res: Response): Promise<any>;
    /** GET /admin/insights/events?type=screen|action|api|app&from&to */
    events(req: AuthedRequest, res: Response): Promise<any>;
    /** GET /admin/insights/flows?type=screen&name=HomeScreen&from&to */
    flows(req: AuthedRequest, res: Response): Promise<any>;
    /** GET /admin/insights/funnel?steps=screen:A,api:POST /x&scope=session|person&from&to */
    funnel(req: AuthedRequest, res: Response): Promise<any>;
    /** GET /admin/insights/retention?weeks=8&who=users|all */
    retention(req: AuthedRequest, res: Response): Promise<any>;
    /** GET /admin/insights/users/:id?before=<ISO date> — one user's visits and habits. */
    user(req: AuthedRequest, res: Response): Promise<any>;
    /** GET /admin/insights/sessions/:id — one visit, step by step. */
    session(req: AuthedRequest, res: Response): Promise<any>;
}
export {};
