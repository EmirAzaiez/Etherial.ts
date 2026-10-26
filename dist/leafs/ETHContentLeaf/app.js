var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import etherial from 'etherial';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { registerMediaReferences } from '../ETHMediaLeaf/models/Media.js';
import { AppRelease } from './models/AppRelease.js';
import { Banner } from './models/Banner.js';
import { Contact } from './models/Contact.js';
import { ContentLanguage } from './models/ContentLanguage.js';
import { FaqQuestion } from './models/FaqQuestion.js';
import { FaqSection } from './models/FaqSection.js';
import { LegalDocument } from './models/LegalDocument.js';
import { Office } from './models/Office.js';
import { Story } from './models/Story.js';
import { StorySlide } from './models/StorySlide.js';
import { registerContentAdmin } from './admin/collections.js';
import { linkMedia, usedMediaIds } from './services/media.js';
import { seedContent, seedLanguages } from './services/seed.js';
import { state } from './services/state.js';
import { featuresOf, folderOf } from './services/options.js';
export * from './services/options.js';
export { AppRelease } from './models/AppRelease.js';
export { Banner } from './models/Banner.js';
export { Contact } from './models/Contact.js';
export { ContentLanguage } from './models/ContentLanguage.js';
export { FaqQuestion } from './models/FaqQuestion.js';
export { FaqSection } from './models/FaqSection.js';
export { LegalDocument } from './models/LegalDocument.js';
export { Office } from './models/Office.js';
export { Story } from './models/Story.js';
export { StorySlide } from './models/StorySlide.js';
export { hrefOf } from './services/serialize.js';
export { localeOf, isSignedIn } from './services/http.js';
export { languages } from './services/state.js';
export { appUpdateOf, platformOf } from './services/versions.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** How often a server reads the languages again: those another one saved. */
const LANGUAGES_REFRESH_MS = 60000;
/** Each content's tables and the controller's methods that serve it. */
const PARTS = {
    languages: { models: [ContentLanguage], methods: ['languages'] },
    faq: { models: [FaqSection, FaqQuestion], methods: ['faq'] },
    contacts: { models: [Contact, Office], methods: ['contacts'] },
    legal: { models: [LegalDocument], methods: ['legal', 'legalDocument'] },
    banners: { models: [Banner], methods: ['banners'] },
    stories: { models: [Story, StorySlide], methods: ['stories'] },
    versions: { models: [AppRelease], methods: ['appVersion'] },
};
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
    constructor(config = {}) {
        this.etherial_module_name = 'eth_content_leaf';
        this.routes = [];
        this.config = config;
        state.config = config;
        const methods = featuresOf(config).flatMap((feature) => { var _a, _b; return (_b = (_a = PARTS[feature]) === null || _a === void 0 ? void 0 : _a.methods) !== null && _b !== void 0 ? _b : []; });
        if (methods.length)
            this.routes.push({ route: path.join(__dirname, 'routes/app'), methods });
    }
    /** Lifecycle: beforeRun — the tables to the database before it syncs, the collections to the back-office. */
    beforeRun({ database }) {
        const features = featuresOf(this.config);
        database === null || database === void 0 ? void 0 : database.addModels(features.flatMap((feature) => { var _a, _b; return (_b = (_a = PARTS[feature]) === null || _a === void 0 ? void 0 : _a.models) !== null && _b !== void 0 ? _b : []; }));
        registerContentAdmin(etherial.eth_admin_leaf, this.config);
        if (features.includes('banners') || features.includes('stories'))
            registerMediaReferences(() => usedMediaIds(this.config));
    }
    run({ http }) {
        var _a, _b, _c;
        (_a = http === null || http === void 0 ? void 0 : http.routes_leafs) === null || _a === void 0 ? void 0 : _a.push(...this.routes);
        const features = featuresOf(this.config);
        if (features.includes('versions')) {
            const missing = ['ios', 'android'].filter((p) => { var _a; return !((_a = this.config.stores) === null || _a === void 0 ? void 0 : _a[p]); });
            if (missing.length)
                console.warn(`[ETHContentLeaf] No store page for ${missing.join(', ')} (stores): the update button has nowhere to go`);
        }
        if (!features.includes('banners') && !features.includes('stories'))
            return;
        const media = etherial.eth_media_leaf;
        const folder = folderOf(this.config);
        if (!media)
            console.warn('[ETHContentLeaf] No media leaf: banners and stories have no image, the app gets none');
        else if (((_c = (_b = media.getRuleForFolder) === null || _b === void 0 ? void 0 : _b.call(media, folder)) === null || _c === void 0 ? void 0 : _c.visibility) !== 'public-read') {
            console.warn(`[ETHContentLeaf] The media leaf has no public-read rule for "${folder}": the images of banners and stories can't be shown`);
        }
    }
    /** Lifecycle: afterRun — the images tied to the project's media model, the languages, then the first contents of a new server. */
    afterRun() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const features = featuresOf(this.config);
            if ((features.includes('banners') || features.includes('stories')) && !linkMedia(this.config)) {
                console.warn(`[ETHContentLeaf] No "${(_a = this.config.mediaModel) !== null && _a !== void 0 ? _a : 'Media'}" model: banners and stories are sent without their images`);
            }
            if (features.includes('languages')) {
                try {
                    const written = yield seedLanguages(this.config);
                    if (written.length)
                        console.log(`[ETHContentLeaf] First languages written: ${written.join(', ')}`);
                    yield ContentLanguage.load();
                }
                catch (err) {
                    console.error('[ETHContentLeaf] The languages could not be read, the config\'s are used:', err);
                }
                // Those another server saved; this one's own saves are read at once.
                setInterval(() => ContentLanguage.load().catch(() => { }), LANGUAGES_REFRESH_MS).unref();
            }
            try {
                const written = yield seedContent(this.config);
                if (written.length)
                    console.log(`[ETHContentLeaf] First contents written: ${written.join(', ')}`);
            }
            catch (err) {
                console.error('[ETHContentLeaf] The first contents could not be written:', err);
            }
        });
    }
}
