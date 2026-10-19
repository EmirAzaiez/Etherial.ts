import { Request, Response } from 'etherial/components/http/provider';
export default class ETHPulseCampaignsController {
    /**
     * A campaign push was tapped. Called by the app with its installation id
     * (the `device` it registered with). Public on purpose: the person may have
     * logged out since the push went out, and all this can do is flag a
     * delivery as opened — once.
     */
    opened(req: Request & {
        params: {
            id: string;
        };
        body: {
            device?: string;
        };
    }, res: Response): Promise<any>;
}
