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
import { Op } from 'sequelize';
import { registerMediaReferences } from '../ETHMediaLeaf/models/Media.js';
import { Page } from './models/Page.js';
import { PageTemplate } from './models/PageTemplate.js';
import { PageSettings } from './models/PageSettings.js';
import { registerPagesAdmin } from './admin/pages.js';
import { mediaIdsOf } from './services/blocks.js';
import { coverFrom } from './services/cover.js';
import { publish, republishAll, republishSoon, takeDown } from './services/publish.js';
import { fontCatalog } from './services/fonts.js';
import { loadSettings, lookChanged, themeHead } from './services/settings.js';
import { paletteOf, radiusOf } from './services/render.js';
import { state } from './services/state.js';
import { canGenerate } from './services/generate.js';
import { BLOCKS_TYPE, COLLECTION, PAGE_TYPE, defaultLocaleOf, folderOf, localesOf, rtlOf } from './services/options.js';
export * from './services/options.js';
export { Page } from './models/Page.js';
export { PageTemplate } from './models/PageTemplate.js';
export { PageSettings } from './models/PageSettings.js';
export { FONTS } from './services/fonts.js';
export { resolveBlocks } from './services/resolve.js';
export { serializePage, publishedPages } from './services/serialize.js';
export { localeOf } from './services/http.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** What the back-office lets people upload in an image block. */
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
/**
 * ETHPageLeaf — simple pages to read, written in the back-office.
 *
 * A page is a title and blocks, in each language: headings and rich texts,
 * buttons, images, a hero, galleries, videos, cards, questions, contacts,
 * events, figures, notes, label / value lines, each in a box of its own
 * (background, padding, edge to edge). The app gets
 * the blocks (`GET /pages`, `GET /pages/:slug`) and draws them itself, so a
 * page it already has opens at once. The same page is published as HTML in
 * the media leaf's bucket, `<folder>/<slug>/<locale>.html`, when it is saved:
 * that is the link to share, and what a web view shows. The API never serves
 * that HTML. A draft has a preview link to send before that, in the bucket
 * too: `<folder>/preview/<key>/<locale>.html`, written again on each save.
 * Needs the media leaf, and one of its public-read folders.
 *
 * A page can also be the content of another collection's record (a news): a
 * `page` field, written in that record's form and kept with it. The project
 * sends it along with the record (`publishedPages`).
 */
export default class ETHPageLeaf {
    constructor(config = {}) {
        this.etherial_module_name = 'eth_page_leaf';
        this.routes = [];
        this.config = config;
        state.config = config;
        this.routes.push({ route: path.join(__dirname, 'routes/app'), methods: ['list', 'show'] }, { route: path.join(__dirname, 'routes/admin'), methods: ['preview', 'generate', 'attached', 'templates', 'createTemplate', 'updateTemplate', 'deleteTemplate', 'settings', 'updateSettings', 'share', 'startPreview', 'stopPreview'] });
    }
    /**
     * Lifecycle: beforeRun — the table to the database before it syncs, the
     * collection to the back-office before it sets up its history.
     */
    beforeRun({ database }) {
        database === null || database === void 0 ? void 0 : database.addModels([Page, PageTemplate, PageSettings]);
        registerPagesAdmin(etherial.eth_admin_leaf, this.config);
        // The images uploaded into a page or a template are only named in its blocks (JSON),
        // anywhere in them: a hero's, a gallery's, a card's, a video's poster. And the cover's, the page's own photo.
        registerMediaReferences(() => __awaiter(this, void 0, void 0, function* () {
            const [pages, templates] = yield Promise.all([
                Page.findAll({ attributes: ['blocks', 'cover', 'head'], raw: true }),
                PageTemplate.findAll({ attributes: ['blocks'], raw: true }),
            ]);
            return mediaIdsOf([...pages, ...templates].map((row) => [row.blocks, row.cover, row.head]));
        }));
    }
    run({ http }) {
        var _a, _b, _c;
        (_a = http === null || http === void 0 ? void 0 : http.routes_leafs) === null || _a === void 0 ? void 0 : _a.push(...this.routes);
        const media = etherial.eth_media_leaf;
        const folder = folderOf(this.config);
        if (!(media === null || media === void 0 ? void 0 : media.s3))
            console.warn('[ETHPageLeaf] No media leaf: pages cannot be published, their HTML goes to its bucket');
        else if (((_c = (_b = media.getRuleForFolder) === null || _b === void 0 ? void 0 : _b.call(media, folder)) === null || _c === void 0 ? void 0 : _c.visibility) !== 'public-read') {
            console.warn(`[ETHPageLeaf] The media leaf has no public-read rule for "${folder}": the images of the pages can't be uploaded`);
        }
    }
    /** Lifecycle: afterRun — tell the back-office how pages are written. */
    afterRun() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        // The fonts the back-office set, read before the first page is drawn.
        void loadSettings();
        void this.catchUp();
        const adminLeaf = etherial.eth_admin_leaf;
        if (!(adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.setFeature))
            return;
        const folder = folderOf(this.config);
        const rule = (_b = (_a = etherial.eth_media_leaf) === null || _a === void 0 ? void 0 : _a.getRuleForFolder) === null || _b === void 0 ? void 0 : _b.call(_a, folder);
        const locales = localesOf(this.config);
        adminLeaf.setFeature('pages', {
            collection: COLLECTION,
            blocksType: BLOCKS_TYPE,
            locales,
            defaultLocale: defaultLocaleOf(this.config),
            rtlLocales: locales.filter((l) => rtlOf(this.config, l)),
            previewPath: '/admin/content-pages/preview',
            // `<attachedPath>/<collection>/<id>/<field>`: the page of a record's `page` field.
            pageType: PAGE_TYPE,
            attachedPath: '/admin/content-pages/of',
            // The upload of an image block, as a media field would declare it.
            images: {
                folder,
                accept: ((_c = rule === null || rule === void 0 ? void 0 : rule.mime_types) === null || _c === void 0 ? void 0 : _c.length) ? IMAGE_TYPES.filter((t) => rule.mime_types.includes(t)) : IMAGE_TYPES,
                maxSize: (_d = rule === null || rule === void 0 ? void 0 : rule.max_size) !== null && _d !== void 0 ? _d : null,
            },
            // The colors a block's `primary`, `subtle`… stand for, and the corners: the editor's swatches.
            theme: { colors: paletteOf(this.config.theme), radius: radiusOf(this.config.theme) },
            // GET the list, POST { name, blocks }, PUT / DELETE `<templatesPath>/<id>`.
            templatesPath: '/admin/content-pages/templates',
            // `<sharePath>/<id>` of a saved page: GET its links, POST makes its preview link, DELETE stops it.
            sharePath: '/admin/content-pages/share',
            // The fonts to pick from, the theme's (what a page is in when none is set),
            // and where every page's are read (GET) and set (PUT { fonts: { title, text } }).
            fonts: {
                catalog: fontCatalog(),
                defaults: { title: (_g = (_f = (_e = this.config.theme) === null || _e === void 0 ? void 0 : _e.fonts) === null || _f === void 0 ? void 0 : _f.title) !== null && _g !== void 0 ? _g : null, text: (_k = (_j = (_h = this.config.theme) === null || _h === void 0 ? void 0 : _h.fonts) === null || _j === void 0 ? void 0 : _j.text) !== null && _k !== void 0 ? _k : null },
                settingsPath: '/admin/content-pages/settings',
            },
            // How a page opens (cover, title) when nothing else is set: the theme's. Set for every
            // page in the settings (PUT { head }), for one in its editor (`{ blocks, head }`).
            head: { defaults: themeHead() },
            // "Write with AI" in the editor: POST a few words, the blocks stream back. Absent without a key.
            ai: canGenerate() ? { generatePath: '/admin/content-pages/generate' } : null,
        });
    }
    /**
     * At boot: the pages of records get their record's cover (those written
     * before pages had one), and every page is written again when the theme
     * or the way pages are drawn changed. In the background.
     */
    catchUp() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                yield this.fillCovers();
                if (yield lookChanged())
                    republishSoon('New theme');
            }
            catch (err) {
                console.error('[ETHPageLeaf] Could not bring the pages up to date:', (_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : err);
            }
        });
    }
    /** Each `page` field with a `cover`: its pages without one take their record's. */
    fillCovers() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const adminLeaf = etherial.eth_admin_leaf;
            for (const collection of (_a = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.collections) !== null && _a !== void 0 ? _a : []) {
                for (const field of (_b = collection.fields) !== null && _b !== void 0 ? _b : []) {
                    if (field.type !== PAGE_TYPE || !((_c = field.page) === null || _c === void 0 ? void 0 : _c.cover) || !collection.model)
                        continue;
                    const records = yield collection.model.findAll({ where: { [field.name]: { [Op.ne]: null } }, attributes: [field.name, field.page.cover] });
                    for (const record of records) {
                        const page = yield Page.findByPk(record.get(field.name));
                        if (!page || page.owner !== collection.name || page.cover)
                            continue;
                        const cover = yield coverFrom(record.get(field.page.cover));
                        if (!cover)
                            continue;
                        const next = Object.assign(Object.assign({}, page.get({ plain: true })), { cover });
                        const { columns, stale } = yield publish(next, page.get({ plain: true }));
                        yield page.update(Object.assign({ cover }, columns));
                        takeDown(stale);
                    }
                }
            }
        });
    }
    commands() {
        return [
            {
                command: 'publish',
                description: 'Write the HTML of every published page again (after a change of theme)',
                action: () => __awaiter(this, void 0, void 0, function* () {
                    yield loadSettings();
                    const count = yield republishAll();
                    return { success: true, message: `Published ${count} page${count === 1 ? '' : 's'} again` };
                }),
            },
        ];
    }
}
