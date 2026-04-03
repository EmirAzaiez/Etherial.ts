import {
    Column,
    Model,
    AllowNull,
    Default,
    PrimaryKey,
    AutoIncrement,
    CreatedAt,
    UpdatedAt,
    DataType,
    Index,
} from 'etherial/components/database/provider'

export interface EmailTemplateAttributes {
    id: number
    key: string
    locale: string
    subject: string
    title?: string
    greeting?: string
    body: string
    button_text?: string
    button_url?: string
    additional_content?: string
    footer?: string
    enabled: boolean
    created_at: Date
    updated_at: Date
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
export class BaseEmailTemplate extends Model<BaseEmailTemplate> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column
    id: number

    @AllowNull(false)
    @Index
    @Column(DataType.STRING(100))
    key: string

    @Default('en')
    @AllowNull(false)
    @Index
    @Column(DataType.STRING(10))
    locale: string

    @AllowNull(false)
    @Column(DataType.STRING(500))
    subject: string

    @AllowNull(true)
    @Column(DataType.STRING(255))
    title: string

    @AllowNull(true)
    @Column(DataType.STRING(500))
    greeting: string

    @AllowNull(false)
    @Column(DataType.TEXT)
    body: string

    @AllowNull(true)
    @Column(DataType.STRING(255))
    button_text: string

    @AllowNull(true)
    @Column(DataType.STRING(500))
    button_url: string

    @AllowNull(true)
    @Column(DataType.TEXT)
    additional_content: string

    @AllowNull(true)
    @Column(DataType.STRING(500))
    footer: string

    @Default(true)
    @AllowNull(false)
    @Column
    enabled: boolean

    @CreatedAt
    created_at: Date

    @UpdatedAt
    updated_at: Date

    /**
     * Replace {{variable}} placeholders in a string
     */
    static replacePlaceholders(text: string | null | undefined, variables: Record<string, string>): string | undefined {
        if (!text) {
            return undefined
        }
        return text.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
            return variables[key] !== undefined ? variables[key] : `{{${key}}}`
        })
    }

    /**
     * Resolve all template fields with the given variables
     */
    resolve(variables: Record<string, string> = {}): {
        subject: string
        title?: string
        greeting?: string
        body: string
        buttonText?: string
        buttonUrl?: string
        additionalContent?: string
        footer?: string
    } {
        const r = BaseEmailTemplate.replacePlaceholders
        return {
            subject: r(this.subject, variables)!,
            title: r(this.title, variables),
            greeting: r(this.greeting, variables),
            body: r(this.body, variables)!,
            buttonText: r(this.button_text, variables),
            buttonUrl: r(this.button_url, variables),
            additionalContent: r(this.additional_content, variables),
            footer: r(this.footer, variables),
        }
    }

    /**
     * Find a template by key and locale, with fallback to default locale
     */
    static async findByKey(key: string, locale: string = 'en', fallbackLocale: string = 'en'): Promise<BaseEmailTemplate | null> {
        const sequelize = (await import('etherial')).default.database?.sequelize
        const EmailTemplateModel = sequelize?.models?.EmailTemplate as typeof BaseEmailTemplate

        if (!EmailTemplateModel) {
            throw new Error('[EmailTemplate] EmailTemplate model not registered in Sequelize')
        }

        let template = await EmailTemplateModel.findOne({
            where: { key, locale, enabled: true }
        })

        if (!template && locale !== fallbackLocale) {
            template = await EmailTemplateModel.findOne({
                where: { key, locale: fallbackLocale, enabled: true }
            })
        }

        return template
    }
}

// Alias for convenience
export { BaseEmailTemplate as EmailTemplate }
