var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { normalizeBlockList, normalizeHead } from './blocks.js';
import { coverFrom } from './cover.js';
import { defaultLocaleOf, languageOf, localesOf, localize, rtlOf } from './options.js';
import { render } from './render.js';
import { state } from './state.js';
import { pageFonts, pageHead } from './settings.js';
import { fontIdOf } from './fonts.js';
/**
 * One language of the form being written, rendered as the bucket would get
 * it. The blocks are read as a draft: one not finished yet (an image not
 * uploaded, a button without its link) shows as it is, and each block says
 * which one of the form it is, for the back-office to point at it.
 * `chrome: false` leaves out the brand and the language switch, for a page
 * shown inside a record (a news' content). `fonts`: those the editor is
 * trying, else the pages' own. `head`: how this page opens, its own choices;
 * `look`: how every page does, as the settings are trying it (null: the
 * theme's). `cover`: its record's photo, a media's id or an address; `logo`:
 * its record's logo, the same way.
 */
export function previewPage(body) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const config = state.config;
        const fallback = defaultLocaleOf(config);
        const locales = localesOf(config);
        const asked = languageOf(body.locale);
        const locale = asked && locales.includes(asked) ? asked : fallback;
        const raw = Array.isArray(body.blocks) ? body.blocks : (_a = body.blocks) === null || _a === void 0 ? void 0 : _a[locale];
        const list = normalizeBlockList(raw, 'Preview', 'draft');
        const chrome = body.chrome !== false && body.chrome !== 'false';
        const title = localize(body.title, locale, fallback).replace(/\s+/g, ' ');
        const look = 'look' in body ? normalizeHead(body.look) : undefined;
        const own = normalizeHead(body.head);
        return {
            html: render({
                title: title || (chrome ? 'Untitled page' : ''),
                summary: localize(body.summary, locale, fallback).replace(/\s+/g, ' '),
                blocks: list.map((b) => b.block),
                indexes: list.map((b) => b.index),
                locale,
                rtl: rtlOf(config, locale),
                theme: (_b = config.theme) !== null && _b !== void 0 ? _b : {},
                brand: localize((_c = config.theme) === null || _c === void 0 ? void 0 : _c.brandName, locale, fallback),
                timezone: config.timezone,
                // Nowhere to go from a preview.
                pageHref: () => '#',
                languages: locales.map((l) => ({ locale: l, href: '#' })),
                chrome,
                fonts: fontsOf(body.fonts),
                head: pageHead(own, look),
                cover: (_d = own === null || own === void 0 ? void 0 : own.photo) !== null && _d !== void 0 ? _d : (yield coverFrom(body.cover)),
                logo: yield coverFrom(body.logo),
                maps: config.maps,
                draft: true,
                marks: true,
            }),
        };
    });
}
function fontsOf(asked) {
    var _a, _b;
    const fonts = pageFonts();
    if (!asked || typeof asked !== 'object')
        return fonts;
    const a = asked;
    // A role sent as null: the theme's, as the settings would make it.
    const theme = (_b = (_a = state.config.theme) === null || _a === void 0 ? void 0 : _a.fonts) !== null && _b !== void 0 ? _b : {};
    const pick = (role) => { var _a; return (role in a ? ((_a = fontIdOf(a[role])) !== null && _a !== void 0 ? _a : fontIdOf(theme[role])) : fonts[role]); };
    return { title: pick('title'), text: pick('text') };
}
