import { Controller, Get, Post, Request, Response } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'
import etherial from 'etherial'

import type { FieldDefinition } from '../../ETHAdminLeaf/features/ActionRegistry.js'
import { CAMPAIGNS_COLLECTION, campaignTargeting, modelDefaults } from '../admin/campaigns.js'
import { campaignsConfig, previewCampaignAudience, recordCampaignOpen } from '../services/campaigns.js'

type AuthedRequest = Request & { user: any }

/** A targeting value as the query string carries it ("true", "12", ""), read as its column holds it. */
function readTargeting(field: FieldDefinition, raw: unknown): unknown {
    if (raw === undefined || Array.isArray(raw)) {
        return raw
    }
    const text = String(raw)
    if (text === '' || text === 'null') {
        return null
    }
    if (field.type === 'boolean') {
        return text === 'true' || text === '1'
    }
    if (field.type === 'integer' || field.type === 'number' || field.type === 'relation') {
        const value = Number(text)
        return Number.isFinite(value) ? value : null
    }
    return text
}

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

    /**
     * Who the campaign being written would reach: the targeting of the form,
     * one query key per targeting field, the others at the model's defaults.
     * Takes the right to read the campaigns.
     */
    @Get('/admin/pulse/campaign-audience')
    @ShouldBeAuthenticated()
    public async audience(req: AuthedRequest, res: Response): Promise<any> {
        const adminLeaf = (etherial as any).eth_admin_leaf
        const allowed =
            !!adminLeaf && (await adminLeaf.canAccessAdmin(req.user)) && (await adminLeaf.checkAccess(req.user, CAMPAIGNS_COLLECTION, 'list'))
        if (!allowed) {
            return res.error({ status: 403, errors: ['forbidden'] })
        }

        try {
            const cfg = campaignsConfig()
            const draft = modelDefaults(cfg.models.campaign)
            for (const field of campaignTargeting(cfg)) {
                const value = readTargeting(field, req.query[field.name])
                if (value !== undefined) {
                    draft[field.name] = value
                }
            }
            return res.success({ status: 200, data: await previewCampaignAudience(draft) })
        } catch (err) {
            console.error('[Campaigns] audience count failed:', err)
            return res.error({ status: 500, errors: ['Failed to count the audience.'] })
        }
    }
}
