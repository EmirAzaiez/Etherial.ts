var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { literal } from 'sequelize';
import { Banner } from '../models/Banner.js';
import { FaqQuestion } from '../models/FaqQuestion.js';
import { FaqSection } from '../models/FaqSection.js';
import { LegalDocument } from '../models/LegalDocument.js';
import { Office } from '../models/Office.js';
import { Story } from '../models/Story.js';
import { StorySlide } from '../models/StorySlide.js';
import { featuresOf, isLocale, labelOf } from './options.js';
import { state } from './state.js';
/** The texts a row can't be saved without, in the default language (`requiredLabel`). */
const REQUIRED = [
    { feature: 'faq', model: FaqSection, column: 'title', what: 'FAQ sections' },
    { feature: 'faq', model: FaqQuestion, column: 'question', what: 'questions' },
    { feature: 'faq', model: FaqQuestion, column: 'answer', what: 'answers' },
    { feature: 'contacts', model: Office, column: 'name', what: 'offices' },
    { feature: 'legal', model: LegalDocument, column: 'title', what: 'legal documents' },
    { feature: 'stories', model: Story, column: 'title', what: 'stories' },
];
/** The back-office's `label` of each row: its default language's text. */
const LABELS = [
    { feature: 'faq', model: FaqSection, column: 'title' },
    { feature: 'faq', model: FaqQuestion, column: 'question' },
    { feature: 'contacts', model: Office, column: 'name' },
    { feature: 'legal', model: LegalDocument, column: 'title' },
    { feature: 'banners', model: Banner, column: 'title' },
    { feature: 'stories', model: Story, column: 'title' },
    { feature: 'stories', model: StorySlide, column: 'title' },
];
const offered = (list) => list.filter((item) => featuresOf(state.config).includes(item.feature));
/** `"title"` has nothing in `locale`. The locale is a code (`isLocale`), never the team's words. */
const emptyIn = (column, locale) => `COALESCE(TRIM("${column}"->>'${locale}'), '') = ''`;
/**
 * What would have no text in `locale` were it the default language: each
 * kind of row, and how many. A published legal document needs its text or
 * its page too.
 */
export function missingIn(locale) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!isLocale(locale))
            return [];
        const missing = [];
        for (const { model, column, what } of offered(REQUIRED)) {
            const count = yield model.count({ where: literal(emptyIn(column, locale)) });
            if (count)
                missing.push({ what, count });
        }
        if (featuresOf(state.config).includes('legal')) {
            const count = yield LegalDocument.count({ where: literal(`"published" = true AND ${emptyIn('body', locale)} AND ${emptyIn('url', locale)}`) });
            if (count)
                missing.push({ what: 'published legal documents’ texts', count });
        }
        return missing;
    });
}
/** Each row's `label` in its `locale` text, once it is the default language. Not a change of the row: no hook, same `updated_at`. */
export function relabel(locale, transaction) {
    return __awaiter(this, void 0, void 0, function* () {
        let changed = 0;
        for (const { model, column } of offered(LABELS)) {
            const rows = yield model.findAll({ attributes: ['id', column, 'label'], transaction });
            for (const row of rows) {
                const label = labelOf(row[column], locale);
                if (label === row.label)
                    continue;
                yield model.update({ label }, { where: { id: row.id }, hooks: false, silent: true, transaction });
                changed++;
            }
        }
        return changed;
    });
}
