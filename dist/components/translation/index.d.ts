import { IEtherialModule } from '../../index';
export interface TranslationConfig {
    /** Langue par défaut (ex: 'EN', 'FR') */
    defaultLanguage?: string;
    /** Traductions à charger */
    translations?: TranslationSource[];
    /** Fallback sur la clé si traduction manquante (default: true) */
    fallbackToKey?: boolean;
    /** Logger les clés manquantes (default: false) */
    logMissing?: boolean;
}
export interface TranslationSource {
    lang: string;
    data: Record<string, string>;
}
export interface TranslationError {
    msg: string;
    params?: (string | number)[];
    value?: any;
    location?: string;
    path?: string;
}
type InterpolationParams = Record<string, any> | (string | number)[];
export declare class Translation implements IEtherialModule {
    private defaultLanguage;
    private translations;
    private fallbackToKey;
    private logMissing;
    constructor(config?: TranslationConfig);
    /**
     * Translate a key with optional parameters
     *
     * @example
     * t('hello')                           // "Hello"
     * t('hello.name', { name: 'John' })    // "Hello John"
     * t('hello.name', ['John'])            // "Hello John" (array params)
     * t('hello', {}, 'FR')                 // "Bonjour" (specific language)
     */
    t(key: string, params?: InterpolationParams, lang?: string): string;
    /**
     * Check if a translation key exists
     */
    has(key: string, lang?: string): boolean;
    /**
     * Get all available languages
     */
    getLanguages(): string[];
    /**
     * Get the default language
     */
    getDefaultLanguage(): string;
    /**
     * Load translations dynamically
     */
    load(lang: string, data: Record<string, string>): this;
    /**
     * Translate a validation error object
     *
     * @example
     * translateError({ msg: 'field.required', params: ['email'] }, 'EN')
     * // Returns: { msg: 'Email is required', ... }
     */
    translateError(error: TranslationError | string, lang?: string): TranslationError | string;
    /**
     * Translate an array of errors
     */
    translateErrors(errors: (TranslationError | string)[], lang?: string): (TranslationError | string)[];
    /**
     * Create a scoped translator with a prefix
     *
     * @example
     * const userT = translation.scoped('user')
     * userT.t('name')  // translates 'user.name'
     */
    scoped(prefix: string, lang?: string): ScopedTranslator;
    /**
     * Create a translator bound to a specific language
     *
     * @example
     * const frenchT = translation.forLanguage('FR')
     * frenchT('hello')  // Always translates to French
     */
    forLanguage(lang: string): (key: string, params?: InterpolationParams) => string;
    private get;
    private normalizeLanguage;
    run(): void;
    commands(): any[];
}
export declare class ScopedTranslator {
    private translation;
    private prefix;
    private lang?;
    constructor(translation: Translation, prefix: string, lang?: string);
    t(key: string, params?: InterpolationParams): string;
    has(key: string): boolean;
}
/**
 * Helper to detect language from HTTP request
 * Can be used by http module or custom middleware
 */
export declare function detectLanguageFromRequest(req: {
    headers?: Record<string, string | string[] | undefined>;
}): string | undefined;
/**
 * Create an Express middleware that adds translation helpers to req/res
 *
 * @example
 * // In your HTTP setup:
 * if (etherial.translation) {
 *     app.use(createTranslationMiddleware(etherial.translation))
 * }
 */
export declare function createTranslationMiddleware(translation: Translation): (req: any, res: any, next: () => void) => void;
export {};
