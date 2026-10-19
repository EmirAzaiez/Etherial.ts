import { Request, Response } from 'etherial/components/http/provider';
type AuthedRequest = Request & {
    user: any;
};
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
    /**
     * Who the campaign being written would reach: the targeting of the form,
     * one query key per targeting field, the others at the model's defaults.
     * Takes the right to read the campaigns.
     */
    audience(req: AuthedRequest, res: Response): Promise<any>;
}
export {};
