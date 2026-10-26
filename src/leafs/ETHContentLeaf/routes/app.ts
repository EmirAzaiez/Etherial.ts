import type { Request, Response } from 'express'
import { Op } from 'sequelize'
import { Controller, Get } from 'etherial/components/http/provider'

import { Banner } from '../models/Banner.js'
import { Contact } from '../models/Contact.js'
import { FaqQuestion } from '../models/FaqQuestion.js'
import { FaqSection } from '../models/FaqSection.js'
import { LegalDocument } from '../models/LegalDocument.js'
import { Office } from '../models/Office.js'
import { Story } from '../models/Story.js'
import { StorySlide } from '../models/StorySlide.js'
import { isSignedIn, localeOf } from '../services/http.js'
import { languages as languagesNow } from '../services/state.js'
import { mediaInclude } from '../services/media.js'
import { serializeBanner, serializeContact, serializeFaqSection, serializeLegal, serializeOffice, serializeStory } from '../services/serialize.js'
import { appUpdateOf, platformOf } from '../services/versions.js'

const ORDER: [string, string][] = [
    ['position', 'ASC'],
    ['id', 'ASC'],
]

/** Published, for whoever asks, between its dates. */
async function liveWhere(req: Request) {
    const now = new Date()
    return {
        published: true,
        audience: { [Op.in]: (await isSignedIn(req)) ? ['everyone', 'signed_in'] : ['everyone', 'guests'] },
        [Op.and]: [{ [Op.or]: [{ starts_at: null }, { starts_at: { [Op.lte]: now } }] }, { [Op.or]: [{ ends_at: null }, { ends_at: { [Op.gt]: now } }] }],
    }
}

/**
 * No sign-in: these are what the company tells everyone, guests included.
 * Only banners and stories look at who asks (their audience). A draft is
 * never served. Each answer says the language it is written in.
 */
@Controller()
export default class ETHContentAppController {
    /** GET /content/languages — those the app gets, the default first: for a language picker. */
    @Get('/content/languages')
    async languages(req: Request, res: Response): Promise<any> {
        const locale = localeOf(req)
        const { app, default: fallback, names, rtl } = languagesNow()
        const list = app.map((code) => ({ code, name: names[code] ?? code, rtl: rtl.includes(code), default: code === fallback }))
        return (res as any).success({ status: 200, data: { locale, default: fallback, languages: list } })
    }

    /** GET /content/faq — the sections and their questions, in order. A section without a question isn't sent. */
    @Get('/content/faq')
    async faq(req: Request, res: Response): Promise<any> {
        const locale = localeOf(req)
        const sections = await FaqSection.findAll({
            where: { published: true },
            include: [{ model: FaqQuestion, as: 'questions', where: { published: true }, required: true }],
            order: [...ORDER, [{ model: FaqQuestion, as: 'questions' }, 'position', 'ASC'], [{ model: FaqQuestion, as: 'questions' }, 'id', 'ASC']] as any,
        })
        return (res as any).success({ status: 200, data: { locale, sections: sections.map((s) => serializeFaqSection(s, locale)) } })
    }

    /** GET /content/contacts — the ways to reach the company, and its offices. */
    @Get('/content/contacts')
    async contacts(req: Request, res: Response): Promise<any> {
        const locale = localeOf(req)
        const [channels, offices] = await Promise.all([
            Contact.findAll({ where: { published: true }, order: ORDER as any }),
            Office.findAll({ where: { published: true }, order: ORDER as any }),
        ])
        return (res as any).success({
            status: 200,
            data: { locale, channels: channels.map((c) => serializeContact(c, locale)), offices: offices.map((o) => serializeOffice(o, locale)) },
        })
    }

    /** GET /content/legal — the published documents, without their text. */
    @Get('/content/legal')
    async legal(req: Request, res: Response): Promise<any> {
        const locale = localeOf(req)
        const docs = await LegalDocument.findAll({ where: { published: true }, order: ORDER as any })
        return (res as any).success({ status: 200, data: { locale, documents: docs.map((d) => serializeLegal(d, locale)) } })
    }

    /** GET /content/legal/:slug — one document, with its text (HTML). */
    @Get('/content/legal/:slug')
    async legalDocument(req: Request, res: Response): Promise<any> {
        const slug = String(req.params.slug ?? '').toLowerCase()
        const doc = /^[a-z0-9-]{1,80}$/.test(slug) ? await LegalDocument.findOne({ where: { slug, published: true } }) : null
        if (!doc) return (res as any).error({ status: 404, errors: ['legal_document_not_found'] })
        const locale = localeOf(req)
        return (res as any).success({ status: 200, data: { locale, ...serializeLegal(doc, locale, true) } })
    }

    /** GET /content/banners — the home screen's carousel, for whoever asks. A banner whose image is gone isn't sent. */
    @Get('/content/banners')
    async banners(req: Request, res: Response): Promise<any> {
        const locale = localeOf(req)
        const banners = await Banner.findAll({ where: await liveWhere(req), include: mediaInclude(Banner, 'image'), order: ORDER as any })
        const data = banners.map((b) => serializeBanner(b, locale)).filter((b) => b.image)
        return (res as any).success({ status: 200, data: { locale, banners: data } })
    }

    /** GET /content/stories — the bubbles and their slides, for whoever asks. A story without a slide to show isn't sent. */
    @Get('/content/stories')
    async stories(req: Request, res: Response): Promise<any> {
        const locale = localeOf(req)
        const stories = await Story.findAll({
            where: await liveWhere(req),
            include: [...mediaInclude(Story, 'cover'), { model: StorySlide, as: 'slides', include: mediaInclude(StorySlide, 'image') }],
            order: [...ORDER, [{ model: StorySlide, as: 'slides' }, 'position', 'ASC'], [{ model: StorySlide, as: 'slides' }, 'id', 'ASC']] as any,
        })
        const data = stories.map((s) => serializeStory(s, locale)).filter((s) => s.slides.length)
        return (res as any).success({ status: 200, data: { locale, stories: data } })
    }

    /**
     * GET /content/app-version?platform=ios&version=1.4.2 — whether the app
     * must, or is asked to, update. The app's own headers do too
     * (`x-app-platform`, `x-app-version`).
     */
    @Get('/content/app-version')
    async appVersion(req: Request, res: Response): Promise<any> {
        const platform = platformOf(req.query.platform ?? req.headers['x-app-platform'])
        if (!platform) return (res as any).error({ status: 400, errors: ['invalid_platform'] })
        const asked = req.query.version ?? req.headers['x-app-version']
        const locale = localeOf(req)
        const update = await appUpdateOf(platform, typeof asked === 'string' ? asked.trim() : null, locale)
        return (res as any).success({ status: 200, data: { locale, ...update } })
    }
}
