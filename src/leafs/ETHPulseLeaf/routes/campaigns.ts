import { Controller, Post, Request, Response } from 'etherial/components/http/provider'

import { recordCampaignOpen } from '../services/campaigns.js'

@Controller()
export default class ETHPulseCampaignsController {
    /**
     * A campaign push was tapped. Called by the app with its installation id
     * (the `device` it registered with). Public on purpose: the person may have
     * logged out since the push went out, and all this can do is flag a
     * delivery as opened — once.
     */
    @Post('/campaigns/:id/opened')
    public async opened(req: Request & { params: { id: string }; body: { device?: string } }, res: Response): Promise<any> {
        const campaignId = parseInt(req.params.id, 10)
        const device = typeof req.body?.device === 'string' ? req.body.device.trim() : ''
        if (!campaignId || !device) {
            return res.error({ status: 400, errors: ['campaign id and device are required'] })
        }

        try {
            const counted = await recordCampaignOpen(campaignId, device)
            return res.success({ status: 200, data: { counted } })
        } catch (err) {
            console.error('[Campaigns] open tracking failed:', err)
            return res.error({ status: 500, errors: ['Failed to record the open.'] })
        }
    }
}
