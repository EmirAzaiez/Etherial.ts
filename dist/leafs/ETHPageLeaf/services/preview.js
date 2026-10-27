import { normalizeBlockList } from './blocks.js';
import { defaultLocaleOf, languageOf, localesOf, localize, rtlOf } from './options.js';
import { render } from './render.js';
import { state } from './state.js';
import { pageFonts } from './settings.js';
import { fontIdOf } from './fonts.js';
/**
 * One language of the form being written, rendered as the bucket would get
 * it. The blocks are read as a draft: one not finished yet (an image not
 * uploaded, a button without its link) shows as it is, and each block says
 * which one of the form it is, for the back-office to point at it.
 * `chrome: false` leaves out the brand and the language switch, for a page
 * shown inside a record (a news' content). `fonts`: those the editor is
 * trying, else the pages' own.
 */
export function previewPage(body) {
    var _a, _b, _c;
    const config = state.config;
    const fallback = defaultLocaleOf(config);
    const locales = localesOf(config);
    const asked = languageOf(body.locale);
    const locale = asked && locales.includes(asked) ? asked : fallback;
    const raw = Array.isArray(body.blocks) ? body.blocks : (_a = body.blocks) === null || _a === void 0 ? void 0 : _a[locale];
    const list = normalizeBlockList(raw, 'Preview', 'draft');
    const chrome = body.chrome !== false && body.chrome !== 'false';
    const title = localize(body.title, locale, fallback).replace(/\s+/g, ' ');
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
            draft: true,
            marks: true,
        }),
    };
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
