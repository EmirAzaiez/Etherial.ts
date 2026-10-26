import { Etherial } from 'etherial';
import { ETHContentLeafConfig } from './services/options.js';
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
export type { AppUpdate, UpdateKind } from './services/versions.js';
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
    readonly etherial_module_name = "eth_content_leaf";
    config: ETHContentLeafConfig;
    private routes;
    constructor(config?: ETHContentLeafConfig);
    /** Lifecycle: beforeRun — the tables to the database before it syncs, the collections to the back-office. */
    beforeRun({ database }: Etherial): void;
    run({ http }: Etherial): void;
    /** Lifecycle: afterRun — the images tied to the project's media model, the languages, then the first contents of a new server. */
    afterRun(): Promise<void>;
}
