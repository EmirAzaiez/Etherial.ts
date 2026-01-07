import { IEtherialModule } from '../../index.js'

// ============================================
// Types & Interfaces
// ============================================

export interface TranslationConfig {
    /** Langue par défaut (ex: 'EN', 'FR') */
    defaultLanguage?: string
    /** Traductions à charger */
    translations?: TranslationSource[]
    /** Fallback sur la clé si traduction manquante (default: true) */
    fallbackToKey?: boolean
    /** Logger les clés manquantes (default: false) */
    logMissing?: boolean
}

export interface TranslationSource {
    lang: string
    data: Record<string, string>
}

export interface TranslationError {
    msg: string
    params?: (string | number)[]
    value?: any
    location?: string
    path?: string
}

type InterpolationParams = Record<string, any> | (string | number)[]

// ============================================
// Interpolation Helper
// ============================================

function interpolate(template: string, params?: InterpolationParams): string {
    if (!params) return template

    // Support both object {name: 'John'} and array ['John', 'Doe']
    // Template: "Hello {name}" or "Hello {0}"
    // Also supports: "Between {params[0]} and {params[1]}"
    return template.replace(/\{([^}]+)\}/g, (match, key) => {
        // Handle nested paths like "params[0]" or "user.name"
        const path = key.split(/[\[\].]/).filter(Boolean)
        let value: any = params

        for (const segment of path) {
            if (value === undefined || value === null) break
            value = value[segment]
        }

        return value !== undefined && value !== null ? String(value) : match
    })
}

// ============================================
// Translation Class
// ============================================

export class Translation implements IEtherialModule {
    private defaultLanguage: string
    private translations: Map<string, Map<string, string>> = new Map()
    private fallbackToKey: boolean
    private logMissing: boolean

    constructor(config: TranslationConfig = {}) {
        this.defaultLanguage = config.defaultLanguage?.toUpperCase() || 'EN'
        this.fallbackToKey = config.fallbackToKey ?? true
        this.logMissing = config.logMissing ?? false

        // Load built-in translations
        this.load('EN', require('./resources/translation.json'))

        // Load user translations
        if (config.translations) {
            for (const source of config.translations) {
                this.load(source.lang, source.data)
            }
        }
    }

    // ========================================
    // Public API - Simple & Clean
    // ========================================

    /**
     * Translate a key with optional parameters
     * 
     * @example
     * t('hello')                           // "Hello"
     * t('hello.name', { name: 'John' })    // "Hello John"
     * t('hello.name', ['John'])            // "Hello John" (array params)
     * t('hello', {}, 'FR')                 // "Bonjour" (specific language)
     */
    t(key: string, params?: InterpolationParams, lang?: string): string {
        const language = this.normalizeLanguage(lang)
        const translation = this.get(key, language)

        if (translation === undefined) {
            if (this.logMissing) {
                console.warn(`[Translation] Missing key "${key}" for language "${language}"`)
            }
            return this.fallbackToKey ? key : ''
        }

        return interpolate(translation, params)
    }

    /**
     * Check if a translation key exists
     */
    has(key: string, lang?: string): boolean {
        const language = this.normalizeLanguage(lang)
        return this.translations.get(language)?.has(key) ?? false
    }

    /**
     * Get all available languages
     */
    getLanguages(): string[] {
        return Array.from(this.translations.keys())
    }

    /**
     * Get the default language
     */
    getDefaultLanguage(): string {
        return this.defaultLanguage
    }

    /**
     * Load translations dynamically
     */
    load(lang: string, data: Record<string, string>): this {
        const language = lang.toUpperCase()

        if (!this.translations.has(language)) {
            this.translations.set(language, new Map())
        }

        const langMap = this.translations.get(language)!
        for (const [key, value] of Object.entries(data)) {
            langMap.set(key, value)
        }

        return this
    }

    // ========================================
    // Error Translation (for forms/validation)
    // ========================================

    /**
     * Translate a validation error object
     * 
     * @example
     * translateError({ msg: 'field.required', params: ['email'] }, 'EN')
     * // Returns: { msg: 'Email is required', ... }
     */
    translateError(error: TranslationError | string, lang?: string): TranslationError | string {
        if (typeof error === 'string') {
            return this.t(error, undefined, lang)
        }

        const language = this.normalizeLanguage(lang)
        const translatedMsg = this.get(error.msg, language)

        if (!translatedMsg) {
            return error
        }

        // Translate params if they are translation keys
        let translatedParams = error.params
        if (error.params) {
            translatedParams = error.params.map(param => {
                if (typeof param === 'string') {
                    const translated = this.get(param, language)
                    return translated ?? param
                }
                return param
            })
        }

        return {
            ...error,
            msg: interpolate(translatedMsg, {
                params: translatedParams,
                value: error.value
            }),
        }
    }

    /**
     * Translate an array of errors
     */
    translateErrors(errors: (TranslationError | string)[], lang?: string): (TranslationError | string)[] {
        return errors.map(err => this.translateError(err, lang))
    }

    // ========================================
    // Scoped Translator (for modules/components)
    // ========================================

    /**
     * Create a scoped translator with a prefix
     * 
     * @example
     * const userT = translation.scoped('user')
     * userT.t('name')  // translates 'user.name'
     */
    scoped(prefix: string, lang?: string): ScopedTranslator {
        return new ScopedTranslator(this, prefix, lang)
    }

    /**
     * Create a translator bound to a specific language
     * 
     * @example
     * const frenchT = translation.forLanguage('FR')
     * frenchT('hello')  // Always translates to French
     */
    forLanguage(lang: string): (key: string, params?: InterpolationParams) => string {
        const language = this.normalizeLanguage(lang)
        return (key: string, params?: InterpolationParams) => this.t(key, params, language)
    }

    // ========================================
    // Private Helpers
    // ========================================

    private get(key: string, lang: string): string | undefined {
        // Try exact language first
        let translation = this.translations.get(lang)?.get(key)

        // Fallback to default language
        if (translation === undefined && lang !== this.defaultLanguage) {
            translation = this.translations.get(this.defaultLanguage)?.get(key)
        }

        return translation
    }

    private normalizeLanguage(lang?: string): string {
        if (!lang) return this.defaultLanguage

        // Handle "fr-FR" -> "FR", "en-US" -> "EN"
        const normalized = lang.split(/[-_]/)[0].toUpperCase()

        // If language doesn't exist, fallback to default
        if (!this.translations.has(normalized)) {
            return this.defaultLanguage
        }

        return normalized
    }

    // ========================================
    // Etherial Module Interface
    // ========================================

    run() {
        // Translation is standalone - no dependencies on other modules
        // Other modules can use Translation if they want
    }

    commands() {
        return [
            // {
            //     command: 'list',
            //     description: 'List all loaded languages and their translation counts',
            //     warn: false,
            //     action: async () => {
            //         const langs = this.getLanguages()
            //         const info = langs.map(lang => {
            //             const count = this.translations.get(lang)?.size ?? 0
            //             return `  ${lang}: ${count} keys`
            //         }).join('\n')

            //         return {
            //             success: true,
            //             message: `Loaded languages:\n${info}\n\nDefault: ${this.defaultLanguage}`,
            //         }
            //     },
            // },
            // {
            //     command: 'check',
            //     description: 'Check for missing translations across languages',
            //     warn: false,
            //     action: async () => {
            //         const allKeys = new Set<string>()
            //         const missing: Record<string, string[]> = {}

            //         // Collect all keys
            //         for (const [, langMap] of this.translations) {
            //             for (const key of langMap.keys()) {
            //                 allKeys.add(key)
            //             }
            //         }

            //         // Find missing per language
            //         for (const lang of this.getLanguages()) {
            //             const langMap = this.translations.get(lang)!
            //             const missingKeys = Array.from(allKeys).filter(key => !langMap.has(key))
            //             if (missingKeys.length > 0) {
            //                 missing[lang] = missingKeys
            //             }
            //         }

            //         if (Object.keys(missing).length === 0) {
            //             return { success: true, message: '✓ All translations are complete!' }
            //         }

            //         const report = Object.entries(missing)
            //             .map(([lang, keys]) => `${lang}: missing ${keys.length} keys\n  - ${keys.slice(0, 5).join('\n  - ')}${keys.length > 5 ? `\n  ... and ${keys.length - 5} more` : ''}`)
            //             .join('\n\n')

            //         return { success: false, message: `Missing translations:\n\n${report}` }
            //     },
            // },
        ]
    }
}

// ============================================
// Scoped Translator
// ============================================

export class ScopedTranslator {
    constructor(
        private translation: Translation,
        private prefix: string,
        private lang?: string
    ) { }

    t(key: string, params?: InterpolationParams): string {
        return this.translation.t(`${this.prefix}.${key}`, params, this.lang)
    }

    has(key: string): boolean {
        return this.translation.has(`${this.prefix}.${key}`, this.lang)
    }
}

// ============================================
// HTTP Integration Helper (Optional)
// ============================================

/**
 * Helper to detect language from HTTP request
 * Can be used by http module or custom middleware
 */
export function detectLanguageFromRequest(req: { headers?: Record<string, string | string[] | undefined> }): string | undefined {
    const acceptLanguage = req.headers?.['accept-language']
    if (!acceptLanguage) return undefined

    const lang = Array.isArray(acceptLanguage) ? acceptLanguage[0] : acceptLanguage
    return lang?.split(',')[0]?.split(';')[0]?.trim()
}

/**
 * Create an Express middleware that adds translation helpers to req/res
 * 
 * @example
 * // In your HTTP setup:
 * if (etherial.translation) {
 *     app.use(createTranslationMiddleware(etherial.translation))
 * }
 */
export function createTranslationMiddleware(translation: Translation) {
    return (req: any, res: any, next: () => void) => {
        const lang = detectLanguageFromRequest(req) || translation.getDefaultLanguage()

        // Add translator to request
        req.t = (key: string, params?: InterpolationParams) => translation.t(key, params, lang)
        req.language = lang

        // Enhanced error response
        const originalError = res.error
        res.error = ({ status = 400, error, errors }: { status?: number, error?: string, errors?: any[] }) => {
            let translatedErrors: any[] = []

            if (errors && Array.isArray(errors)) {
                translatedErrors = translation.translateErrors(
                    errors.map(e => typeof e === 'string' ? { msg: e } : e),
                    lang
                )
            }

            if (originalError) {
                originalError.call(res, { status, error, errors: translatedErrors })
            } else {
                res.status(status).json({ status, errors: translatedErrors })
            }
        }

        next()
    }
}
