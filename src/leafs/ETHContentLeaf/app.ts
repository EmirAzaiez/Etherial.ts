import etherial, { Etherial } from 'etherial'
import * as path from 'path'
import { fileURLToPath } from 'url'

import { registerMediaReferences } from '../ETHMediaLeaf/models/Media.js'
import { AppRelease } from './models/AppRelease.js'
import { Banner } from './models/Banner.js'
import { Contact } from './models/Contact.js'
import { ContentLanguage } from './models/ContentLanguage.js'
import { FaqQuestion } from './models/FaqQuestion.js'
import { FaqSection } from './models/FaqSection.js'
import { LegalDocument } from './models/LegalDocument.js'
import { Office } from './models/Office.js'
import { Story } from './models/Story.js'
import { StorySlide } from './models/StorySlide.js'
import { registerContentAdmin } from './admin/collections.js'
import { linkMedia, usedMediaIds } from './services/media.js'
import { seedContent, seedLanguages } from './services/seed.js'
import { state } from './services/state.js'
import { ContentFeature, ETHContentLeafConfig, featuresOf, folderOf } from './services/options.js'

export * from './services/options.js'
export { AppRelease } from './models/AppRelease.js'
export { Banner } from './models/Banner.js'
export { Contact } from './models/Contact.js'
export { ContentLanguage } from './models/ContentLanguage.js'
export { FaqQuestion } from './models/FaqQuestion.js'
export { FaqSection } from './models/FaqSection.js'
export { LegalDocument } from './models/LegalDocument.js'
export { Office } from './models/Office.js'
export { Story } from './models/Story.js'
export { StorySlide } from './models/StorySlide.js'
export { hrefOf } from './services/serialize.js'
export { localeOf, isSignedIn } from './services/http.js'
export { languages } from './services/state.js'
export { appUpdateOf, platformOf } from './services/versions.js'
export type { AppUpdate, UpdateKind } from './services/versions.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** How often a server reads the languages again: those another one saved. */
const LANGUAGES_REFRESH_MS = 60_000

/** Each content's tables and the controller's methods that serve it. */
const PARTS: Record<ContentFeature, { models: any[]; methods: string[] }> = {
    languages: { models: [ContentLanguage], methods: ['languages'] },
    faq: { models: [FaqSection, FaqQuestion], methods: ['faq'] },
    contacts: { models: [Contact, Office], methods: ['contacts'] },
    legal: { models: [LegalDocument], methods: ['legal', 'legalDocument'] },
    banners: { models: [Banner], methods: ['banners'] },
    stories: { models: [Story, StorySlide], methods: ['stories'] },
    versions: { models: [AppRelease], methods: ['appVersion'] },
}

/**
 * ETHContentLeaf — what every app shows and the team keeps up to date,
 * written in the back-office in each language:
 *
 * - the languages themselves: those the contents are written in, the
 *   default one, those the app gets (`GET /content/languages`);
 * - the FAQ: sections and their questions (`GET /content/faq`);
 * - the contacts: phone, WhatsApp, email, social accounts, and the offices
 *   with their address, hours and pin (`GET /content/contacts`);
 * - the legal documents: terms, privacy policy, as a text or a page of the
 *   website (`GET /content/legal`, `GET /content/legal/:slug`);
 * - the banners of the home screen's carousel (`GET /content/banners`);
 * - the stories: bubbles and their full-screen slides (`GET /content/stories`);
 * - the app's versions: whether an older app is asked, or made, to update
 *   from the store (`GET /content/app-version`).
 *
 * The same contents for everyone, guests included; banners and stories can
 * be kept to the signed-in or to guests, and to dates. A project picks the
 * contents it offers (`features`), and a new server can start with some
 * (`seed`). The images go to one of the media leaf's public-read folders.
 */
export default class ETHContentLeaf {
    readonly etherial_module_name = 'eth_content_leaf'

    public config: ETHContentLeafConfig
    private routes: { route: string; methods: string[] }[] = []

    constructor(config: ETHContentLeafConfig = {}) {
        this.config = config
        state.config = config
        const methods = featuresOf(config).flatMap((feature) => PARTS[feature]?.methods ?? [])
        if (methods.length) this.routes.push({ route: path.join(__dirname, 'routes/app'), methods })
    }

    /** Lifecycle: beforeRun — the tables to the database before it syncs, the collections to the back-office. */
    beforeRun({ database }: Etherial) {
        const features = featuresOf(this.config)
        database?.addModels(features.flatMap((feature) => PARTS[feature]?.models ?? []) as any)
        registerContentAdmin((etherial as any).eth_admin_leaf, this.config)
        if (features.includes('banners') || features.includes('stories')) registerMediaReferences(() => usedMediaIds(this.config))
    }

    run({ http }: Etherial) {
        http?.routes_leafs?.push(...this.routes)

        const features = featuresOf(this.config)
        if (features.includes('versions')) {
            const missing = (['ios', 'android'] as const).filter((p) => !this.config.stores?.[p])
            if (missing.length) console.warn(`[ETHContentLeaf] No store page for ${missing.join(', ')} (stores): the update button has nowhere to go`)
        }
        if (!features.includes('banners') && !features.includes('stories')) return
        const media = (etherial as any).eth_media_leaf
        const folder = folderOf(this.config)
        if (!media) console.warn('[ETHContentLeaf] No media leaf: banners and stories have no image, the app gets none')
        else if (media.getRuleForFolder?.(folder)?.visibility !== 'public-read') {
            console.warn(`[ETHContentLeaf] The media leaf has no public-read rule for "${folder}": the images of banners and stories can't be shown`)
        }
    }

    /** Lifecycle: afterRun — the images tied to the project's media model, the languages, then the first contents of a new server. */
    async afterRun() {
        const features = featuresOf(this.config)
        if ((features.includes('banners') || features.includes('stories')) && !linkMedia(this.config)) {
            console.warn(`[ETHContentLeaf] No "${this.config.mediaModel ?? 'Media'}" model: banners and stories are sent without their images`)
        }
        if (features.includes('languages')) {
            try {
                const written = await seedLanguages(this.config)
                if (written.length) console.log(`[ETHContentLeaf] First languages written: ${written.join(', ')}`)
                await ContentLanguage.load()
            } catch (err) {
                console.error('[ETHContentLeaf] The languages could not be read, the config\'s are used:', err)
            }
            // Those another server saved; this one's own saves are read at once.
            setInterval(() => ContentLanguage.load().catch(() => {}), LANGUAGES_REFRESH_MS).unref()
        }
        try {
            const written = await seedContent(this.config)
            if (written.length) console.log(`[ETHContentLeaf] First contents written: ${written.join(', ')}`)
        } catch (err) {
            console.error('[ETHContentLeaf] The first contents could not be written:', err)
        }
    }
}
