import { ContentError, Localized, labelOf, languageName } from './options.js'
import { languages } from './state.js'

/**
 * A text in the default language alone, on one line: the one every other
 * language falls back to, so the one that can't be missing.
 */
export function ownText(text: Localized | undefined | null): string {
    const fallback = languages().default
    const own = typeof text === 'string' ? text : text?.[fallback]
    return labelOf(own, fallback)
}

/**
 * The back-office label of a text the row can't go without: its default
 * language's. Throws, so the back-office shows why it can't be saved.
 */
export function requiredLabel(text: Localized | undefined | null, what: string): string {
    const label = ownText(text)
    if (!label) throw new ContentError(`${what}: the ${languageName(languages().default)} text is required.`)
    return label
}

/** A JSON column's texts, trimmed, the empty ones left out. */
export function cleanTexts(text: unknown): Record<string, string> {
    if (!text || typeof text !== 'object' || Array.isArray(text)) return {}
    const clean: Record<string, string> = {}
    for (const [locale, value] of Object.entries(text as Record<string, unknown>)) {
        if (typeof value === 'string' && value.trim()) clean[locale] = value.trim()
    }
    return clean
}

/** Empty strings from the back-office's form as null. */
export function orNull(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null
}
