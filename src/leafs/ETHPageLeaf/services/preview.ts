import { normalizeBlockList, normalizeHead } from './blocks.js'
import { coverFrom } from './cover.js'
import { defaultLocaleOf, languageOf, localesOf, localize, rtlOf } from './options.js'
import { render } from './render.js'
import { state } from './state.js'
import { pageFonts, pageHead } from './settings.js'
import { fontIdOf } from './fonts.js'

/**
 * One language of the form being written, rendered as the bucket would get
 * it. The blocks are read as a draft: one not finished yet (an image not
 * uploaded, a button without its link) shows as it is, and each block says
 * which one of the form it is, for the back-office to point at it.
 * `chrome: false` leaves out the brand and the language switch, for a page
 * shown inside a record (a news' content). `fonts`: those the editor is
 * trying, else the pages' own. `head`: how this page opens, its own choices;
 * `look`: how every page does, as the settings are trying it (null: the
 * theme's). `cover`: its record's photo, a media's id or an address.
 */
export async function previewPage(body: Record<string, any>): Promise<{ html: string }> {
    const config = state.config
    const fallback = defaultLocaleOf(config)
    const locales = localesOf(config)
    const asked = languageOf(body.locale)
    const locale = asked && locales.includes(asked) ? asked : fallback
    const raw = Array.isArray(body.blocks) ? body.blocks : body.blocks?.[locale]
    const list = normalizeBlockList(raw, 'Preview', 'draft')
    const chrome = body.chrome !== false && body.chrome !== 'false'
    const title = localize(body.title, locale, fallback).replace(/\s+/g, ' ')
    const look = 'look' in body ? normalizeHead(body.look) : undefined
    const own = normalizeHead(body.head)

    return {
        html: render({
            title: title || (chrome ? 'Untitled page' : ''),
            summary: localize(body.summary, locale, fallback).replace(/\s+/g, ' '),
            blocks: list.map((b) => b.block),
            indexes: list.map((b) => b.index),
            locale,
            rtl: rtlOf(config, locale),
            theme: config.theme ?? {},
            brand: localize(config.theme?.brandName, locale, fallback),
            timezone: config.timezone,
            // Nowhere to go from a preview.
            pageHref: () => '#',
            languages: locales.map((l) => ({ locale: l, href: '#' })),
            chrome,
            fonts: fontsOf(body.fonts),
            head: pageHead(own, look),
            cover: own?.photo ?? (await coverFrom(body.cover)),
            draft: true,
            marks: true,
        }),
    }
}

function fontsOf(asked: unknown) {
    const fonts = pageFonts()
    if (!asked || typeof asked !== 'object') return fonts
    const a = asked as Record<string, unknown>
    // A role sent as null: the theme's, as the settings would make it.
    const theme = state.config.theme?.fonts ?? {}
    const pick = (role: 'title' | 'text') => (role in a ? (fontIdOf(a[role]) ?? fontIdOf(theme[role])) : fonts[role])
    return { title: pick('title'), text: pick('text') }
}
