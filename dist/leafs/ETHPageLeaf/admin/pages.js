var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Page } from '../models/Page.js';
import { copyPageField, deletePageField, savePageField } from '../services/attached.js';
import { afterUpdate, prepareCreate, prepareUpdate } from '../services/pages.js';
import { takeDownPage } from '../services/publish.js';
import { BLOCKS_TYPE, COLLECTION, LINKS_TYPE, PAGE_TYPE, defaultLocaleOf, localesOf, rtlOf } from '../services/options.js';
/** Each language named in itself, on the back-office's language switch. */
const NATIVE = { en: 'English', ar: 'العربية', fr: 'Français', es: 'Español', de: 'Deutsch', it: 'Italiano', ru: 'Русский', zh: '中文' };
function registerHooks(adminLeaf) {
    adminLeaf.hooks.register('eth-page:pages', {
        collection: COLLECTION,
        description: 'Check a page before it is saved, and publish its HTML to the bucket',
        beforeCreate: (data) => __awaiter(this, void 0, void 0, function* () { return prepareCreate(data); }),
        beforeUpdate: (record, data) => __awaiter(this, void 0, void 0, function* () { return prepareUpdate(record, data); }),
        afterUpdate: (record) => __awaiter(this, void 0, void 0, function* () { return afterUpdate(record); }),
        afterDelete: (record) => __awaiter(this, void 0, void 0, function* () { return takeDownPage(record); }),
    });
}
function pagesCollection(config) {
    var _a, _b, _c, _d, _e, _f;
    const locales = localesOf(config);
    // The same switch for the title, the summary and the blocks: the BO's language toggle.
    const translations = (type) => ({
        locales,
        defaultLocale: defaultLocaleOf(config),
        localeLabels: Object.fromEntries(locales.map((l) => { var _a; return [l, (_a = NATIVE[l]) !== null && _a !== void 0 ? _a : l.toUpperCase()]; })),
        rtlLocales: locales.filter((l) => rtlOf(config, l)),
        field: { type },
    });
    const publishing = ['published', 'in_menu', 'slug'];
    return {
        name: COLLECTION,
        model: Page,
        crud: ['list', 'show', 'create', 'update', 'delete'],
        meta: {
            label: 'Page',
            labelPlural: 'Pages',
            icon: (_b = (_a = config.admin) === null || _a === void 0 ? void 0 : _a.icon) !== null && _b !== void 0 ? _b : 'FileText',
            description: 'Pages to read in the app and on the web: images, texts, buttons, written block by block',
            group: (_d = (_c = config.admin) === null || _c === void 0 ? void 0 : _c.group) !== null && _d !== void 0 ? _d : 'Content',
            order: (_f = (_e = config.admin) === null || _e === void 0 ? void 0 : _e.order) !== null && _f !== void 0 ? _f : 50,
        },
        fields: [
            { name: 'id', type: 'integer', readonly: true, sortable: true },
            { name: 'title', type: 'translations', label: 'Title', required: true, col: 12, translations: translations('string') },
            {
                name: 'summary',
                type: 'translations',
                label: 'Summary',
                col: 12,
                translations: translations('text'),
                helpText: "A line under the title. Also in the app's list of pages and in the preview of a shared link.",
            },
            // The editor also sets how the page opens (its title's look): saved beside the blocks.
            { name: 'blocks', type: BLOCKS_TYPE, label: 'Blocks', col: 12, companions: ['head'] },
            { name: 'head', type: 'json', label: 'Title look' },
            {
                name: 'slug',
                type: 'string',
                label: 'Address',
                searchable: true,
                sortable: true,
                maxLength: 80,
                col: 6,
                helpText: 'In links: page:opening-hours in a button, …/opening-hours/en.html on the web. Left empty, it is made from the title. Changing it breaks the links already shared.',
            },
            {
                name: 'published',
                type: 'boolean',
                label: 'Published',
                defaultValue: false,
                filterable: true,
                col: 3,
                helpText: "Off: a draft. The app doesn't see it and its web link stops working.",
            },
            {
                name: 'in_menu',
                type: 'boolean',
                label: 'In the menu',
                defaultValue: true,
                filterable: true,
                col: 3,
                helpText: "Listed in the app's menu. Off, it still opens from a push, a banner or a link.",
            },
            { name: 'position', type: 'integer', label: 'Menu order', sortable: true, defaultValue: 0 },
            { name: 'html', type: LINKS_TYPE, label: 'On the web', readonly: true, helpText: 'The link of each language, to share. Written when the page is saved published.' },
            { name: 'published_at', type: 'datetime', label: 'First published', readonly: true, sortable: true },
            { name: 'updated_at', type: 'datetime', label: 'Updated', readonly: true, sortable: true },
        ],
        views: {
            list: {
                fields: ['title', 'slug', 'published', 'in_menu', 'position', 'updated_at'],
                // A news' page is written in the news.
                where: { owner: null },
                sort: { field: 'position', direction: 'asc' },
                // The title is a column per language (JSON): it can't be searched with LIKE.
                search: ['slug'],
                filters: ['published', 'in_menu'],
                // Dragged into place on the list's Order page: 1, 2, 3… in `position`.
                reorder: {
                    filter: { in_menu: true },
                    details: ['slug', 'published'],
                    orders: [{ field: 'position', label: 'Menu order', description: "The pages in the app's menu, top to bottom" }],
                },
            },
            show: {
                layout: 'sections',
                sections: [
                    { title: 'Page', fields: ['title', 'summary'] },
                    { title: 'Blocks', fields: ['blocks'] },
                    { title: 'Publishing', fields: [...publishing, 'published_at', 'html'] },
                ],
            },
            create: {
                layout: 'sections',
                sections: [
                    { title: 'Page', fields: ['title', 'summary'] },
                    { title: 'Blocks', fields: ['blocks'] },
                    { title: 'Publishing', fields: publishing },
                ],
            },
            edit: {
                layout: 'sections',
                sections: [
                    { title: 'Page', fields: ['title', 'summary'] },
                    { title: 'Blocks', fields: ['blocks'] },
                    { title: 'Publishing', fields: publishing },
                ],
            },
        },
    };
}
/** Hooks first: the admin leaf reads a collection's hooks when it is registered. */
export function registerPagesAdmin(adminLeaf, config) {
    var _a;
    if (!(adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.hooks) || !(adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.registerCollection))
        return;
    registerHooks(adminLeaf);
    // A page as the content of another record: saved, copied and deleted with it.
    (_a = adminLeaf.registerFieldType) === null || _a === void 0 ? void 0 : _a.call(adminLeaf, PAGE_TYPE, { beforeSave: savePageField, duplicate: copyPageField, afterDelete: deletePageField });
    if (!adminLeaf.getCollection(COLLECTION))
        adminLeaf.registerCollection(pagesCollection(config));
}
