import type { Request, Response } from 'express';
/** No sign-in: a page is public, its HTML is in the bucket for anyone with the link. */
export default class ETHPageAppController {
    /**
     * GET /pages
     *
     * Every published page, in the app's language, blocks included: the app
     * keeps them and opens a page without waiting. Its menu lists those
     * `in_menu`, in `position` order; the others open from a link or a push.
     * The pages of other records (a news) come with them, not here.
     */
    list(req: Request, res: Response): Promise<any>;
    /** GET /pages/:slug — one published page, in the menu or not, a news' one too: its link opens it. */
    show(req: Request, res: Response): Promise<any>;
    /**
     * GET /page-calendar/event.ics?title&date&until&start&end&place[&as=google|outlook|file]
     *
     * An event's "Add to calendar" (see calendar.ts): the file for an iPhone
     * or a computer, Google Calendar's page for an Android phone, or what
     * `as` asks. Its times are in the project's timezone.
     */
    calendar(req: Request, res: Response): Promise<any>;
}
