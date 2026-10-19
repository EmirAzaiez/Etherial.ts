import type { Request, Response } from 'express';
export default class ETHAdminNotificationsController {
    /**
     * GET /admin/notifications?unread=1&page=1&limit=20
     *
     * The person's notifications, newest first, each with who caused it.
     */
    list(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /** GET /admin/notifications/unread-count: what the bell polls. */
    unreadCount(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /** POST /admin/notifications/:id/read */
    markRead(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /** POST /admin/notifications/read-all */
    markAllRead(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
}
