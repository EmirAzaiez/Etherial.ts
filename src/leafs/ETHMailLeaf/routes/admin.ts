import type { Response } from 'express'
import { Controller, Delete, Get, Post, Put } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'

import { AuthedRequest, guard } from '../services/http.js'
import { TEMPLATES_COLLECTION } from '../services/options.js'
import { listMails, listVersions, previewMail, previewTheme, readMail, readVersion, resetMail, saveMail, testMail } from '../services/templates.js'
import { readTheme, resetTheme, saveTheme } from '../services/theme.js'

/**
 * Reading the emails and their brand takes the right to read the templates
 * collection; changing them, or sending a test, the right to update it.
 */
const read = (req: AuthedRequest, res: Response, run: () => Promise<any>) => guard(req, res, TEMPLATES_COLLECTION, 'list', run)
const write = (req: AuthedRequest, res: Response, run: () => Promise<any>) => guard(req, res, TEMPLATES_COLLECTION, 'update', run)

@Controller()
export default class ETHMailAdminController {
    // The brand first: `/admin/email-theme` is not an email key.
    @Get('/admin/email-theme')
    @ShouldBeAuthenticated()
    async theme(req: AuthedRequest, res: Response) {
        return read(req, res, () => readTheme())
    }

    @Post('/admin/email-theme/preview')
    @ShouldBeAuthenticated()
    async previewBrand(req: AuthedRequest, res: Response) {
        return read(req, res, () => previewTheme(req.body))
    }

    @Put('/admin/email-theme')
    @ShouldBeAuthenticated()
    async saveBrand(req: AuthedRequest, res: Response) {
        return write(req, res, () => saveTheme(req.body?.theme ?? req.body, req.user?.id ?? null))
    }

    @Delete('/admin/email-theme')
    @ShouldBeAuthenticated()
    async resetBrand(req: AuthedRequest, res: Response) {
        return write(req, res, () => resetTheme())
    }

    @Get('/admin/emails')
    @ShouldBeAuthenticated()
    async list(req: AuthedRequest, res: Response) {
        return read(req, res, () => listMails())
    }

    @Get('/admin/emails/:key')
    @ShouldBeAuthenticated()
    async show(req: AuthedRequest, res: Response) {
        return read(req, res, () => readMail(req.params.key, req.query.locale))
    }

    @Get('/admin/emails/:key/versions')
    @ShouldBeAuthenticated()
    async versions(req: AuthedRequest, res: Response) {
        return read(req, res, () => listVersions(req.params.key, req.query.locale))
    }

    @Get('/admin/emails/:key/versions/:id')
    @ShouldBeAuthenticated()
    async version(req: AuthedRequest, res: Response) {
        return read(req, res, () => readVersion(req.params.key, req.params.id))
    }

    @Post('/admin/emails/:key/preview')
    @ShouldBeAuthenticated()
    async preview(req: AuthedRequest, res: Response) {
        return read(req, res, () => previewMail(req.params.key, req.body))
    }

    @Put('/admin/emails/:key')
    @ShouldBeAuthenticated()
    async save(req: AuthedRequest, res: Response) {
        return write(req, res, () => saveMail(req.params.key, req.body, req.user?.id ?? null))
    }

    @Delete('/admin/emails/:key')
    @ShouldBeAuthenticated()
    async reset(req: AuthedRequest, res: Response) {
        return write(req, res, () => resetMail(req.params.key, req.query.locale, req.user?.id ?? null))
    }

    @Post('/admin/emails/:key/test')
    @ShouldBeAuthenticated()
    async test(req: AuthedRequest, res: Response) {
        return write(req, res, () => testMail(req.params.key, req.body, req.user?.email ?? null))
    }
}
