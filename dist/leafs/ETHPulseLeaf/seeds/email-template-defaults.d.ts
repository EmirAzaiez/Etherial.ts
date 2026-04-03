/**
 * Default email template content per key and locale.
 * Used by the `seed-email-templates` CLI command.
 *
 * Each key maps to a locale -> content object.
 * If a locale is requested but not defined here, it falls back to 'en'.
 */
interface TemplateContent {
    subject: string;
    title?: string;
    greeting?: string;
    body: string;
    button_text?: string;
    button_url?: string;
    footer?: string;
}
type TemplateDefaults = Record<string, Record<string, TemplateContent>>;
export declare const emailTemplateDefaults: TemplateDefaults;
/**
 * Get default content for a template key + locale.
 * Falls back to 'en' if the requested locale doesn't exist.
 * Returns a generic skeleton if the key is unknown.
 */
export declare function getDefaultContent(key: string, locale: string): TemplateContent;
export {};
