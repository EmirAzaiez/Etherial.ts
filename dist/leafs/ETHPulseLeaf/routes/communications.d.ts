import { Request, Response } from 'etherial/components/http/provider';
export default class ETHPulseCommunicationsController {
    /**
     * GET /admin/pulse/users/:id/communications?before=ISO&limit=30&channel=push
     *
     * Everything the user was sent, newest first, and their devices. Whoever
     * may open the user's record may read it.
     */
    userCommunications(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
}
