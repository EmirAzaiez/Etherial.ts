/**
 * Swagger UI HTML Generator
 *
 * Generates a beautiful, customized Swagger UI page for API documentation
 */
export interface SwaggerUIConfig {
    title?: string;
    specUrl?: string;
    spec?: Record<string, any>;
    customCss?: string;
    customJs?: string;
    favicon?: string;
    theme?: 'light' | 'dark' | 'flattop' | 'monokai' | 'material' | 'muted' | 'newspaper' | 'outline';
}
/**
 * Generate Swagger UI HTML page
 */
export declare function generateSwaggerUIHtml(config?: SwaggerUIConfig): string;
/**
 * Generate a minimal Redoc HTML page (alternative to Swagger UI)
 */
export declare function generateRedocHtml(config?: {
    title?: string;
    specUrl?: string;
    spec?: Record<string, any>;
}): string;
declare const _default: {
    generateSwaggerUIHtml: typeof generateSwaggerUIHtml;
    generateRedocHtml: typeof generateRedocHtml;
};
export default _default;
