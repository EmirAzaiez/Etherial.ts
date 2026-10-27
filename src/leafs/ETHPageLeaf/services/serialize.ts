import { Op } from 'sequelize'

import { Page } from '../models/Page.js'
import { pageIn } from './publish.js'
import { pageFonts } from './settings.js'
import { fontsIn } from './fonts.js'
import type { ResolvedBlock } from './options.js'

/** A page as the app gets it: the blocks to draw, and the address of its HTML to share or show in a web view. */
export function serializePage(page: Page, asked: string) {
    const content = pageIn(page, asked)
    return {
        id: page.id,
        slug: page.slug,
        ...content,
        in_menu: page.in_menu,
        position: page.position,
        url: page.html?.[content.locale] ?? null,
        fonts: appFonts(content.blocks),
        updated_at: page.updated_at,
    }
}

/**
 * What the app draws the words in: the titles' font and the text's (ids of
 * the catalog; null, its own), and the files of each font the page uses, the
 * blocks' own too, for those it doesn't have.
 */
function appFonts(blocks: ResolvedBlock[]) {
    const fonts = pageFonts()
    const used = fontsIn(fonts, blocks)
    return {
        title: fonts.title ?? null,
        text: fonts.text ?? null,
        files: Object.fromEntries(used.map((f) => [f.id, { family: f.family, files: f.files }])),
    }
}

export type AppPage = ReturnType<typeof serializePage>

/**
 * The published pages among these ids, as the app gets them: what a record
 * with a `page` field (a news) sends along, so the app draws it at once. A
 * draft is left out.
 */
export async function publishedPages(ids: (number | null | undefined)[], locale: string): Promise<Map<number, AppPage>> {
    const wanted = [...new Set(ids.filter((id): id is number => !!id))]
    if (!wanted.length) return new Map()
    const pages = await Page.findAll({ where: { id: { [Op.in]: wanted }, published: true } })
    return new Map(pages.map((page) => [page.id, serializePage(page, locale)]))
}
