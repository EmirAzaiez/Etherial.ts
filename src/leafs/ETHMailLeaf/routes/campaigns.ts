import type { Response } from 'express'
import { Controller, Delete, Get, Post, Put } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'

import {
    cancelCampaign,
    countAudience,
    createCampaign,
    deleteCampaign,
    duplicateCampaign,
    listAudiences,
    listCampaigns,
    listRecipients,
    previewCampaign,
    readCampaign,
    scheduleCampaign,
    testCampaign,
    unscheduleCampaign,
    updateCampaign,
} from '../services/campaigns.js'
import { AuthedRequest, guard, originOf } from '../services/http.js'
import { CAMPAIGNS_COLLECTION } from '../services/options.js'

/** The rights are the campaigns collection's: read, create, update (which sends), delete. */
const can = (method: 'list' | 'create' | 'update' | 'delete') => (req: AuthedRequest, res: Response, run: () => Promise<any>) =>
    guard(req, res, CAMPAIGNS_COLLECTION, method, run)
const read = can('list')
const create = can('create')
const write = can('update')
const remove = can('delete')

const userId = (req: AuthedRequest) => req.user?.id ?? null

@Controller()
export default class ETHMailCampaignsController {
    @Get('/admin/mail-audiences')
    @ShouldBeAuthenticated()
    async audiences(req: AuthedRequest, res: Response) {
        return read(req, res, () => listAudiences())
    }

    @Get('/admin/mail-audiences/count')
    @ShouldBeAuthenticated()
    async countAudience(req: AuthedRequest, res: Response) {
        return read(req, res, () => countAudience(req.query.audience))
    }

    @Get('/admin/mail-campaigns')
    @ShouldBeAuthenticated()
    async list(req: AuthedRequest, res: Response) {
        return read(req, res, () => listCampaigns(req.query))
    }

    @Post('/admin/mail-campaigns')
    @ShouldBeAuthenticated()
    async create(req: AuthedRequest, res: Response) {
        return create(req, res, () => createCampaign(req.body, userId(req)))
    }

    @Post('/admin/mail-campaigns/preview')
    @ShouldBeAuthenticated()
    async preview(req: AuthedRequest, res: Response) {
        return read(req, res, () => previewCampaign(req.body, originOf(req)))
    }

    @Get('/admin/mail-campaigns/:id')
    @ShouldBeAuthenticated()
    async show(req: AuthedRequest, res: Response) {
        return read(req, res, () => readCampaign(req.params.id))
    }

    @Put('/admin/mail-campaigns/:id')
    @ShouldBeAuthenticated()
    async update(req: AuthedRequest, res: Response) {
        return write(req, res, () => updateCampaign(req.params.id, req.body, userId(req)))
    }

    @Delete('/admin/mail-campaigns/:id')
    @ShouldBeAuthenticated()
    async destroy(req: AuthedRequest, res: Response) {
        return remove(req, res, () => deleteCampaign(req.params.id))
    }

    @Get('/admin/mail-campaigns/:id/recipients')
    @ShouldBeAuthenticated()
    async recipients(req: AuthedRequest, res: Response) {
        return read(req, res, () => listRecipients(req.params.id, req.query))
    }

    @Post('/admin/mail-campaigns/:id/duplicate')
    @ShouldBeAuthenticated()
    async duplicate(req: AuthedRequest, res: Response) {
        return create(req, res, () => duplicateCampaign(req.params.id, userId(req)))
    }

    @Post('/admin/mail-campaigns/:id/test')
    @ShouldBeAuthenticated()
    async test(req: AuthedRequest, res: Response) {
        return write(req, res, () => testCampaign(req.body, req.user?.email ?? null, originOf(req)))
    }

    @Post('/admin/mail-campaigns/:id/schedule')
    @ShouldBeAuthenticated()
    async schedule(req: AuthedRequest, res: Response) {
        return write(req, res, () => scheduleCampaign(req.params.id, req.body, userId(req), originOf(req)))
    }

    @Post('/admin/mail-campaigns/:id/unschedule')
    @ShouldBeAuthenticated()
    async unschedule(req: AuthedRequest, res: Response) {
        return write(req, res, () => unscheduleCampaign(req.params.id, userId(req)))
    }

    @Post('/admin/mail-campaigns/:id/cancel')
    @ShouldBeAuthenticated()
    async cancel(req: AuthedRequest, res: Response) {
        return write(req, res, () => cancelCampaign(req.params.id, userId(req)))
    }
}
