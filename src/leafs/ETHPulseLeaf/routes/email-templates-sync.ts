import { Controller, Get, Post, Delete, Request, Response } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'
import etherial from 'etherial'
import { getDefaultContent } from '../seeds/email-template-defaults.js'

const getAdminLeaf = () => (etherial as any).eth_admin_leaf
const getPulseLeaf = () => (etherial as any).eth_pulse_leaf

const getEmailTemplateModel = () => {
    return etherial.database!.sequelize.models.EmailTemplate as any
}

/**
 * Returns the sync status between config-declared templates and DB rows.
 * - missing: keys x locales that exist in config but not in DB
 * - orphans: DB rows whose key is not in config
 */
async function computeSync() {
    const pulseLeaf = getPulseLeaf()
    const templatesConfig = pulseLeaf?.config?.email?.templates
    if (!templatesConfig) {
        return { missing: [], orphans: [], configKeys: [], locales: [] }
    }

    const configKeys = Object.keys(templatesConfig.emails)
    const locales = templatesConfig.locales || ['en']
    const EmailTemplate = getEmailTemplateModel()

    const allTemplates = await EmailTemplate.findAll({
        attributes: ['id', 'key', 'locale'],
        raw: true,
    })

    // Build a set of existing key:locale combos
    const existingSet = new Set(allTemplates.map((t: any) => `${t.key}:${t.locale}`))

    // Missing: in config but not in DB
    const missing: { key: string; locale: string; variables: string[] }[] = []
    for (const key of configKeys) {
        for (const locale of locales) {
            if (!existingSet.has(`${key}:${locale}`)) {
                missing.push({ key, locale, variables: templatesConfig.emails[key] })
            }
        }
    }

    // Orphans: in DB but key not in config
    const configKeySet = new Set(configKeys)
    const orphans: { id: number; key: string; locale: string }[] = []
    for (const t of allTemplates) {
        if (!configKeySet.has((t as any).key)) {
            orphans.push({ id: (t as any).id, key: (t as any).key, locale: (t as any).locale })
        }
    }

    return { missing, orphans, configKeys, locales }
}

@Controller()
export default class EmailTemplateSyncController {

    /**
     * GET /admin/email-templates/sync
     * Returns missing and orphan templates
     */
    @Get('/admin/email-templates/sync')
    @ShouldBeAuthenticated()
    public async getSync(req: Request & { user: any }, res: Response): Promise<any> {
        const adminLeaf = getAdminLeaf()
        if (adminLeaf) {
            const hasAccess = await adminLeaf.canAccessAdmin(req.user)
            if (!hasAccess) {
                return (res as any).error({ status: 403, errors: ['Forbidden'] })
            }
        }

        const sync = await computeSync()

        return (res as any).success({
            status: 200,
            data: sync,
        })
    }

    /**
     * POST /admin/email-templates/sync/create
     * Creates a missing template with default content
     * Body: { key: string, locale: string }
     */
    @Post('/admin/email-templates/sync/create')
    @ShouldBeAuthenticated()
    public async createMissing(req: Request & { user: any }, res: Response): Promise<any> {
        const adminLeaf = getAdminLeaf()
        if (adminLeaf) {
            const hasAccess = await adminLeaf.canAccessAdmin(req.user)
            if (!hasAccess) {
                return (res as any).error({ status: 403, errors: ['Forbidden'] })
            }
        }

        const { key, locale } = req.body
        if (!key || !locale) {
            return (res as any).error({ status: 400, errors: ['key and locale are required'] })
        }

        const EmailTemplate = getEmailTemplateModel()

        // Check if already exists
        const existing = await EmailTemplate.findOne({ where: { key, locale } })
        if (existing) {
            return (res as any).error({ status: 409, errors: [`Template "${key}" (${locale}) already exists`] })
        }

        const content = getDefaultContent(key, locale)

        const template = await EmailTemplate.create({
            key,
            locale,
            subject: content.subject,
            title: content.title || null,
            greeting: content.greeting || null,
            body: content.body,
            button_text: content.button_text || null,
            button_url: content.button_url || null,
            footer: content.footer || null,
            enabled: true,
        })

        return (res as any).success({
            status: 201,
            data: template,
            message: `Template "${key}" (${locale}) created`,
        })
    }

    /**
     * DELETE /admin/email-templates/sync/orphan/:id
     * Removes an orphan template (key not in config)
     */
    @Delete('/admin/email-templates/sync/orphan/:id')
    @ShouldBeAuthenticated()
    public async removeOrphan(req: Request & { user: any }, res: Response): Promise<any> {
        const adminLeaf = getAdminLeaf()
        if (adminLeaf) {
            const hasAccess = await adminLeaf.canAccessAdmin(req.user)
            if (!hasAccess) {
                return (res as any).error({ status: 403, errors: ['Forbidden'] })
            }
        }

        const { id } = req.params
        const EmailTemplate = getEmailTemplateModel()

        const template = await EmailTemplate.findByPk(id)
        if (!template) {
            return (res as any).error({ status: 404, errors: ['Template not found'] })
        }

        // Verify it's actually an orphan (key not in config)
        const pulseLeaf = getPulseLeaf()
        const configKeys = Object.keys(pulseLeaf?.config?.email?.templates?.emails || {})
        if (configKeys.includes(template.key)) {
            return (res as any).error({ status: 400, errors: [`Template "${template.key}" is still declared in config — not an orphan`] })
        }

        await template.destroy()

        return (res as any).success({
            status: 200,
            message: `Orphan template "${template.key}" (${template.locale}) removed`,
        })
    }
}
