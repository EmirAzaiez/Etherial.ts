// ============================================
// Interpolation Helper
// ============================================
function interpolate(template, params) {
    if (!params)
        return template;
    // Support both object {name: 'John'} and array ['John', 'Doe']
    // Template: "Hello {name}" or "Hello {0}"
    // Also supports: "Between {params[0]} and {params[1]}"
    return template.replace(/\{([^}]+)\}/g, (match, key) => {
        // Handle nested paths like "params[0]" or "user.name"
        const path = key.split(/[\[\].]/).filter(Boolean);
        let value = params;
        for (const segment of path) {
            if (value === undefined || value === null)
                break;
            value = value[segment];
        }
        return value !== undefined && value !== null ? String(value) : match;
    });
}
// ============================================
// Translation Class
// ============================================
export class Translation {
    constructor(config = {}) {
        var _a, _b, _c;
        this.translations = new Map();
        this.defaultLanguage = ((_a = config.defaultLanguage) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || 'EN';
        this.fallbackToKey = (_b = config.fallbackToKey) !== null && _b !== void 0 ? _b : true;
        this.logMissing = (_c = config.logMissing) !== null && _c !== void 0 ? _c : false;
        // Load built-in translations
        this.load('EN', require('./resources/translation.json'));
        // Load user translations
        if (config.translations) {
            for (const source of config.translations) {
                this.load(source.lang, source.data);
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
    t(key, params, lang) {
        const language = this.normalizeLanguage(lang);
        const translation = this.get(key, language);
        if (translation === undefined) {
            if (this.logMissing) {
                console.warn(`[Translation] Missing key "${key}" for language "${language}"`);
            }
            return this.fallbackToKey ? key : '';
        }
        return interpolate(translation, params);
    }
    /**
     * Check if a translation key exists
     */
    has(key, lang) {
        var _a, _b;
        const language = this.normalizeLanguage(lang);
        return (_b = (_a = this.translations.get(language)) === null || _a === void 0 ? void 0 : _a.has(key)) !== null && _b !== void 0 ? _b : false;
    }
    /**
     * Get all available languages
     */
    getLanguages() {
        return Array.from(this.translations.keys());
    }
    /**
     * Get the default language
     */
    getDefaultLanguage() {
        return this.defaultLanguage;
    }
    /**
     * Load translations dynamically
     */
    load(lang, data) {
        const language = lang.toUpperCase();
        if (!this.translations.has(language)) {
            this.translations.set(language, new Map());
        }
        const langMap = this.translations.get(language);
        for (const [key, value] of Object.entries(data)) {
            langMap.set(key, value);
        }
        return this;
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
    translateError(error, lang) {
        if (typeof error === 'string') {
            return this.t(error, undefined, lang);
        }
        const language = this.normalizeLanguage(lang);
        const translatedMsg = this.get(error.msg, language);
        if (!translatedMsg) {
            return error;
        }
        // Translate params if they are translation keys
        let translatedParams = error.params;
        if (error.params) {
            translatedParams = error.params.map(param => {
                if (typeof param === 'string') {
                    const translated = this.get(param, language);
                    return translated !== null && translated !== void 0 ? translated : param;
                }
                return param;
            });
        }
        return Object.assign(Object.assign({}, error), { msg: interpolate(translatedMsg, {
                params: translatedParams,
                value: error.value
            }) });
    }
    /**
     * Translate an array of errors
     */
    translateErrors(errors, lang) {
        return errors.map(err => this.translateError(err, lang));
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
    scoped(prefix, lang) {
        return new ScopedTranslator(this, prefix, lang);
    }
    /**
     * Create a translator bound to a specific language
     *
     * @example
     * const frenchT = translation.forLanguage('FR')
     * frenchT('hello')  // Always translates to French
     */
    forLanguage(lang) {
        const language = this.normalizeLanguage(lang);
        return (key, params) => this.t(key, params, language);
    }
    // ========================================
    // Private Helpers
    // ========================================
    get(key, lang) {
        var _a, _b;
        // Try exact language first
        let translation = (_a = this.translations.get(lang)) === null || _a === void 0 ? void 0 : _a.get(key);
        // Fallback to default language
        if (translation === undefined && lang !== this.defaultLanguage) {
            translation = (_b = this.translations.get(this.defaultLanguage)) === null || _b === void 0 ? void 0 : _b.get(key);
        }
        return translation;
    }
    normalizeLanguage(lang) {
        if (!lang)
            return this.defaultLanguage;
        // Handle "fr-FR" -> "FR", "en-US" -> "EN"
        const normalized = lang.split(/[-_]/)[0].toUpperCase();
        // If language doesn't exist, fallback to default
        if (!this.translations.has(normalized)) {
            return this.defaultLanguage;
        }
        return normalized;
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
        ];
    }
}
// ============================================
// Scoped Translator
// ============================================
export class ScopedTranslator {
    constructor(translation, prefix, lang) {
        this.translation = translation;
        this.prefix = prefix;
        this.lang = lang;
    }
    t(key, params) {
        return this.translation.t(`${this.prefix}.${key}`, params, this.lang);
    }
    has(key) {
        return this.translation.has(`${this.prefix}.${key}`, this.lang);
    }
}
// ============================================
// HTTP Integration Helper (Optional)
// ============================================
/**
 * Helper to detect language from HTTP request
 * Can be used by http module or custom middleware
 */
export function detectLanguageFromRequest(req) {
    var _a, _b, _c;
    const acceptLanguage = (_a = req.headers) === null || _a === void 0 ? void 0 : _a['accept-language'];
    if (!acceptLanguage)
        return undefined;
    const lang = Array.isArray(acceptLanguage) ? acceptLanguage[0] : acceptLanguage;
    return (_c = (_b = lang === null || lang === void 0 ? void 0 : lang.split(',')[0]) === null || _b === void 0 ? void 0 : _b.split(';')[0]) === null || _c === void 0 ? void 0 : _c.trim();
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
export function createTranslationMiddleware(translation) {
    return (req, res, next) => {
        const lang = detectLanguageFromRequest(req) || translation.getDefaultLanguage();
        // Add translator to request
        req.t = (key, params) => translation.t(key, params, lang);
        req.language = lang;
        // Enhanced error response
        const originalError = res.error;
        res.error = ({ status = 400, error, errors }) => {
            let translatedErrors = [];
            if (errors && Array.isArray(errors)) {
                translatedErrors = translation.translateErrors(errors.map(e => typeof e === 'string' ? { msg: e } : e), lang);
            }
            if (originalError) {
                originalError.call(res, { status, error, errors: translatedErrors });
            }
            else {
                res.status(status).json({ status, errors: translatedErrors });
            }
        };
        next();
    };
}
