import { Model } from 'etherial/components/database/provider';
export interface EmailTemplateAttributes {
    id: number;
    key: string;
    locale: string;
    subject: string;
    title?: string;
    greeting?: string;
    body: string;
    button_text?: string;
    button_url?: string;
    additional_content?: string;
    footer?: string;
    enabled: boolean;
    created_at: Date;
    updated_at: Date;
}
/**
 * Base EmailTemplate Model (no @Table - define it in your project)
 *
 * Stores configurable email templates with multi-language support.
 * Each row = one template + one locale. Unique constraint on (key, locale).
 *
 * Text fields support {{variable}} placeholders that are replaced at send time.
 *
 * Usage in your project:
 * ```typescript
 * import { BaseEmailTemplate } from './ETHPulseLeaf/models/EmailTemplate.js'
 *
 * @Table({ tableName: 'email_templates', indexes: [{ unique: true, fields: ['key', 'locale'] }] })
 * export class EmailTemplate extends BaseEmailTemplate {}
 * ```
 */
export declare class BaseEmailTemplate extends Model<BaseEmailTemplate> {
    id: number;
    key: string;
    locale: string;
    subject: string;
    title: string;
    greeting: string;
    body: string;
    button_text: string;
    button_url: string;
    additional_content: string;
    footer: string;
    enabled: boolean;
    created_at: Date;
    updated_at: Date;
    /**
     * Replace {{variable}} placeholders in a string
     */
    static replacePlaceholders(text: string | null | undefined, variables: Record<string, string>): string | undefined;
    /**
     * Resolve all template fields with the given variables
     */
    resolve(variables?: Record<string, string>): {
        subject: string;
        title?: string;
        greeting?: string;
        body: string;
        buttonText?: string;
        buttonUrl?: string;
        additionalContent?: string;
        footer?: string;
    };
    /**
     * Find a template by key and locale, with fallback to default locale
     */
    static findByKey(key: string, locale?: string, fallbackLocale?: string): Promise<BaseEmailTemplate | null>;
}
export { BaseEmailTemplate as EmailTemplate };
