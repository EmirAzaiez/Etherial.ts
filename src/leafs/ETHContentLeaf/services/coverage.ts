import { literal } from 'sequelize'
import type { Transaction } from 'sequelize'

import { Banner } from '../models/Banner.js'
import { FaqQuestion } from '../models/FaqQuestion.js'
import { FaqSection } from '../models/FaqSection.js'
import { LegalDocument } from '../models/LegalDocument.js'
import { Office } from '../models/Office.js'
import { Story } from '../models/Story.js'
import { StorySlide } from '../models/StorySlide.js'
import { ContentFeature, featuresOf, isLocale, labelOf } from './options.js'
import { state } from './state.js'

/** The texts a row can't be saved without, in the default language (`requiredLabel`). */
const REQUIRED: { feature: ContentFeature; model: any; column: string; what: string }[] = [
    { feature: 'faq', model: FaqSection, column: 'title', what: 'FAQ sections' },
    { feature: 'faq', model: FaqQuestion, column: 'question', what: 'questions' },
    { feature: 'faq', model: FaqQuestion, column: 'answer', what: 'answers' },
    { feature: 'contacts', model: Office, column: 'name', what: 'offices' },
    { feature: 'legal', model: LegalDocument, column: 'title', what: 'legal documents' },
    { feature: 'stories', model: Story, column: 'title', what: 'stories' },
]

/** The back-office's `label` of each row: its default language's text. */
const LABELS: { feature: ContentFeature; model: any; column: string }[] = [
    { feature: 'faq', model: FaqSection, column: 'title' },
    { feature: 'faq', model: FaqQuestion, column: 'question' },
    { feature: 'contacts', model: Office, column: 'name' },
    { feature: 'legal', model: LegalDocument, column: 'title' },
    { feature: 'banners', model: Banner, column: 'title' },
    { feature: 'stories', model: Story, column: 'title' },
    { feature: 'stories', model: StorySlide, column: 'title' },
]

const offered = <T extends { feature: ContentFeature }>(list: T[]) => list.filter((item) => featuresOf(state.config).includes(item.feature))

/** `"title"` has nothing in `locale`. The locale is a code (`isLocale`), never the team's words. */
const emptyIn = (column: string, locale: string) => `COALESCE(TRIM("${column}"->>'${locale}'), '') = ''`

/**
 * What would have no text in `locale` were it the default language: each
 * kind of row, and how many. A published legal document needs its text or
 * its page too.
 */
export async function missingIn(locale: string): Promise<{ what: string; count: number }[]> {
    if (!isLocale(locale)) return []
    const missing: { what: string; count: number }[] = []
    for (const { model, column, what } of offered(REQUIRED)) {
        const count = await model.count({ where: literal(emptyIn(column, locale)) })
        if (count) missing.push({ what, count })
    }
    if (featuresOf(state.config).includes('legal')) {
        const count = await LegalDocument.count({ where: literal(`"published" = true AND ${emptyIn('body', locale)} AND ${emptyIn('url', locale)}`) as any })
        if (count) missing.push({ what: 'published legal documents’ texts', count })
    }
    return missing
}

/** Each row's `label` in its `locale` text, once it is the default language. Not a change of the row: no hook, same `updated_at`. */
export async function relabel(locale: string, transaction?: Transaction): Promise<number> {
    let changed = 0
    for (const { model, column } of offered(LABELS)) {
        const rows = await model.findAll({ attributes: ['id', column, 'label'], transaction })
        for (const row of rows) {
            const label = labelOf(row[column], locale)
            if (label === row.label) continue
            await model.update({ label }, { where: { id: row.id }, hooks: false, silent: true, transaction })
            changed++
        }
    }
    return changed
}
